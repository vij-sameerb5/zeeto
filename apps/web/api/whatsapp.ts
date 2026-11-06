import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './_lib/db.js';
import { env, has } from './_lib/env.js';
import { notifyCustomer, transition, type OrderRow } from './_lib/orders.js';
import { MAX_ORDER_INR, newId, REQUEST_TTL_MS } from './_lib/shared.js';
import { signedByMeta, site, waLink, waText } from './_lib/wa.js';

/**
 * WhatsApp Cloud API webhook.
 *
 * Customers:  "pay ravi 120"  → a pay link button. They tap it, sign in with the same phone, sign once (no gas), done.
 *             "orders"         → link to their orders.
 * Stalls (from the WhatsApp number saved on the stall):
 *             "orders"                         → open orders with codes
 *             "accept AB-123" / "ready AB-123" / "done AB-123"
 *             "bill 250"                       → a pay link to forward or show
 *             "open" / "close"
 * Money never moves inside WhatsApp: every payment is signed by the customer's own wallet on the Zeeto page.
 */
export const config = { api: { bodyParser: false } };

const HELP_CUSTOMER = `Zeeto 🛒 pay street stalls in USDT, no gas.
• pay <stall> <amount>  e.g. "pay ravi 120"
• orders  see your orders`;
const HELP_STALL = `Zeeto stall commands:
• orders  open orders
• accept AB-123 · ready AB-123 · done AB-123
• bill 250  a pay link for a customer
• open · close`;

async function raw(req: VercelRequest): Promise<string> {
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Meta's one-time check when you register the webhook URL.
  if (req.method === 'GET') {
    if (has.whatsapp && req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === env.waVerify) return res.status(200).send(String(req.query['hub.challenge'] ?? ''));
    return res.status(403).send('Forbidden');
  }
  if (req.method !== 'POST') return res.status(405).end();
  if (!has.whatsapp || !has.db) return res.status(503).json({ error: 'WhatsApp isn’t set up.' });

  const text = await raw(req);
  if (!signedByMeta(text, req.headers['x-hub-signature-256'] as string | undefined)) return res.status(401).end();

  let payload: { entry?: { changes?: { value?: { messages?: { id: string; from: string; type: string; text?: { body?: string } }[] } }[] }[] };
  try { payload = JSON.parse(text); } catch { return res.status(400).end(); }

  const msgs = payload.entry?.flatMap((e) => e.changes?.flatMap((c) => c.value?.messages ?? []) ?? []) ?? [];
  for (const m of msgs) {
    // Meta retries: handle each message id once.
    const seen = await db().from('wa_messages').insert({ id: m.id, from_phone: m.from, body: m.text?.body?.slice(0, 500) ?? m.type });
    if (seen.error) continue;
    try {
      const reply = await handle(`+${m.from.replace(/\D/g, '')}`, (m.text?.body ?? '').trim());
      if (reply) await db().from('wa_messages').update({ reply: reply.slice(0, 500) }).eq('id', m.id);
    } catch (e) {
      console.error('[wa] handle', (e as Error).message);
      await waText(m.from, 'Sorry, something went wrong. Try again in a minute.');
    }
  }
  return res.status(200).json({ ok: true }); // always 200 quickly, or Meta keeps retrying
}

async function handle(phone: string, msg: string): Promise<string | null> {
  const words = msg.toLowerCase().split(/\s+/).filter(Boolean);
  const cmd = words[0] ?? '';
  const stall = (await db().from('vendors').select('id, data, status').eq('wa_phone', phone).maybeSingle()).data as { id: string; data: { name?: string }; status: string } | null;

  if (stall) return stallCommand(phone, stall, cmd, words);

  if (cmd === 'pay' && words.length >= 3) {
    const amount = Number(words[words.length - 1].replace(/[₹,rs.]/gi, ''));
    const who = words.slice(1, -1).join(' ');
    if (!(Number.isInteger(amount) && amount >= 1 && amount <= MAX_ORDER_INR)) return say(phone, `Amount must be a whole number from ₹1 to ₹${MAX_ORDER_INR}.`);
    // A few links per phone per 10 minutes, so nobody floods a stall with fake bills.
    const recent = await db().from('wa_messages').select('id', { count: 'exact', head: true }).eq('from_phone', phone.slice(1)).ilike('body', 'pay %').gte('created_at', new Date(Date.now() - 600_000).toISOString());
    if ((recent.count ?? 0) > 5) return say(phone, 'Too many pay links. Wait a few minutes.');
    const v = await findStall(who);
    if (!v) return say(phone, `I couldn’t find a stall called "${who}". Use the name on their Zeeto QR.`);
    if (v.status !== 'live') return say(phone, `${v.data.name} is closed right now.`);
    const id = newId('r', 8);
    await db().from('pay_requests').insert({
      id, vendor_id: v.id, inr: amount, made_by: 'whatsapp', expires_at: new Date(Date.now() + REQUEST_TTL_MS).toISOString(),
      lines: [{ productId: 'counter', name: 'Paid via WhatsApp', unit: 'piece', qty: 1, priceInr: amount }],
    });
    await waLink(phone, `Pay ₹${amount} to ${v.data.name}. Tap the button, sign in with this phone number and confirm. No gas fee. Link works for 5 minutes.`, `Pay ₹${amount}`, site(`/pay/r/${id}`));
    return `link ${id}`;
  }
  if (cmd === 'orders' || cmd === 'status') {
    await waLink(phone, 'Your Zeeto orders and pickup codes:', 'My orders', site('/orders'));
    return 'orders link';
  }
  return say(phone, HELP_CUSTOMER);
}

async function stallCommand(phone: string, stall: { id: string; data: { name?: string }; status: string }, cmd: string, words: string[]) {
  if (cmd === 'open' || cmd === 'close') {
    await db().from('vendors').update({ status: cmd === 'open' ? 'live' : 'closed' }).eq('id', stall.id).neq('status', 'suspended');
    return say(phone, cmd === 'open' ? 'Your stall is open for orders ✅' : 'Your stall is closed. No new orders until you send "open".');
  }
  if (cmd === 'orders') {
    const list = (await db().from('orders').select('code, customer, inr, status, cancel_asked').eq('vendor_id', stall.id).in('status', ['paid', 'accepted', 'ready']).order('created_at').limit(15)).data as { code: string; customer: string; inr: number; status: string; cancel_asked: boolean }[] | null;
    if (!list?.length) return say(phone, 'No open orders right now.');
    return say(phone, list.map((o) => `${o.code} · ₹${o.inr} · ${o.customer} · ${o.cancel_asked ? 'CANCEL ASKED, refund in app' : o.status}`).join('\n'));
  }
  if (cmd === 'bill' && words[1]) {
    const amount = Number(words[1].replace(/[₹,]/g, ''));
    if (!(Number.isInteger(amount) && amount >= 1 && amount <= MAX_ORDER_INR)) return say(phone, `Bill must be ₹1 to ₹${MAX_ORDER_INR}.`);
    const id = newId('r', 8);
    await db().from('pay_requests').insert({ id, vendor_id: stall.id, inr: amount, made_by: 'stall', lines: [], expires_at: new Date(Date.now() + REQUEST_TTL_MS).toISOString() });
    await waLink(phone, `Bill for ₹${amount}. Forward this to the customer, or open it and show the QR. Valid 5 minutes.`, 'Open bill', site(`/pay/r/${id}`));
    return `bill ${id}`;
  }
  const step = { accept: { from: ['paid'], to: 'accepted', tell: 'accepted your order. They’re packing it.' }, ready: { from: ['accepted'], to: 'ready', tell: 'has your order ready 🎉 Say your name and code at the stall.' }, done: { from: ['ready', 'accepted'], to: 'done', tell: 'handed over your order. Thanks!' } }[cmd as 'accept' | 'ready' | 'done'];
  if (step && words[1]) {
    const code = words[1].toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^([A-Z]{2})(\d{3})$/, '$1-$2');
    const o = (await db().from('orders').select('*').eq('vendor_id', stall.id).eq('code', code).in('status', step.from).order('created_at', { ascending: false }).limit(1).maybeSingle()).data as OrderRow | null;
    if (!o) return say(phone, `No order ${code} waiting to be ${cmd === 'done' ? 'handed over' : cmd === 'ready' ? 'marked ready' : 'accepted'}.`);
    if (cmd === 'accept' && o.cancel_asked) return say(phone, `${code}: the customer asked to cancel. Refund it in the app.`);
    const r = await transition(o.id, step.from, { status: step.to });
    await notifyCustomer(r, `${stall.data.name} ${step.tell} (${r.code})`);
    return say(phone, `${code} → ${step.to} ✅`);
  }
  return say(phone, HELP_STALL);
}

async function findStall(q: string) {
  const s = q.replace(/[%_,()]/g, '').slice(0, 40);
  const byId = (await db().from('vendors').select('id, data, status').eq('id', s).maybeSingle()).data;
  if (byId) return byId as { id: string; data: { name?: string }; status: string };
  const r = await db().from('vendors').select('id, data, status').ilike('data->>name', `%${s}%`).neq('status', 'suspended').limit(1);
  return (r.data?.[0] ?? null) as { id: string; data: { name?: string }; status: string } | null;
}

async function say(phone: string, text: string) {
  await waText(phone, text);
  return text;
}

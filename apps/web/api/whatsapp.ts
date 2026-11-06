import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './_lib/db.js';
import { env, has } from './_lib/env.js';
import { clip, draftFrom, gemini, type Draft } from './_lib/gemini.js';
import { notifyCustomer, transition, type OrderRow } from './_lib/orders.js';
import { CATEGORIES, MAX_ORDER_INR, newId, REQUEST_TTL_MS } from './_lib/shared.js';
import { signedByMeta, site, waLink, waMedia, waText } from './_lib/wa.js';

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
 *             a photo of today's stock → Gemini drafts the listing → "publish" puts it live, "cancel" drops it
 * Anything else, in any language ("chai kahan milegi?", "aaj 20 kilo tamatar 40 rupaye"), goes to Gemini, which may only
 * pick one of the commands above. It can never move money or change an order by itself beyond what the command allows.
 * Money never moves inside WhatsApp: every payment is signed by the customer's own wallet on the Zeeto page.
 */
export const config = { api: { bodyParser: false } };

const HELP_CUSTOMER = `Zeeto 🛒 pay street stalls in USDT, no gas.
• pay <stall> <amount>  e.g. "pay ravi 120"
• orders  see your orders
• or just ask, in any language: "where can I get chai?"`;
const HELP_STALL = `Zeeto stall commands:
• orders  open orders
• accept AB-123 · ready AB-123 · done AB-123
• bill 250  a pay link for a customer
• open · close
• send a photo of your stock: AI writes the listing, reply "publish"
• or just type: "aaj 20 kilo tamatar 40 rupaye"`;

type Msg = { id: string; from: string; type: string; text?: { body?: string }; image?: { id?: string; caption?: string } };
type Stall = { id: string; data: Record<string, unknown> & { name?: string }; status: string };

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

  let payload: { entry?: { changes?: { value?: { messages?: Msg[] } }[] }[] };
  try { payload = JSON.parse(text); } catch { return res.status(400).end(); }

  const msgs = payload.entry?.flatMap((e) => e.changes?.flatMap((c) => c.value?.messages ?? []) ?? []) ?? [];
  for (const m of msgs) {
    // Meta retries: handle each message id once.
    const seen = await db().from('wa_messages').insert({ id: m.id, from_phone: m.from, body: (m.text?.body ?? (m.image ? `[photo] ${m.image.caption ?? ''}` : m.type)).slice(0, 500) });
    if (seen.error) continue;
    try {
      const reply = await handle(`+${m.from.replace(/\D/g, '')}`, m);
      if (reply) await db().from('wa_messages').update({ reply: reply.slice(0, 500) }).eq('id', m.id);
    } catch (e) {
      console.error('[wa] handle', (e as Error).message);
      await waText(m.from, 'Sorry, something went wrong. Try again in a minute.');
    }
  }
  return res.status(200).json({ ok: true }); // always 200 quickly, or Meta keeps retrying
}

async function handle(phone: string, m: Msg): Promise<string | null> {
  const msg = (m.text?.body ?? '').trim().slice(0, 500);
  const words = msg.toLowerCase().split(/\s+/).filter(Boolean);
  const cmd = words[0] ?? '';
  const stall = (await db().from('vendors').select('id, data, status').eq('wa_phone', phone).maybeSingle()).data as Stall | null;

  if (stall) {
    if (m.type === 'image') return snapFromPhoto(phone, stall, m.image?.id ?? '', m.image?.caption ?? '');
    if (KNOWN_STALL.has(cmd)) return stallCommand(phone, stall, cmd, words);
    return askStall(phone, stall, msg);
  }
  if (m.type === 'image') return say(phone, 'Thanks! Photos are for stalls listing their stock. To pay, send "pay <stall> <amount>".');
  if (cmd === 'pay' && words.length >= 3) return payLink(phone, words.slice(1, -1).join(' '), words[words.length - 1]);
  if (cmd === 'orders' || cmd === 'status') {
    await waLink(phone, 'Your Zeeto orders and pickup codes:', 'My orders', site('/orders'));
    return 'orders link';
  }
  if (['hi', 'hello', 'help', 'menu', 'start'].includes(cmd) || !msg) return say(phone, HELP_CUSTOMER);
  return askCustomer(phone, msg);
}

async function payLink(phone: string, whoRaw: string, amountRaw: string) {
  const amount = Number(String(amountRaw).replace(/[₹,rs.]/gi, ''));
  const who = whoRaw.trim();
  if (!(Number.isInteger(amount) && amount >= 1 && amount <= MAX_ORDER_INR)) return say(phone, `Amount must be a whole number from ₹1 to ₹${MAX_ORDER_INR}.`);
  // A few links per phone per 10 minutes (typed or asked through the AI), so nobody floods a stall with fake bills.
  const recent = await db().from('wa_messages').select('id', { count: 'exact', head: true }).eq('from_phone', phone.slice(1)).like('reply', 'link %').gte('created_at', new Date(Date.now() - 600_000).toISOString());
  if ((recent.count ?? 0) >= 5) return say(phone, 'Too many pay links. Wait a few minutes.');
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

const KNOWN_STALL = new Set(['open', 'close', 'orders', 'bill', 'accept', 'ready', 'done', 'publish', 'cancel', 'help', 'menu', 'hi']);

async function stallCommand(phone: string, stall: Stall, cmd: string, words: string[]): Promise<string> {
  if (cmd === 'publish') return publishDraft(phone, stall);
  if (cmd === 'cancel') {
    if (!stall.data.waDraft) return say(phone, 'Nothing to cancel.');
    await saveDraft(stall, null);
    return say(phone, 'Dropped that draft. Nothing went live.');
  }
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

async function findStall(q: string): Promise<Stall | null> {
  const s = q.replace(/[%_,()]/g, '').slice(0, 40);
  const byId = (await db().from('vendors').select('id, data, status').eq('id', s).maybeSingle()).data;
  if (byId) return byId as Stall;
  const r = await db().from('vendors').select('id, data, status').ilike('data->>name', `%${s}%`).neq('status', 'suspended').limit(1);
  return (r.data?.[0] ?? null) as Stall | null;
}

async function say(phone: string, text: string) {
  await waText(phone, text);
  return text;
}

// ───────────────────────── Gemini inside WhatsApp ─────────────────────────

/** Each phone gets a few AI answers per 10 minutes, so nobody can run up the Gemini bill through our number. */
async function aiAllowed(phone: string) {
  if (!has.ai) return false;
  const r = await db().from('wa_messages').select('id', { count: 'exact', head: true }).eq('from_phone', phone.slice(1)).like('reply', 'ai%').gte('created_at', new Date(Date.now() - 600_000).toISOString());
  return (r.count ?? 0) < 12;
}

const draftText = (d: Pick<Draft, 'items' | 'alert'>) =>
  `${d.items.map((it, i) => `${i + 1}. ${it.name}${it.local ? ` (${it.local})` : ''} · ₹${it.priceInr}/${it.unit} · ${it.qty} in stock`).join('\n')}${d.alert.title ? `\n\nNote to followers: "${d.alert.title}. ${d.alert.body}"` : ''}`;

async function saveDraft(stall: Stall, d: Draft | null, photo?: string) {
  const data = { ...stall.data };
  if (d) data.waDraft = { items: d.items, alert: d.alert, photo: photo ?? null, at: new Date().toISOString() };
  else delete data.waDraft;
  await db().from('vendors').update({ data }).eq('id', stall.id);
}

async function snapFromPhoto(phone: string, stall: Stall, mediaId: string, caption: string) {
  if (!(await aiAllowed(phone))) return say(phone, 'AI listing isn’t available right now. Add items in the app.');
  const img = await waMedia(mediaId);
  if (!img) return say(phone, 'I couldn’t open that photo. Send a JPEG or PNG under 4 MB.');
  await waText(phone, 'Looking at your photo… 🔍');
  const { draft } = await draftFrom({ image: img, text: caption || undefined });
  if (!draft.items.length) { await waText(phone, 'I couldn’t see stock to sell in that photo. Try a closer, brighter photo of what you’re selling.'); return 'ai empty'; }
  // Small photos are kept as the product picture; big ones use the stall's cover photo.
  const photo = img.b64.length <= 150_000 ? `data:${img.mime};base64,${img.b64}` : undefined;
  await saveDraft(stall, draft, photo);
  await waText(phone, `Here’s your listing ✨\n\n${draftText(draft)}\n\nReply *publish* to put it on your stall, or *cancel*. You can fix prices in the app any time.`);
  return 'ai draft';
}

async function publishDraft(phone: string, stall: Stall) {
  const d = stall.data.waDraft as { items: Draft['items']; alert: Draft['alert']; photo: string | null; at: string } | undefined;
  if (!d?.items?.length) return say(phone, 'No draft waiting. Send a photo of your stock first.');
  if (Date.now() - Date.parse(d.at) > 24 * 3600_000) { await saveDraft(stall, null); return say(phone, 'That draft is over a day old. Send a fresh photo.'); }
  const now = new Date().toISOString();
  const rows = d.items.map((it) => ({
    id: `${stall.id}:wa${newId('', 4)}`, vendor_id: stall.id, price_inr: it.priceInr, stock: it.qty, active: true, updated_at: now,
    data: { name: it.name, local: it.local, unit: it.unit, image: d.photo ?? (typeof stall.data.cover === 'string' ? stall.data.cover : 'veg-1'), byAi: true },
  }));
  const r = await db().from('products').insert(rows);
  if (r.error) return say(phone, 'Couldn’t publish. Try again in a minute.');
  await saveDraft(stall, null);
  return say(phone, `Live ✅ ${rows.length} item${rows.length === 1 ? '' : 's'} now on your stall: ${site(`/s/${stall.id}`)}`);
}

const stallIntent = {
  type: 'OBJECT',
  properties: {
    action: { type: 'STRING', enum: ['orders', 'accept', 'ready', 'done', 'bill', 'open', 'close', 'list', 'help'] },
    code: { type: 'STRING' }, amount: { type: 'INTEGER' }, reply: { type: 'STRING' },
  },
  required: ['action', 'reply'],
};

/** A stall typed something that isn't a command. Gemini maps it to one command (or a stock listing); then the normal, checked command runs. */
async function askStall(phone: string, stall: Stall, msg: string): Promise<string> {
  if (!msg || !(await aiAllowed(phone))) return say(phone, HELP_STALL);
  const { out } = await gemini([{ text: `You are the WhatsApp helper for a Mumbai street stall called "${stall.data.name}" on Zeeto.
Map the owner's message (any language, Hinglish too) to ONE action:
orders (see open orders), accept / ready / done (need a pickup code like AB-123), bill (needs a whole-rupee amount), open, close,
list (they are telling you what stock they have today, with or without prices), help (anything else).
"reply" is one short friendly line in the owner's language. Never promise money movements.
Message: <<<${clip(msg, 400)}>>>` }], stallIntent, { temperature: 0.1, maxTokens: 300 });
  const action = String(out.action ?? 'help');
  const code = clip(out.code, 12);
  const amount = Number(out.amount);
  if (action === 'list') {
    const { draft } = await draftFrom({ text: msg });
    if (!draft.items.length) { await waText(phone, clip(out.reply, 300) || 'Tell me what you have and the price, e.g. "20 kg tomato 40 rupees".'); return 'ai empty'; }
    await saveDraft(stall, draft);
    await waText(phone, `Got it ✨\n\n${draftText(draft)}\n\nReply *publish* to put it on your stall, or *cancel*.`);
    return 'ai draft';
  }
  if (['accept', 'ready', 'done'].includes(action) && code) return `ai→${await stallCommand(phone, stall, action, [action, code])}`.slice(0, 500);
  if (action === 'bill' && Number.isInteger(amount) && amount > 0) return `ai→${await stallCommand(phone, stall, 'bill', ['bill', String(amount)])}`.slice(0, 500);
  if (['orders', 'open', 'close'].includes(action)) return `ai→${await stallCommand(phone, stall, action, [action])}`.slice(0, 500);
  await waText(phone, `${clip(out.reply, 300)}\n\n${HELP_STALL}`.trim());
  return 'ai help';
}

const customerIntent = {
  type: 'OBJECT',
  properties: {
    intent: { type: 'STRING', enum: ['pay', 'orders', 'find', 'help'] },
    stallId: { type: 'STRING' }, amount: { type: 'INTEGER' },
    picks: { type: 'ARRAY', items: { type: 'STRING' } },
    reply: { type: 'STRING' },
  },
  required: ['intent', 'reply'],
};

/** A customer asked in their own words: find a stall, pay one, or see orders. Gemini may only pick from live stalls. */
async function askCustomer(phone: string, msg: string): Promise<string> {
  if (!(await aiAllowed(phone))) return say(phone, HELP_CUSTOMER);
  const list = ((await db().from('vendors').select('id, data, status').eq('status', 'live').limit(60)).data ?? []) as Stall[];
  const stalls = list.map((v) => ({
    id: v.id, name: v.data.name,
    kind: (CATEGORIES as readonly string[]).includes(String(v.data.category)) ? v.data.category : undefined,
    tagline: clip(v.data.tagline, 60) || undefined, landmark: clip(v.data.landmark, 60) || undefined,
  }));
  const { out } = await gemini([{ text: `You are Zeeto's WhatsApp helper in Mumbai. Zeeto lets people pay street stalls in USDT with no gas fee.
Live stalls (JSON): ${JSON.stringify(stalls)}
Customer message (any language, Hinglish too): <<<${clip(msg, 400)}>>>
Pick ONE intent: pay (they want to pay a stall: stallId from the list, amount in whole rupees), orders, find (they are looking for something: up to 3 stall ids in picks), help.
Only use stall ids from the list. "reply" is one or two short friendly lines in the customer's language. Don't invent prices.` }], customerIntent, { temperature: 0.2, maxTokens: 400 });
  const intent = String(out.intent ?? 'help');
  const known = new Set(stalls.map((x) => x.id));
  if (intent === 'pay' && known.has(String(out.stallId)) && Number.isInteger(Number(out.amount))) {
    const r = await payLink(phone, String(out.stallId), String(out.amount));
    return r.startsWith('link ') ? r : `ai ${r}`.slice(0, 500);
  }
  if (intent === 'orders') {
    await waLink(phone, clip(out.reply, 300) || 'Your Zeeto orders:', 'My orders', site('/orders'));
    return 'ai orders';
  }
  const picks = (Array.isArray(out.picks) ? out.picks : []).map(String).filter((id) => known.has(id)).slice(0, 3);
  const lines = picks.map((id) => `• ${list.find((x) => x.id === id)!.data.name}: ${site(`/s/${id}`)}`);
  await waText(phone, [clip(out.reply, 300), ...lines, lines.length ? 'To pay one: "pay <stall> <amount>"' : HELP_CUSTOMER].filter(Boolean).join('\n'));
  return `ai ${intent}`;
}

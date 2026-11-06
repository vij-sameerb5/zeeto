import { db } from './db.js';
import { env, has } from './env.js';
import { bad, off } from './http.js';
import { clip, gemini } from './gemini.js';

const askSchema = {
  type: 'OBJECT',
  properties: {
    answer: { type: 'STRING' },
    insights: { type: 'ARRAY', items: { type: 'OBJECT', properties: { title: { type: 'STRING' }, body: { type: 'STRING' }, kind: { type: 'STRING', enum: ['sales', 'stock', 'customers', 'offer'] } }, required: ['title', 'body', 'kind'] } },
  },
  required: ['answer', 'insights'],
};

/**
 * The stall's assistant. Built only from that stall's own numbers (last 30 days of orders + current stock), computed here
 * from the database, so the model can't see other stalls and can't be told different numbers by the browser.
 */
export async function ask(ownerId: string, question: string) {
  if (!has.db) throw off('Database');
  const v = (await db().from('vendors').select('id, data').eq('owner_id', ownerId).maybeSingle()).data as { id: string; data: Record<string, unknown> } | null;
  if (!v) throw bad('Open your stall first.');
  return askStall(v, question);
}

export async function askStall(v: { id: string; data: Record<string, unknown> }, question: string) {
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const orders = ((await db().from('orders').select('inr, lines, customer, status, created_at').eq('vendor_id', v.id).gte('created_at', since).limit(2000)).data ?? []) as { inr: number; lines: { name: string; qty: number; priceInr: number }[]; customer: string; status: string; created_at: string }[];
  const products = ((await db().from('products').select('data, price_inr, stock').eq('vendor_id', v.id).eq('active', true).limit(200)).data ?? []) as { data: { name?: string; unit?: string }; price_inr: number; stock: number }[];
  const paid = orders.filter((o) => !['paying', 'expired', 'refunded'].includes(o.status));
  const byDay: Record<string, number> = {}; const byHour: Record<number, number> = {}; const items: Record<string, { qty: number; inr: number }> = {}; const people: Record<string, number> = {};
  for (const o of paid) {
    const d = o.created_at.slice(0, 10); byDay[d] = (byDay[d] ?? 0) + o.inr;
    const h = (new Date(o.created_at).getUTCHours() + 5) % 24 + (new Date(o.created_at).getUTCMinutes() >= 30 ? 1 : 0); byHour[h % 24] = (byHour[h % 24] ?? 0) + 1;
    people[o.customer] = (people[o.customer] ?? 0) + 1;
    for (const l of o.lines ?? []) { const it = (items[l.name] ??= { qty: 0, inr: 0 }); it.qty += l.qty; it.inr += l.qty * l.priceInr; }
  }
  const facts = {
    stall: { name: v.data.name, category: v.data.category, hours: v.data.hours },
    last30Days: { orders: paid.length, revenueInr: paid.reduce((a, o) => a + o.inr, 0), refunded: orders.filter((o) => o.status === 'refunded').length },
    revenueByDay: byDay, ordersByHourIST: byHour,
    topItems: Object.entries(items).sort((a, b) => b[1].inr - a[1].inr).slice(0, 8).map(([name, x]) => ({ name, ...x })),
    customers: { unique: Object.keys(people).length, returning: Object.values(people).filter((n) => n > 1).length },
    stock: products.map((p) => ({ name: p.data.name, priceInr: p.price_inr, unit: p.data.unit, stock: Number(p.stock) })),
  };
  const { out, ms, requestId } = await gemini([{ text: `You are the business assistant for a small street stall / shop in India that sells on Zeeto (customers pay in USDT, no gas fee).
Use ONLY these facts about this stall (JSON): ${JSON.stringify(facts)}
${question ? `The owner asks: <<<${question}>>>` : 'The owner opened their dashboard.'}
Reply in the owner's language (Hinglish is fine). "answer": ${question ? 'a direct, practical answer in at most 5 short sentences or bullets; if the facts don\'t cover it, say so and suggest what to track' : 'one friendly line summarising how the stall is doing'}.
"insights": 3 short, specific, actionable tips from the facts (restock, best hours, prices, a WhatsApp offer to regulars). Never invent numbers that aren't in the facts. If there are no orders yet, give setup tips (photos, prices, share the QR).` }], askSchema, { temperature: 0.4, maxTokens: 900 });
  if (has.db) await db().from('ai_runs').insert({ id: requestId.slice(0, 60), kind: 'ask', model: env.geminiModel, ms, ok: true });
  const insights = (Array.isArray(out.insights) ? out.insights : []).slice(0, 4).map((x: Record<string, unknown>) => ({ title: clip(x.title, 80), body: clip(x.body, 240), kind: ['sales', 'stock', 'customers', 'offer'].includes(String(x.kind)) ? String(x.kind) : 'sales' }));
  return { answer: clip(out.answer, 1200), insights, model: env.geminiModel, ms };
}

/** Today at a stall, in plain numbers (no AI): what the WhatsApp "today" report and the 9 pm summary show. */
export async function todayReport(vendorId: string) {
  const start = new Date(); start.setUTCHours(-5, -30, 0, 0); // midnight IST
  if (start.getTime() > Date.now()) start.setUTCDate(start.getUTCDate() - 1);
  const orders = ((await db().from('orders').select('inr, usd, status, lines, payment').eq('vendor_id', vendorId).gte('created_at', start.toISOString()).limit(1000)).data ?? []) as { inr: number; usd: number; status: string; lines: { name: string; qty: number; priceInr: number }[]; payment: { settled?: number } | null }[];
  const products = ((await db().from('products').select('data, stock').eq('vendor_id', vendorId).eq('active', true).limit(200)).data ?? []) as { data: { name?: string }; stock: number }[];
  const paid = orders.filter((o) => ['paid', 'accepted', 'ready', 'done', 'part-refunded'].includes(o.status));
  const items = new Map<string, number>();
  paid.forEach((o) => (o.lines ?? []).forEach((l) => items.set(l.name, (items.get(l.name) ?? 0) + l.qty)));
  return {
    orders: paid.length,
    salesInr: paid.reduce((a, o) => a + o.inr, 0),
    usdt: paid.reduce((a, o) => a + Number(o.payment?.settled ?? o.usd ?? 0), 0),
    open: orders.filter((o) => ['paid', 'accepted', 'ready'].includes(o.status)).length,
    refunded: orders.filter((o) => o.status === 'refunded').length,
    top: [...items.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
    low: products.filter((p) => Number(p.stock) <= 3).map((p) => ({ name: String(p.data.name ?? 'Item'), stock: Number(p.stock) })).slice(0, 4),
  };
}

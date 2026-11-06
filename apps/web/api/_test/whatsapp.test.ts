/**
 * Offline test for the WhatsApp webhook + Gemini: every outside call (Supabase REST, Meta Graph, Gemini) is answered by a fake
 * fetch, so this runs with no keys. Run: npx tsx apps/web/api/_test/whatsapp.test.ts
 */
import { createHmac } from 'node:crypto';
import assert from 'node:assert/strict';

process.env.WHATSAPP_TOKEN = 't'; process.env.WHATSAPP_PHONE_NUMBER_ID = '123'; process.env.WHATSAPP_VERIFY_TOKEN = 'v'; process.env.WHATSAPP_APP_SECRET = 'sec';
process.env.SUPABASE_URL = 'https://db.test'; process.env.SUPABASE_SECRET_KEY = 'k'; process.env.GEMINI_API_KEY = 'g'; process.env.SITE_URL = 'https://zeeto.test';

const STALL_PHONE = '919800000001';
const vendors: Record<string, any> = { ravi: { id: 'ravi', data: { name: 'Ravi Fresh Sabzi', category: 'vegetables', cover: 'veg-1' }, status: 'live', wa_phone: `+${STALL_PHONE}` } };
const sent: any[] = []; const inserted: Record<string, any[]> = {}; let gem: any[] = []; const waMsgs: any[] = [];

globalThis.fetch = (async (input: any, init: any = {}) => {
  const url = new URL(String(input instanceof Request ? input.url : input));
  const method = init.method ?? 'GET';
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });
  if (url.host === 'graph.facebook.com') {
    if (method === 'POST') { sent.push(JSON.parse(init.body)); return json({ ok: true }); }
    if (url.pathname.endsWith('/7777777')) return json({ url: 'https://lookaside.fbsbx.com/img/1', mime_type: 'image/jpeg', file_size: 10 });
  }
  if (url.host === 'lookaside.fbsbx.com') return new Response(new Uint8Array([1, 2, 3]));
  if (url.host === 'generativelanguage.googleapis.com') {
    const next = gem.shift(); assert.ok(next, 'unexpected gemini call');
    return json({ candidates: [{ content: { parts: [{ text: JSON.stringify(next) }] } }], responseId: 'r1' });
  }
  if (url.host === 'db.test') {
    const table = url.pathname.split('/').pop()!;
    const body = init.body ? JSON.parse(init.body) : null;
    const head = method === 'HEAD';
    if (method === 'POST') {
      (inserted[table] ??= []).push(...[].concat(body));
      if (table === 'wa_messages') { if (waMsgs.some((m) => m.id === body.id)) return json({ code: '23505', message: 'dup' }, 409); waMsgs.push(body); }
      return json([], 201);
    }
    if (method === 'PATCH') {
      if (table === 'vendors') { const id = url.searchParams.get('id')!.replace('eq.', ''); Object.assign(vendors[id], body); }
      if (table === 'wa_messages') { const id = url.searchParams.get('id')!.replace('eq.', ''); Object.assign(waMsgs.find((m) => m.id === id) ?? {}, body); }
      return json([], 200);
    }
    if (head) return new Response(null, { status: 200, headers: { 'content-range': '0-0/0' } });
    if (table === 'vendors') {
      const ph = url.searchParams.get('wa_phone'); const id = url.searchParams.get('id');
      let rows = Object.values(vendors);
      if (ph) rows = rows.filter((v) => `eq.${v.wa_phone}` === ph);
      if (id) rows = rows.filter((v) => `eq.${v.id}` === id);
      const single = (init.headers?.Accept ?? init.headers?.accept ?? '') .includes('vnd.pgrst.object');
      return single ? (rows[0] ? json(rows[0]) : json(null)) : json(rows);
    }
    return json([]);
  }
  throw new Error(`unmocked ${method} ${url}`);
}) as typeof fetch;

const { default: handler } = await import('../whatsapp.js');

let n = 0;
async function send(from: string, msg: Record<string, unknown>) {
  const raw = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ id: `wamid.${++n}`, from, ...msg }] } }] }] });
  const sig = `sha256=${createHmac('sha256', 'sec').update(raw).digest('hex')}`;
  let status = 0;
  const res: any = { status(c: number) { status = c; return res; }, json() { return res; }, send() { return res; }, end() { return res; } };
  await handler({ method: 'POST', body: raw, headers: { 'x-hub-signature-256': sig }, query: {} } as any, res);
  return status;
}
const lastText = () => { const m = sent[sent.length - 1]; return m?.text?.body ?? m?.interactive?.body?.text ?? ''; };

// 1. Bad signature is rejected.
{
  const res: any = { code: 0, status(c: number) { res.code = c; return res; }, json() { return res; }, end() { return res; }, send() { return res; } };
  await handler({ method: 'POST', body: '{}', headers: { 'x-hub-signature-256': 'sha256=00' }, query: {} } as any, res);
  assert.equal(res.code, 401); console.log('✓ forged webhook rejected');
}
// 2. Stall sends a photo → Gemini draft → publish.
gem.push({ items: [{ name: 'Tomato', local: 'Tamatar', unit: 'kg', priceInr: 40, qty: 20, confidence: 0.9 }], alert: { title: 'Fresh tomatoes', body: 'Just in', hi: 'a', mr: 'b', gu: 'c' } });
assert.equal(await send(STALL_PHONE, { type: 'image', image: { id: '7777777' } }), 200);
assert.match(lastText(), /Tomato \(Tamatar\) · ₹40\/kg/); assert.ok(vendors.ravi.data.waDraft, 'draft saved');
console.log('✓ photo → Gemini listing draft');
await send(STALL_PHONE, { type: 'text', text: { body: 'publish' } });
assert.equal(inserted.products?.length, 1); assert.equal(inserted.products[0].price_inr, 40); assert.match(lastText(), /Live ✅ 1 item/); assert.equal(vendors.ravi.data.waDraft, undefined);
console.log('✓ publish puts it live and clears the draft');
// 3. Stall free text in Hinglish → AI maps to "bill 250".
gem.push({ action: 'bill', amount: 250, reply: 'ok' });
await send(STALL_PHONE, { type: 'text', text: { body: 'customer ke liye 250 ka bill bana do' } });
assert.equal(inserted.pay_requests?.at(-1)?.inr, 250); assert.match(lastText(), /Bill for ₹250/);
console.log('✓ "250 ka bill bana do" → bill link');
// 4. Customer asks in words → AI picks a live stall and makes a pay link (customer still signs on the web).
gem.push({ intent: 'pay', stallId: 'ravi', amount: 60, reply: 'Sure' });
await send('919811111111', { type: 'text', text: { body: 'ravi bhaiya ko 60 rupaye bhejo' } });
assert.equal(inserted.pay_requests?.at(-1)?.inr, 60); assert.equal(inserted.pay_requests.at(-1).vendor_id, 'ravi');
assert.match(sent.at(-1).interactive.action.parameters.url, /^https:\/\/zeeto\.test\/pay\/r\/r[0-9a-f]{16}$/);
console.log('✓ "ravi bhaiya ko 60 rupaye bhejo" → pay link button');
// 5. AI can't invent a stall.
gem.push({ intent: 'pay', stallId: 'evil', amount: 60, reply: 'Sure' });
const before = inserted.pay_requests.length;
await send('919811111111', { type: 'text', text: { body: 'send 60 to my friend' } });
assert.equal(inserted.pay_requests.length, before); console.log('✓ unknown stall from AI is ignored');
// 6. Typed command still works without AI.
await send('919811111111', { type: 'text', text: { body: 'pay ravi 120' } });
assert.equal(inserted.pay_requests.at(-1).inr, 120); console.log('✓ "pay ravi 120" works without AI');
// 7. Duplicate delivery (Meta retry) is handled once.
const c = sent.length;
const raw = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ id: 'wamid.1', from: STALL_PHONE, type: 'text', text: { body: 'orders' } }] } }] }] });
await handler({ method: 'POST', body: raw, headers: { 'x-hub-signature-256': `sha256=${createHmac('sha256', 'sec').update(raw).digest('hex')}` }, query: {} } as any, { status() { return this; }, json() { return this; } } as any);
assert.equal(sent.length, c); console.log('✓ Meta retry ignored');
// 8. Stall taps a button (same as typing the command): "Today" report comes back with buttons.
await send(STALL_PHONE, { type: 'interactive', interactive: { button_reply: { id: 'cmd:today', title: '📊 Today' } } });
assert.match(sent.at(-1).interactive.body.text, /Today at Ravi Fresh Sabzi/); assert.equal(sent.at(-1).interactive.type, 'button');
console.log('✓ tap "📊 Today" → sales report with buttons');
// 9. Photo draft comes with Publish / Cancel buttons; tapping Cancel drops it.
gem.push({ items: [{ name: 'Onion', unit: 'kg', priceInr: 30, qty: 10, confidence: 0.9 }], alert: { title: '', body: '', hi: '', mr: '', gu: '' } });
await send(STALL_PHONE, { type: 'image', image: { id: '7777777' } });
assert.deepEqual(sent.at(-1).interactive.action.buttons.map((b: any) => b.reply.id), ['cmd:publish', 'cmd:cancel']);
await send(STALL_PHONE, { type: 'interactive', interactive: { button_reply: { id: 'cmd:cancel' } } });
assert.match(lastText(), /Dropped that draft/); assert.equal(vendors.ravi.data.waDraft, undefined);
console.log('✓ draft shows ✅ Publish / ✕ Cancel; tapping Cancel drops it');
// 10. Refund never happens in chat: the stall gets a link to confirm with its wallet.
await send(STALL_PHONE, { type: 'text', text: { body: 'refund' } });
assert.match(sent.at(-1).interactive.action.parameters.url, /\/sell\/orders$/);
console.log('✓ "refund" → secure link (wallet signs in Zeeto, never in chat)');
// 11. Customer says hi → menu buttons; taps "Stalls" → a list; picks one → its menu with an Order button.
await send('919822222222', { type: 'text', text: { body: 'hi' } });
assert.deepEqual(sent.at(-1).interactive.action.buttons.map((b: any) => b.reply.id), ['cmd:find', 'cmd:orders']);
await send('919822222222', { type: 'interactive', interactive: { button_reply: { id: 'cmd:find' } } });
assert.equal(sent.at(-1).interactive.type, 'list'); assert.equal(sent.at(-1).interactive.action.sections[0].rows[0].id, 'stall:ravi');
await send('919822222222', { type: 'interactive', interactive: { list_reply: { id: 'stall:ravi' } } });
assert.match(sent.at(-1).interactive.body.text, /Ravi Fresh Sabzi/); assert.match(sent.at(-1).interactive.action.parameters.url, /\/s\/ravi$/);
console.log('✓ customer: hi → menu → stall list → stall menu with "Order on Zeeto"');
assert.equal(gem.length, 0);
console.log('\nAll WhatsApp + Gemini checks passed.');

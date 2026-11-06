// A separate shop website ("Anna's Chai Co."), showing how any store adds Zeeto Checkout.
// No dependencies: Node 18+.  ZEETO_URL=https://your-zeeto.vercel.app ZEETO_SECRET_KEY=zk_test_... ZEETO_WEBHOOK_SECRET=whsec_... node server.mjs
import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const { ZEETO_URL, ZEETO_SECRET_KEY, ZEETO_WEBHOOK_SECRET, PORT = 4000 } = process.env;
const paid = new Map(); // demo "database": order reference → status

// ── The Zeeto integration: about 20 lines ───────────────────────────────────────────────
const zeeto = (path, init = {}) => fetch(`${ZEETO_URL}${path}`, { ...init, headers: { Authorization: `Bearer ${ZEETO_SECRET_KEY}`, 'Content-Type': 'application/json' } }).then((r) => r.json());

async function createCheckout(reference) {           // 1. your backend creates a session (secret key stays here)
  return zeeto('/api/checkout', { method: 'POST', body: JSON.stringify({
    reference, items: [{ name: 'Masala chai × 2', qty: 1, priceInr: 60 }, { name: 'Bun maska', qty: 1, priceInr: 40 }],
    successUrl: `http://localhost:${PORT}/thanks`,
  }) });
}
const confirm = (session) => zeeto(`/api/checkout?id=${encodeURIComponent(session)}`); // 2. confirm before you ship

function verifyWebhook(raw, header = '') {            // 3. signed webhooks: payment.succeeded / payment.refunded
  const { t, v1 } = Object.fromEntries(header.split(',').map((p) => p.split('=')));
  const want = createHmac('sha256', ZEETO_WEBHOOK_SECRET).update(`${t}.${raw}`).digest('hex');
  return !!v1 && v1.length === want.length && Math.abs(Date.now() / 1000 - Number(t)) < 300 && timingSafeEqual(Buffer.from(want), Buffer.from(v1));
}
// ────────────────────────────────────────────────────────────────────────────────────────

const body = (req) => new Promise((ok) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => ok(d)); });
const send = (res, code, data, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type }); res.end(type === 'application/json' ? JSON.stringify(data) : data); };

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === 'POST' && url.pathname === '/api/pay') {
    const reference = `chai-${Date.now()}`;
    const s = await createCheckout(reference);
    if (!s.url) return send(res, 502, s);
    paid.set(reference, 'pending');
    return send(res, 200, { url: s.url, session: s.id });
  }
  if (url.pathname === '/api/status') {
    const s = await confirm(url.searchParams.get('session') ?? '');
    if (s.status === 'paid' && s.reference) paid.set(s.reference, 'paid');
    return send(res, 200, s);
  }
  if (req.method === 'POST' && url.pathname === '/webhooks/zeeto') {
    const raw = await body(req);
    if (!ZEETO_WEBHOOK_SECRET || !verifyWebhook(raw, req.headers['zeeto-signature'])) return send(res, 400, { error: 'bad signature' });
    const evt = JSON.parse(raw);
    console.log('[webhook]', evt.type, evt.data.reference ?? evt.data.order_id, evt.data.explorer_url ?? '');
    if (evt.type === 'payment.succeeded' && evt.data.reference) paid.set(evt.data.reference, 'paid');
    return send(res, 200, { ok: true });
  }
  const file = url.pathname === '/thanks' ? 'thanks.html' : 'index.html';
  const html = (await readFile(new URL(`./public/${file}`, import.meta.url), 'utf8')).replaceAll('%ZEETO_URL%', ZEETO_URL ?? '');
  send(res, 200, html, 'text/html; charset=utf-8');
}).listen(PORT, () => console.log(`Anna's Chai Co. → http://localhost:${PORT}  (Zeeto: ${ZEETO_URL})`));

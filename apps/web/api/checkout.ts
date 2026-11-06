import type { VercelRequest } from '@vercel/node';
import { check, db } from './_lib/db.js';
import { env } from './_lib/env.js';
import { bad, body, HttpError, int, missing, optStr, route, str } from './_lib/http.js';
import { txUrl } from './_lib/orders.js';
import { MAX_ORDER_INR, newId, toUsd } from './_lib/shared.js';
import { hashKey } from './_lib/webhooks.js';

/**
 * Zeeto Checkout API: how any store adds USDT payments on Whitechain.
 *
 *   POST /api/checkout   Authorization: Bearer zk_test_...   { amountInr, items?, reference?, successUrl?, cancelUrl? }
 *        → { id, url, status, expiresAt }           Send the customer to `url` (or open it with checkout.js).
 *   GET  /api/checkout?id=cs_...   (same key)       → session status, order id, amount, tx hash + explorer link.
 *
 * Server-to-server only (secret key, no CORS). The customer pays on Zeeto's hosted page with an embedded wallet,
 * gas-free; the store gets a signed `payment.succeeded` webhook and can refund from its Zeeto dashboard.
 */
const SESSION_TTL_MS = 30 * 60_000;

async function merchant(req: VercelRequest) {
  const key = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  if (!/^zk_(test|live)_[0-9a-f]{48}$/.test(key)) throw new HttpError(401, 'Missing or malformed API key. Use: Authorization: Bearer zk_test_...');
  const v = (await db().from('vendors').select('id, status, data').eq('api_key_hash', hashKey(key)).maybeSingle()).data as { id: string; status: string; data: { name?: string } } | null;
  if (!v) throw new HttpError(401, 'Unknown API key.');
  if (v.status === 'suspended') throw new HttpError(403, 'This merchant is suspended.');
  return v;
}

const url = (v: unknown, name: string) => {
  const s = optStr(v, 500);
  if (!s) return null;
  let u: URL;
  try { u = new URL(s); } catch { throw bad(`${name} must be a full URL.`); }
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  if (u.protocol !== 'https:' && !(local && u.protocol === 'http:')) throw bad(`${name} must use https.`);
  return u.toString();
};

export default route(['GET', 'POST'], async (req) => {
  const v = await merchant(req);

  if (req.method === 'GET') {
    const id = str(req.query.id, 40);
    const s = (await db().from('pay_requests').select('*').eq('id', id).eq('vendor_id', v.id).maybeSingle()).data as Record<string, unknown> | null;
    if (!s) throw missing('No such checkout session.');
    const o = s.order_id ? (await db().from('orders').select('id, status, tx_hash, payer, refunds, inr, usd').eq('id', s.order_id).maybeSingle()).data as Record<string, unknown> | null : null;
    return {
      id: s.id, status: Date.parse(String(s.expires_at)) < Date.now() && s.status === 'open' ? 'expired' : s.status,
      reference: s.reference, amountInr: s.inr, amountUsdt: toUsd(Number(s.inr)).toFixed(2),
      order: o ? { id: o.id, status: o.status, payer: o.payer, txHash: o.tx_hash, explorerUrl: o.tx_hash ? txUrl(String(o.tx_hash)) : null, refunds: o.refunds } : null,
    };
  }

  const b = body<{ amountInr?: number; items?: { name?: string; qty?: number; priceInr?: number }[]; reference?: string; successUrl?: string; cancelUrl?: string }>(req);
  if (v.status !== 'live') throw bad('Open your stall in the Zeeto dashboard to take payments.');
  const items = (Array.isArray(b.items) ? b.items.slice(0, 30) : []).map((l) => ({ productId: 'counter', name: str(l.name, 60, 1), unit: 'piece', qty: int(l.qty ?? 1, 1, 100), priceInr: int(l.priceInr, 1, MAX_ORDER_INR) }));
  const inr = b.amountInr != null ? int(b.amountInr, 1, MAX_ORDER_INR) : items.reduce((s, l) => s + l.qty * l.priceInr, 0);
  if (inr < 1 || inr > MAX_ORDER_INR) throw bad(`Amount must be ₹1 to ₹${MAX_ORDER_INR}.`);
  if (items.length && items.reduce((s, l) => s + l.qty * l.priceInr, 0) !== inr) throw bad('Items don’t add up to amountInr.');
  const reference = optStr(b.reference, 80) ?? null;
  if (reference) {
    const dup = (await db().from('pay_requests').select('id, status').eq('vendor_id', v.id).eq('reference', reference).in('status', ['open', 'paid']).maybeSingle()).data as { id: string; status: string } | null;
    if (dup) throw new HttpError(409, `A session for reference "${reference}" already exists (${dup.id}, ${dup.status}).`);
  }
  const id = newId('cs_', 10);
  const s = check(await db().from('pay_requests').insert({
    id, vendor_id: v.id, inr, lines: items, made_by: 'api', reference, success_url: url(b.successUrl, 'successUrl'), cancel_url: url(b.cancelUrl, 'cancelUrl'),
    expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  }).select('id, status, expires_at').single(), 'Checkout') as { id: string; status: string; expires_at: string };
  return { id: s.id, url: `${env.siteUrl}/pay/r/${s.id}`, status: s.status, amountInr: inr, amountUsdt: toUsd(inr).toFixed(2), expiresAt: s.expires_at };
}, { perMinute: 120 });

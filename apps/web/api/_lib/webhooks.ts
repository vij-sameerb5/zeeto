import { createHash, createHmac, randomBytes } from 'node:crypto';
import { db } from './db.js';

/**
 * Merchant webhooks, signed like Stripe's so any backend can verify them:
 *   Zeeto-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, `${t}.${rawBody}`)>
 * Events: payment.succeeded, payment.refunded. Delivered once with a 5 s timeout and logged; the merchant can
 * always re-read the order with their API key, and the onchain event is the final record.
 */
export type WebhookEvent = 'payment.succeeded' | 'payment.refunded';

export const newSecret = (prefix: string) => `${prefix}${randomBytes(24).toString('hex')}`;
export const hashKey = (k: string) => createHash('sha256').update(k).digest('hex');

export function sign(secret: string, body: string, t = Math.floor(Date.now() / 1000)) {
  return `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;
}

export async function deliver(vendorId: string, event: WebhookEvent, data: Record<string, unknown>) {
  const v = (await db().from('vendors').select('webhook_url, webhook_secret').eq('id', vendorId).maybeSingle()).data as { webhook_url: string | null; webhook_secret: string | null } | null;
  if (!v?.webhook_url || !v.webhook_secret) return;
  const body = JSON.stringify({ id: `evt_${randomBytes(8).toString('hex')}`, type: event, created: Math.floor(Date.now() / 1000), data });
  let status = 0;
  try {
    const r = await fetch(v.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Zeeto-Signature': sign(v.webhook_secret, body), 'User-Agent': 'Zeeto-Webhooks/1' },
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(5000),
    });
    status = r.status;
  } catch (e) {
    console.error('[webhook]', vendorId, (e as Error).message);
  }
  await db().from('webhook_log').insert({ vendor_id: vendorId, event, status, body: body.slice(0, 4000) });
}

/** Only public https URLs (no localhost or private networks), so webhooks can't be aimed at internal services. */
export function safeWebhookUrl(u: string): string {
  let url: URL;
  try { url = new URL(u); } catch { throw new Error('Webhook URL is not valid.'); }
  if (url.protocol !== 'https:') throw new Error('Webhook URL must start with https://');
  const h = url.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[)/.test(h) || /^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    throw new Error('Webhook URL must be a public domain.');
  }
  return url.toString();
}

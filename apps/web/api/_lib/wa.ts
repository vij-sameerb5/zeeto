import { createHmac, timingSafeEqual } from 'node:crypto';
import { env, has } from './env.js';

const GRAPH = 'https://graph.facebook.com/v21.0';

/** Meta signs every webhook with the app secret. Reject anything that doesn't match, so no one can fake a message. */
export function signedByMeta(raw: string, header: string | undefined): boolean {
  if (!env.waAppSecret || !header?.startsWith('sha256=')) return false;
  const want = Buffer.from(createHmac('sha256', env.waAppSecret).update(raw).digest('hex'));
  const got = Buffer.from(header.slice(7));
  return want.length === got.length && timingSafeEqual(want, got);
}

const digits = (phone: string) => phone.replace(/\D/g, '');

async function send(to: string, payload: Record<string, unknown>) {
  if (!has.whatsapp || !to) return false;
  try {
    const r = await fetch(`${GRAPH}/${env.waPhoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.waToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: digits(to), ...payload }),
    });
    if (!r.ok) console.error('[wa] send', r.status, (await r.text()).slice(0, 300));
    return r.ok;
  } catch (e) {
    console.error('[wa] send', (e as Error).message);
    return false;
  }
}

export const waText = (to: string, text: string) => send(to, { type: 'text', text: { body: text.slice(0, 4000), preview_url: false } });

/** A message with one tappable button that opens a Zeeto link (pay, order). */
export const waLink = (to: string, text: string, button: string, url: string) =>
  send(to, { type: 'interactive', interactive: { type: 'cta_url', body: { text: text.slice(0, 1000) }, action: { name: 'cta_url', parameters: { display_text: button.slice(0, 20), url } } } });

export const site = (path: string) => `${env.siteUrl}${path}`;

/** Downloads a photo someone sent us (two steps: ask Meta for a short-lived URL, then fetch it with our token). Max 4 MB. */
export async function waMedia(id: string): Promise<{ mime: string; b64: string } | null> {
  if (!has.whatsapp || !/^\d{5,30}$/.test(id)) return null;
  try {
    const auth = { Authorization: `Bearer ${env.waToken}` };
    const meta = await fetch(`${GRAPH}/${id}`, { headers: auth, signal: AbortSignal.timeout(10_000) });
    if (!meta.ok) return null;
    const m = await meta.json() as { url?: string; mime_type?: string; file_size?: number };
    const mime = String(m.mime_type ?? '').split(';')[0];
    if (!m.url || !/^image\/(jpeg|png|webp)$/.test(mime) || (m.file_size ?? 0) > 4_000_000) return null;
    const u = new URL(m.url);
    if (u.protocol !== 'https:' || !/(^|\.)(fbsbx\.com|facebook\.com|whatsapp\.net)$/.test(u.hostname)) return null; // only Meta's own hosts
    const bin = await fetch(u, { headers: auth, signal: AbortSignal.timeout(15_000) });
    if (!bin.ok) return null;
    const buf = Buffer.from(await bin.arrayBuffer());
    return buf.length > 4_000_000 ? null : { mime, b64: buf.toString('base64') };
  } catch (e) {
    console.error('[wa] media', (e as Error).message);
    return null;
  }
}

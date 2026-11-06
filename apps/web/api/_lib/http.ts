import type { VercelRequest, VercelResponse } from '@vercel/node';

/** An error whose message is safe to show the user. Anything else becomes a generic 500. */
export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}
export const bad = (msg: string, code?: string) => new HttpError(400, msg, code);
export const deny = (msg = 'Not allowed.') => new HttpError(403, msg);
export const missing = (msg = 'Not found.') => new HttpError(404, msg);
export const off = (what: string) => new HttpError(503, `${what} isn’t set up on the server yet.`, 'not-configured');

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<unknown>;

/** Wraps a route: method check, JSON errors, no caching of private data, best-effort rate limit per IP. */
export function route(methods: string[], h: Handler, opts: { perMinute?: number } = {}) {
  return async (req: VercelRequest, res: VercelResponse) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!methods.includes(req.method ?? '')) { res.setHeader('Allow', methods.join(', ')); return res.status(405).json({ error: 'Method not allowed' }); }
    if (!limit(req, opts.perMinute ?? 120)) return res.status(429).json({ error: 'Too many requests. Wait a minute.' });
    try {
      const out = await h(req, res);
      if (!res.headersSent) res.status(200).json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return res.status(e.status).json({ error: e.message, code: e.code });
      console.error('[api]', req.url, e);
      return res.status(500).json({ error: 'Something went wrong on our side. Nothing was charged. Try again.' });
    }
  };
}

const hits = new Map<string, { n: number; t: number }>();
/** In-memory, per server instance. Good enough to stop a runaway loop; not a security boundary. */
function limit(req: VercelRequest, perMinute: number) {
  const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'local';
  const key = `${ip}:${req.url?.split('?')[0]}`;
  const now = Date.now();
  const h = hits.get(key);
  if (!h || now - h.t > 60_000) { hits.set(key, { n: 1, t: now }); return true; }
  h.n += 1;
  return h.n <= perMinute;
}

export function body<T = Record<string, unknown>>(req: VercelRequest): T {
  const b = req.body;
  if (b && typeof b === 'object') return b as T;
  if (typeof b === 'string' && b) { try { return JSON.parse(b) as T; } catch { throw bad('Invalid JSON.'); } }
  return {} as T;
}

export const str = (v: unknown, max = 200, min = 0): string => {
  if (typeof v !== 'string') throw bad('Missing text field.');
  const s = v.trim();
  if (s.length < min || s.length > max) throw bad(`Text must be ${min}–${max} characters.`);
  return s;
};
export const optStr = (v: unknown, max = 200) => (v == null || v === '' ? undefined : str(v, max));
export const int = (v: unknown, min: number, max: number): number => {
  const n = Number(v);
  if (!Number.isFinite(n) || Math.round(n) !== n || n < min || n > max) throw bad(`Number must be a whole number from ${min} to ${max}.`);
  return n;
};
export const isAddr = (v: unknown): v is `0x${string}` => typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v);
export const isHash = (v: unknown): v is `0x${string}` => typeof v === 'string' && /^0x[0-9a-fA-F]{64}$/.test(v);

/** A media value: a bundled media key, an https URL, or a small uploaded image. Nothing else (no javascript:, no huge blobs). */
export const media = (v: unknown, maxData = 200_000): string | undefined => {
  if (v == null || v === '') return undefined;
  if (typeof v !== 'string') throw bad('Bad image.');
  if (/^[a-z0-9-]{1,40}$/.test(v)) return v;
  if (/^https:\/\/[^\s"'<>]{1,500}$/.test(v)) return v;
  if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length <= maxData) return v;
  throw bad('Images must be JPEG/PNG/WebP under ~150 KB, or a link.');
};


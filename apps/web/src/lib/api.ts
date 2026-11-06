import { create } from 'zustand';

/**
 * The Zeeto server (apps/web/api, Vercel functions). When it's reachable and has a database, real stalls,
 * orders and payments live there and every device sees the same thing. When it isn't (plain `vite` dev,
 * no keys yet), the app runs on its built-in demo data exactly as before.
 */
export type Features = { auth: boolean; db: boolean; checkout: boolean; relay: boolean; ai: boolean; uniswap: boolean; whatsapp: boolean };

export const useServer = create<{ status: 'checking' | 'on' | 'off'; features: Partial<Features>; relayer: string | null }>(() => ({ status: 'checking', features: {}, relayer: null }));

/** Is the shared backend live (database + sign-in)? */
export const serverOn = () => useServer.getState().status === 'on';
export const feature = (k: keyof Features) => serverOn() && !!useServer.getState().features[k];

export async function checkServer() {
  try {
    const r = await fetch('/api/health', { signal: AbortSignal.timeout(5000) });
    const j = r.ok && (r.headers.get('content-type') ?? '').includes('json') ? await r.json() : null;
    const f = (j?.features ?? {}) as Partial<Features>;
    useServer.setState({ status: j?.ok && f.db && f.auth ? 'on' : 'off', features: f, relayer: j?.relayer ?? null });
  } catch {
    useServer.setState({ status: 'off', features: {} });
  }
}

let getToken: () => Promise<string | null> = async () => null;
/** The auth layer hands us Privy's access-token getter. */
export const setTokenGetter = (f: () => Promise<string | null>) => { getToken = f; };

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}

export async function api<T = unknown>(path: string, init: { method?: 'GET' | 'POST'; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  if (init.auth !== false) {
    const t = await getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  let r: Response;
  try {
    r = await fetch(path, { method: init.method ?? (init.body !== undefined ? 'POST' : 'GET'), headers, body: init.body !== undefined ? JSON.stringify(init.body) : undefined });
  } catch {
    throw new ApiError('No connection. Check your internet and try again.', 0);
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(j.error ?? `Request failed (${r.status}).`, r.status, j.code);
  return j as T;
}

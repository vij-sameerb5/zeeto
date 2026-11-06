import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, has } from './env.js';
import { HttpError, off } from './http.js';

let client: SupabaseClient | null = null;

/** Service-role client. Server only: it bypasses row level security. */
export function db(): SupabaseClient {
  if (!has.db) throw off('Database (SUPABASE_URL / SUPABASE_SECRET_KEY)');
  client ??= createClient(env.supabaseUrl, env.supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

/** Throws a clean error instead of leaking database details. */
export function check<T>(r: { data: T; error: { message: string; code?: string } | null }, what = 'Database'): T {
  if (r.error) {
    console.error(`[db] ${what}:`, r.error.message);
    if (r.error.code === '23505') throw new HttpError(409, 'That already exists.');
    throw new HttpError(500, `${what} error. Try again.`);
  }
  return r.data;
}

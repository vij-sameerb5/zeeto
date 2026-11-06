import type { VercelRequest } from '@vercel/node';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { privateKeyToAccount } from 'viem/accounts';
import { db } from './db.js';
import { env, has } from './env.js';
import { HttpError, off } from './http.js';

export interface Me {
  id: string;            // did:privy:...
  address: `0x${string}`; // their Privy embedded wallet, or the MetaMask wallet they signed in with
  label: string;          // masked phone/email
  phone: string | null;
  admin: boolean;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
const cache = new Map<string, { me: Me; t: number }>();

/** The relayer pays gas for everyone, so it must never also be someone's account (it would pay and refund itself). */
let relayer: string | null | undefined;
const relayerAddress = () => {
  if (relayer === undefined) { try { relayer = has.relay ? privateKeyToAccount(env.relayerKey as `0x${string}`).address.toLowerCase() : null; } catch { relayer = null; } }
  return relayer;
};

const mask = (s: string) => (s.startsWith('+') ? `${s.slice(0, 5)}•••• ${s.slice(-4)}` : s.replace(/^(.).+(@.+)$/, '$1•••$2'));

/**
 * Who is calling. Verifies the Privy access token (signature, issuer, audience, expiry) against Privy's public keys,
 * then reads the user's wallet from Privy with the app secret. The wallet always comes from Privy, never from the request,
 * so nobody can make a payout or refund go to an address they don't own.
 */
export async function requireUser(req: VercelRequest): Promise<Me> {
  if (!has.auth) throw off('Sign-in');
  const token = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Sign in first.');
  jwks ??= createRemoteJWKSet(new URL(`https://auth.privy.io/api/v1/apps/${env.privyAppId}/jwks.json`));
  let sub: string;
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer: 'privy.io', audience: env.privyAppId });
    sub = String(payload.sub);
  } catch {
    throw new HttpError(401, 'Your sign-in expired. Sign in again.');
  }

  const hit = cache.get(sub);
  if (hit && Date.now() - hit.t < 5 * 60_000) return hit.me;
  if (!env.privySecret) throw off('Privy server key (PRIVY_APP_SECRET)');

  const r = await fetch(`https://auth.privy.io/api/v1/users/${encodeURIComponent(sub)}`, {
    headers: { 'privy-app-id': env.privyAppId, Authorization: `Basic ${Buffer.from(`${env.privyAppId}:${env.privySecret}`).toString('base64')}` },
  });
  if (!r.ok) throw new HttpError(401, 'We couldn’t load your account. Sign in again.');
  const u = await r.json() as { linked_accounts?: Array<Record<string, unknown>> };
  const accounts = u.linked_accounts ?? [];
  const wallet = accounts.find((a) => a.type === 'wallet' && a.wallet_client_type === 'privy' && (a.chain_type ?? 'ethereum') === 'ethereum')
    ?? accounts.find((a) => a.type === 'wallet' && (a.chain_type ?? 'ethereum') === 'ethereum');
  const phone = accounts.find((a) => a.type === 'phone');
  const email = accounts.find((a) => a.type === 'email');
  const address = wallet?.address as `0x${string}` | undefined;
  if (!address) throw new HttpError(409, 'Your wallet is still being created. Try again in a moment.');
  if (address.toLowerCase() === relayerAddress()) throw new HttpError(403, 'That wallet pays Zeeto’s gas. Sign in with a different wallet, phone or email.');
  const rawPhone = (phone?.number ?? phone?.phoneNumber ?? null) as string | null;
  const rawEmail = (email?.address ?? null) as string | null;
  // Admins can be listed by Privy id, phone, email or wallet address (ADMIN_USERS). Checked here, on the server, every time.
  const handles = [sub, rawPhone, rawEmail, address].filter(Boolean).map((x) => String(x).toLowerCase());
  const me: Me = {
    id: sub,
    address,
    label: rawPhone ? mask(rawPhone) : rawEmail ? mask(rawEmail) : `${address.slice(0, 6)}…${address.slice(-4)}`,
    phone: rawPhone ? rawPhone.replace(/[^\d+]/g, '') : null,
    admin: env.admins.some((a) => handles.includes(a)),
  };
  cache.set(sub, { me, t: Date.now() });
  if (has.db) {
    await db().from('users').upsert({ privy_id: me.id, address: me.address, label: me.label, phone: me.phone, seen_at: new Date().toISOString() }, { onConflict: 'privy_id' });
  }
  return me;
}

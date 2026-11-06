import { requireUser } from './_lib/auth.js';
import { relayerStatus } from './_lib/chain.js';
import { check, db } from './_lib/db.js';
import { env, has } from './_lib/env.js';
import { bad, body, deny, route, str } from './_lib/http.js';
import { toOrder, type OrderRow } from './_lib/orders.js';

/**
 * Admin dashboard data. Only accounts listed in ADMIN_USERS (server env) get in; the browser can't grant itself admin.
 * GET: overview, users, stalls, recent orders, relayer health and gas spent. POST: verify / suspend / reopen a stall, set a role.
 */
export default route(['GET', 'POST'], async (req) => {
  const me = await requireUser(req);
  if (!me.admin) throw deny('Admins only.');

  if (req.method === 'POST') {
    const b = body<{ action?: string; id?: string; role?: string }>(req);
    const id = str(b.id, 60);
    if (b.action === 'verify' || b.action === 'unverify') check(await db().from('vendors').update({ verified: b.action === 'verify' }).eq('id', id), 'Stall');
    else if (b.action === 'suspend') check(await db().from('vendors').update({ status: 'suspended' }).eq('id', id), 'Stall');
    else if (b.action === 'reopen') check(await db().from('vendors').update({ status: 'live' }).eq('id', id), 'Stall');
    else if (b.action === 'role') {
      if (!['customer', 'merchant', 'admin'].includes(String(b.role))) throw bad('Unknown role.');
      check(await db().from('users').update({ role: b.role }).eq('privy_id', id), 'User');
    } else throw bad('Unknown action.');
    return { ok: true };
  }

  const day = new Date(Date.now() - 24 * 3600_000).toISOString();
  const [users, stalls, orders, relays, hooks, relayer] = await Promise.all([
    db().from('users').select('privy_id, label, role, address, created_at, seen_at').order('created_at', { ascending: false }).limit(300),
    db().from('vendors').select('id, owner_id, wallet, data, status, verified, created_at, api_key_prefix, webhook_url').order('created_at', { ascending: false }).limit(300),
    db().from('orders').select('*').neq('status', 'expired').order('created_at', { ascending: false }).limit(300),
    db().from('relay_log').select('kind, gas_wei, at, vendor_id, tx_hash').gte('at', day).order('at', { ascending: false }).limit(500),
    db().from('webhook_log').select('vendor_id, event, status, at').order('at', { ascending: false }).limit(50),
    relayerStatus(),
  ]);
  const os = (check(orders, 'Orders') as OrderRow[]).map(toOrder);
  const paid = os.filter((o) => o.status !== 'paying');
  const gas = (relays.data ?? []) as { kind: string; gas_wei: string; at: string; vendor_id: string; tx_hash: string }[];
  return {
    features: has,
    checkout: has.checkout ? env.checkout : null,
    relayer,
    limits: { minInr: env.relayMinInr, userPerDay: env.relayUserPerDay, stallPerDay: env.relayStallPerDay, dailyGasWbt: env.relayDailyGasWbt, maxGwei: env.relayMaxGwei },
    overview: {
      gmvInr: paid.reduce((s, o) => s + o.inr, 0),
      orders: paid.length,
      refundsUsdt: paid.reduce((s, o) => s + (o.refunds as { amount: number }[]).reduce((a, r) => a + Number(r.amount), 0), 0),
      gasToday: { txs: gas.length, wbt: gas.reduce((s, r) => s + Number(r.gas_wei) / 1e18, 0) },
    },
    users: users.data ?? [],
    stalls: (stalls.data ?? []).map((v: Record<string, unknown>) => ({ ...v, name: (v.data as { name?: string })?.name, data: undefined })),
    orders: os,
    relays: gas.slice(0, 50),
    webhooks: hooks.data ?? [],
  };
}, { perMinute: 60 });

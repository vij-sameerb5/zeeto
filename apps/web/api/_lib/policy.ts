import type { Hex } from 'viem';
import { db } from './db.js';
import { env } from './env.js';
import { HttpError } from './http.js';

/**
 * What stops anyone draining the relayer (it pays WBT gas for every gasless payment and refund):
 *  1. It only ever submits intents this server issued for an order it created, signed by that order's own customer
 *     (or, for refunds, by the stall's owner). Random signatures are rejected before any gas is spent.
 *  2. Every call is simulated first; a payment that would fail costs nothing.
 *  3. Minimum order (RELAY_MIN_INR) so dust orders can't burn gas.
 *  4. Per-customer and per-stall daily caps (RELAY_USER_PER_DAY, RELAY_STALL_PER_DAY).
 *  5. A global daily gas budget (RELAY_DAILY_GAS_WBT). When it's spent, payments still work: customers submit
 *     themselves, so a drain attempt can only ever cost one day's budget.
 *  6. A gas-price ceiling (RELAY_MAX_GWEI) so a fee spike can't empty it.
 *  7. The relayer holds only WBT for gas (never USDT): the contract moves the money, not the relayer.
 * Every relayed transaction is logged with its gas cost and the stall it was for, so the business side can see and
 * be billed for exactly what it covered.
 */
const since = () => new Date(Date.now() - 24 * 3600_000).toISOString();

export async function allowRelay(o: { customer_id: string; vendor_id: string; inr: number }, kind: 'pay' | 'refund') {
  if (kind === 'pay' && o.inr < env.relayMinInr) throw new HttpError(400, `Orders under ₹${env.relayMinInr} can’t be paid gas-free.`, 'below-min');
  const [user, stall, gas] = await Promise.all([
    db().from('relay_log').select('id', { count: 'exact', head: true }).eq('user_id', o.customer_id).eq('kind', 'pay').gte('at', since()),
    db().from('relay_log').select('id', { count: 'exact', head: true }).eq('vendor_id', o.vendor_id).gte('at', since()),
    db().from('relay_log').select('gas_wei').gte('at', since()).limit(5000),
  ]);
  if (kind === 'pay' && (user.count ?? 0) >= env.relayUserPerDay) throw new HttpError(429, 'You’ve hit today’s limit of gas-free payments.', 'user-cap');
  if ((stall.count ?? 0) >= env.relayStallPerDay) throw new HttpError(429, 'This stall hit today’s limit of gas-free payments.', 'stall-cap');
  const spent = (gas.data ?? []).reduce((s, r: { gas_wei: string | number }) => s + BigInt(String(r.gas_wei ?? 0)), 0n);
  if (spent >= BigInt(Math.floor(env.relayDailyGasWbt * 1e18))) throw new HttpError(503, 'Gas-free payments are paused for today.', 'budget');
}

export async function logRelay(r: { kind: 'pay' | 'refund'; order_id: string; user_id: string; vendor_id: string; tx_hash: Hex; gas_wei: bigint }) {
  await db().from('relay_log').insert({ ...r, gas_wei: r.gas_wei.toString() });
}

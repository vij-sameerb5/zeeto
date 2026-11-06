import type { Hex } from 'viem';
import type { Settled } from './chain.js';
import { check, db } from './db.js';
import { HttpError, missing } from './http.js';
import { pointsFor, WHITECHAIN } from './shared.js';
import { site, waLink, waText } from './wa.js';
import { deliver } from './webhooks.js';
import { env } from './env.js';

export interface VendorRow { id: string; owner_id: string; wallet: Hex; data: Record<string, unknown>; wa_phone: string | null; status: string; verified: boolean; created_at: string; webhook_url?: string | null; api_key_prefix?: string | null }
export interface ProductRow { id: string; vendor_id: string; data: Record<string, unknown>; price_inr: number; stock: number; active: boolean }
export interface OrderRow {
  id: string; vendor_id: string; customer_id: string; customer: string; payer: Hex; code: string;
  lines: { productId: string; name: string; unit: string; qty: number; priceInr: number }[];
  inr: number; usd: number; amount: string; order_ref: Hex; status: string; counter: boolean; request_id: string | null;
  cancel_asked: boolean; arrived_at: string | null; payment: Record<string, unknown> | null; refunds: Record<string, unknown>[];
  tx_hash: string | null; gas_wei: string | null; created_at: string;
}

/** What the app's Vendor type expects. Wallet and owner come from columns the API controls, never from `data`. */
export const toVendor = (v: VendorRow) => ({
  ...v.data,
  id: v.id,
  wallet: v.wallet,
  ownerId: v.owner_id,
  payoutReal: true,
  verified: v.verified,
  rails: ['streetpay-usdt', 'uniswap-usdc'],
  closed: v.status !== 'live',
  suspended: v.status === 'suspended',
});

export const toProduct = (p: ProductRow) => ({ ...p.data, id: p.id, vendorId: p.vendor_id, priceInr: p.price_inr, stock: Number(p.stock) });

export const toOrder = (o: OrderRow) => ({
  id: o.id,
  code: o.code,
  customer: o.customer,
  vendorId: o.vendor_id,
  lines: o.lines,
  inr: o.inr,
  usd: Number(o.usd),
  amount: o.amount,
  orderRef: o.order_ref,
  status: o.status,
  at: o.created_at,
  payment: o.payment ?? undefined,
  refunds: o.refunds ?? [],
  points: o.status === 'paying' ? 0 : pointsFor(o.inr),
  payer: o.payer,
  counter: o.counter,
  arrivedAt: o.arrived_at ?? undefined,
  cancelAsked: o.cancel_asked,
  server: true,
});

export async function getVendor(id: string): Promise<VendorRow> {
  const v = check(await db().from('vendors').select('*').eq('id', id).maybeSingle(), 'Stall') as VendorRow | null;
  if (!v) throw missing('Stall not found.');
  return v;
}

export async function getOrder(id: string): Promise<OrderRow> {
  const o = check(await db().from('orders').select('*').eq('id', id).maybeSingle(), 'Order') as OrderRow | null;
  if (!o) throw missing('Order not found.');
  return o;
}

/**
 * Moves an order only if it's still in one of `from`. The status check is in the UPDATE itself,
 * so two taps (or two devices) can't both win: the second one gets a 409.
 */
export async function transition(id: string, from: string[], patch: Partial<OrderRow>): Promise<OrderRow> {
  const r = check(await db().from('orders').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).in('status', from).select('*'), 'Order') as OrderRow[];
  if (!r.length) throw new HttpError(409, 'This order has already moved on. Refresh to see where it is.', 'stale');
  return r[0];
}

/** Explorer link for a transaction (receipt the customer and the accountant can check). */
export const txUrl = (h: string) => `${WHITECHAIN.explorer}/tx/${h}`;

/**
 * Payment verified onchain (the contract's Paid event): mark paid (or done for a counter sale), take stock,
 * notify both sides, and fire the merchant's webhook. Idempotent: a retry returns the order as it is.
 */
export async function settle(o: OrderRow, s: Settled, gasless: boolean): Promise<OrderRow> {
  const usd = Number(s.amount) / 1e6;
  const payment = {
    rail: 'streetpay-usdt', paidToken: 'USDT', paidAmount: usd, settled: usd, settledToken: 'USDT', chainId: WHITECHAIN.id,
    tx: s.hash, at: new Date().toISOString(), simulated: false, from: s.from, to: s.to, block: s.block, memo: o.order_ref,
    gasless, gasWei: s.gasWei.toString(), contract: env.checkout,
  };
  let row: OrderRow;
  try {
    row = await transition(o.id, ['paying', 'expired'], { status: o.counter ? 'done' : 'paid', payment, tx_hash: s.hash, gas_wei: gasless ? s.gasWei.toString() : null });
  } catch (e) {
    if (e instanceof HttpError && e.code === 'stale') return getOrder(o.id);
    throw e;
  }

  if (o.request_id) await db().from('pay_requests').update({ status: 'paid', order_id: o.id }).eq('id', o.request_id).eq('status', 'open');

  for (const l of o.lines) {
    if (l.productId === 'counter') continue;
    const p = (await db().from('products').select('stock').eq('id', l.productId).maybeSingle()).data as { stock: number } | null;
    if (p) await db().from('products').update({ stock: Math.max(0, Number(p.stock) - l.qty), updated_at: new Date().toISOString() }).eq('id', l.productId);
  }

  const reference = o.request_id ? ((await db().from('pay_requests').select('reference').eq('id', o.request_id).maybeSingle()).data as { reference: string | null } | null)?.reference ?? null : null;
  await Promise.all([
    notifyPaid(row),
    deliver(o.vendor_id, 'payment.succeeded', { order_id: o.id, reference, amount_inr: o.inr, amount_usdt: usd.toFixed(2), payer: s.from, tx_hash: s.hash, explorer_url: txUrl(s.hash), order_ref: o.order_ref, gasless }),
  ]);
  return row;
}

async function notifyPaid(o: OrderRow) {
  const v = (await db().from('vendors').select('data, wa_phone').eq('id', o.vendor_id).maybeSingle()).data as { data: { name?: string }; wa_phone: string | null } | null;
  const items = o.lines.map((l) => `${l.qty} ${l.unit} ${l.name}`).join(', ');
  if (v?.wa_phone) {
    await waLink(v.wa_phone,
      `New ${o.counter ? 'counter payment' : 'order'} ✅ ₹${o.inr} paid by ${o.customer}\n${items}\nCode: ${o.code}${o.counter ? '' : '\nReply "accept ' + o.code + '" or open your orders.'}`,
      'Open orders', site('/sell/orders'));
  }
  const c = (await db().from('users').select('phone').eq('privy_id', o.customer_id).maybeSingle()).data as { phone: string | null } | null;
  if (c?.phone) await waLink(c.phone, `Paid ₹${o.inr} to ${v?.data?.name ?? 'the stall'} ✅\nYour pickup code is ${o.code}. Say it at the stall.`, 'View order', site(`/orders/${o.id}`));
}

export async function notifyCustomer(o: OrderRow, text: string) {
  const c = (await db().from('users').select('phone').eq('privy_id', o.customer_id).maybeSingle()).data as { phone: string | null } | null;
  if (c?.phone) await waText(c.phone, text);
}
export async function notifyStall(o: OrderRow, text: string) {
  const v = (await db().from('vendors').select('wa_phone').eq('id', o.vendor_id).maybeSingle()).data as { wa_phone: string | null } | null;
  if (v?.wa_phone) await waText(v.wa_phone, text);
}

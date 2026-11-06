import type { Hex } from 'viem';
import { requireUser, type Me } from './_lib/auth.js';
import { checkSignature, findPaid, payIntent, refundIntent, relay, verifySubmitted, type Intent } from './_lib/chain.js';
import { check, db } from './_lib/db.js';
import { has } from './_lib/env.js';
import { bad, body, deny, HttpError, int, isHash, route, str } from './_lib/http.js';
import { getOrder, getVendor, notifyCustomer, notifyStall, settle, toOrder, transition, txUrl, type OrderRow, type ProductRow, type VendorRow } from './_lib/orders.js';
import { allowRelay, logRelay } from './_lib/policy.js';
import { MAX_ORDER_INR, newId, orderRef, pickupCode, toUsd, units } from './_lib/shared.js';
import { deliver } from './_lib/webhooks.js';

/** An unpaid order holds its price this long; after that the customer starts again. */
const PAY_WINDOW_MS = 30 * 60_000;
const MIN_ORDER_INR = 1;

type B = Record<string, unknown> & { action?: string; orderId?: string };

/**
 * Order lifecycle (each step only from the one before it; the status check is inside the UPDATE):
 *   paying → paid → accepted → ready → done          (a counter / checkout payment goes paying → done)
 *   paid (customer asked to cancel) → refunded        (stall can only refund, not accept)
 *   paid | accepted | ready | done → part-refunded | refunded   (stall-initiated, capped onchain)
 * Customers can: create, pay, arrived, cancel (only while 'paid'). Stalls can: accept, packed, handover, refund.
 */
export default route(['GET', 'POST'], async (req) => {
  const me = await requireUser(req);

  if (req.method === 'GET') {
    const mine = check(await db().from('orders').select('*').eq('customer_id', me.id).neq('status', 'expired').order('created_at', { ascending: false }).limit(50), 'Orders') as OrderRow[];
    const stall = (await db().from('vendors').select('id').eq('owner_id', me.id).maybeSingle()).data as { id: string } | null;
    const incoming = stall
      ? check(await db().from('orders').select('*').eq('vendor_id', stall.id).not('status', 'in', '("paying","expired")').order('created_at', { ascending: false }).limit(200), 'Orders') as OrderRow[]
      : [];
    // For the stall: how many times each customer has paid here (oldest first, so each order shows "visit n").
    const PAID = ['paid', 'accepted', 'ready', 'done', 'part-refunded'];
    const seen = new Map<string, number>();
    const visit = new Map<string, number>();
    for (const o of [...incoming].reverse()) {
      if (!PAID.includes(o.status)) continue;
      const n = (seen.get(o.customer_id) ?? 0) + 1;
      seen.set(o.customer_id, n);
      visit.set(o.id, n);
    }
    return { mine: mine.map(toOrder), stall: incoming.map((o) => ({ ...toOrder(o), visits: visit.get(o.id) ?? seen.get(o.customer_id) ?? 0 })), stallId: stall?.id ?? null };
  }

  const b = body<B>(req);
  switch (b.action) {
    case 'create': return create(me, b);
    case 'pay': return pay(me, b);
    case 'intent': return retryIntent(me, b);
    case 'arrived': return customerStep(me, b, ['paid', 'accepted', 'ready'], { arrived_at: new Date().toISOString() }, 'is at the stall');
    case 'cancel': return customerStep(me, b, ['paid'], { cancel_asked: true }, 'asked to cancel. Please refund');
    case 'accept': return stallStep(me, b, 'accept');
    case 'packed': return stallStep(me, b, 'packed');
    case 'handover': return stallStep(me, b, 'handover');
    case 'refund': return refund(me, b);
    default: throw bad('Unknown action.');
  }
}, { perMinute: 90 });

/**
 * Prices come from the database, never from the request: the app sends product ids and quantities only.
 * Kinds: a bag (lines), a typed amount at the counter (amountInr), or a bill / checkout session (requestId).
 */
async function create(me: Me, b: B) {
  let v: VendorRow;
  let lines: OrderRow['lines'];
  let counter = false;
  let requestId: string | null = null;

  if (typeof b.requestId === 'string') {
    const r = (await db().from('pay_requests').select('*').eq('id', b.requestId).maybeSingle()).data as { id: string; vendor_id: string; inr: number; lines: OrderRow['lines']; status: string; expires_at: string } | null;
    if (!r || r.status !== 'open') throw bad('This bill is already paid or cancelled.');
    if (Date.parse(r.expires_at) < Date.now()) throw bad('This bill expired. Ask for a new one.');
    // One open order per bill and customer: a retry reuses it instead of making another.
    const open = (await db().from('orders').select('*').eq('request_id', r.id).eq('customer_id', me.id).eq('status', 'paying').maybeSingle()).data as OrderRow | null;
    v = await getVendor(r.vendor_id);
    if (open) return { order: toOrder(open), intent: await payIntent(open, v.wallet) };
    lines = r.lines.length ? r.lines : [{ productId: 'counter', name: 'Counter purchase', unit: 'piece', qty: 1, priceInr: r.inr }];
    counter = true;
    requestId = r.id;
  } else {
    v = await getVendor(str(b.vendorId, 48));
    if (b.amountInr != null) {
      const inr = int(b.amountInr, MIN_ORDER_INR, MAX_ORDER_INR);
      lines = [{ productId: 'counter', name: 'Counter purchase', unit: 'piece', qty: 1, priceInr: inr }];
      counter = true;
    } else {
      const want = Array.isArray(b.lines) ? b.lines as { productId?: unknown; qty?: unknown }[] : [];
      if (!want.length || want.length > 30) throw bad('Your bag is empty.');
      const ids = want.map((l) => str(l.productId, 100));
      if (new Set(ids).size !== ids.length) throw bad('Each item once, please.');
      const rows = check(await db().from('products').select('*').in('id', ids).eq('vendor_id', v.id).eq('active', true), 'Products') as ProductRow[];
      lines = want.map((l) => {
        const p = rows.find((x) => x.id === l.productId);
        if (!p) throw bad('Something in your bag is no longer sold. Remove it and try again.');
        const qty = int(l.qty, 1, 100);
        if (qty > Number(p.stock)) throw bad(`Only ${p.stock} ${String(p.data.unit)} of ${String(p.data.name)} left.`);
        return { productId: p.id, name: String(p.data.name), unit: String(p.data.unit), qty, priceInr: p.price_inr };
      });
    }
  }

  if (v.status !== 'live') throw bad(v.status === 'suspended' ? 'This stall isn’t taking payments.' : 'This stall is closed right now.');
  if (v.wallet.toLowerCase() === me.address.toLowerCase()) throw bad('You can’t pay your own stall.');
  const inr = lines.reduce((s, l) => s + l.qty * l.priceInr, 0);
  if (inr < MIN_ORDER_INR || inr > MAX_ORDER_INR) throw bad(`Orders can be ₹${MIN_ORDER_INR} to ₹${MAX_ORDER_INR.toLocaleString('en-IN')}.`);
  const usd = toUsd(inr);
  if (usd < 0.01) throw bad('That amount is too small.');

  // Too many unpaid orders from one person is a sign of abuse; ask them to finish or wait.
  const pending = await db().from('orders').select('id', { count: 'exact', head: true }).eq('customer_id', me.id).eq('status', 'paying').gte('created_at', new Date(Date.now() - PAY_WINDOW_MS).toISOString());
  if ((pending.count ?? 0) >= 5) throw new HttpError(429, 'Finish or wait for your open payments first.');

  // A fresh bag order replaces this person's older unpaid ones at the same stall (each retry used to add one).
  if (!requestId) await db().from('orders').update({ status: 'expired' }).eq('customer_id', me.id).eq('vendor_id', v.id).eq('status', 'paying').is('request_id', null);

  const id = newId('o', 5);
  const row = check(await db().from('orders').insert({
    id, vendor_id: v.id, customer_id: me.id, customer: me.label, payer: me.address, code: pickupCode(), lines, inr, usd,
    amount: units(usd).toString(), order_ref: orderRef(id, v.id), status: 'paying', counter, request_id: requestId,
  }).select('*').single(), 'Order') as OrderRow;
  return { order: toOrder(row), intent: await payIntent(row, v.wallet) };
}

/**
 * Settle an order. Two ways, both through ZeetoCheckout:
 *  - gasless (main flow): the app sends the customer's signature; our relayer submits it and pays the gas.
 *  - self-submitted (fallback when the relayer is off or over budget): the app sent the contract call itself; we verify the receipt.
 */
async function pay(me: Me, b: B) {
  const o = await getOrder(str(b.orderId, 40));
  if (o.customer_id !== me.id) throw deny();
  if (o.status !== 'paying' && o.status !== 'expired') return { order: toOrder(o) }; // already settled: safe to retry
  const v = await getVendor(o.vendor_id);
  const intent = await payIntent(o, v.wallet);

  if (isHash(b.tx)) return { order: toOrder(await settle(o, await verifySubmitted(b.tx, intent), false)) };

  if (o.status === 'expired' || Date.now() - Date.parse(o.created_at) > PAY_WINDOW_MS) {
    await db().from('orders').update({ status: 'expired' }).eq('id', o.id).eq('status', 'paying');
    throw bad('This order expired. Start again from your bag.');
  }
  const { signed, signature } = sigOf(b);
  try {
    await checkSignature(intent, signed, signature);
  } catch (e) {
    // Already used = it's onchain (maybe we never saw the reply last time). Settle from the chain instead of failing.
    if (e instanceof HttpError && e.code === 'already-used') return { order: toOrder(await reconcile(o, intent)) };
    throw e;
  }
  if (!has.relay) throw new HttpError(503, 'Gas-free payments are off. Pay from your wallet instead.', 'relay-off');
  await allowRelay(o, 'pay');
  const s = await relay(intent, signed.validBefore, signature);
  if (s.relayer) await logRelay({ kind: 'pay', order_id: o.id, user_id: o.customer_id, vendor_id: o.vendor_id, tx_hash: s.hash, gas_wei: s.gasWei });
  return { order: toOrder(await settle(o, s, true)) };
}

/** A fresh approval request for an unpaid order (after the customer closed the confirm step, say). */
async function retryIntent(me: Me, b: B) {
  const o = await getOrder(str(b.orderId, 40));
  if (o.customer_id !== me.id) throw deny();
  if (o.status !== 'paying') return { order: toOrder(o) };
  const intent = await payIntent(o, (await getVendor(o.vendor_id)).wallet);
  const done = await findPaid(intent).catch(() => null); // paid already? then there's nothing to sign
  if (done) return { order: toOrder(await settle(o, done, !!done.relayer)) };
  if (Date.now() - Date.parse(o.created_at) > PAY_WINDOW_MS) throw bad('This order expired. Start again from your bag.');
  return { order: toOrder(o), intent };
}

async function reconcile(o: OrderRow, intent: Intent) {
  const s = await findPaid(intent);
  if (!s) return getOrder(o.id);
  if (s.relayer) await logRelay({ kind: 'pay', order_id: o.id, user_id: o.customer_id, vendor_id: o.vendor_id, tx_hash: s.hash, gas_wei: s.gasWei }).catch(() => undefined);
  return settle(o, s, !!s.relayer);
}

function sigOf(b: B): { signed: Intent['message']; signature: Hex } {
  const signed = b.signed as Intent['message'] | undefined;
  const signature = b.signature;
  if (!signed || typeof signed !== 'object' || typeof signature !== 'string' || !/^0x[0-9a-fA-F]{130}$/.test(signature)) throw bad('Missing approval.');
  return { signed, signature: signature as Hex };
}

async function customerStep(me: Me, b: B, from: string[], patch: Partial<OrderRow>, says: string) {
  const o = await getOrder(str(b.orderId, 40));
  if (o.customer_id !== me.id) throw deny();
  const r = await transition(o.id, from, patch);
  await notifyStall(r, `${r.customer} ${says} · order ${r.code}`);
  return { order: toOrder(r) };
}

async function ownStall(me: Me, o: OrderRow) {
  const v = await getVendor(o.vendor_id);
  if (v.owner_id !== me.id) throw deny('Only this stall can do that.');
  return v;
}

async function stallStep(me: Me, b: B, step: 'accept' | 'packed' | 'handover') {
  const o = await getOrder(str(b.orderId, 40));
  const v = await ownStall(me, o);
  const name = String(v.data.name ?? 'The stall');
  if (step === 'accept') {
    if (o.cancel_asked) throw bad('The customer asked to cancel. Refund this order instead.');
    const r = await transition(o.id, ['paid'], { status: 'accepted' });
    await notifyCustomer(r, `${name} accepted your order ${r.code}. They're packing it now.`);
    return { order: toOrder(r) };
  }
  if (step === 'packed') {
    const r = await transition(o.id, ['accepted'], { status: 'ready' });
    await notifyCustomer(r, `Your order is ready at ${name} 🎉 Say your name and code ${r.code} at the stall.`);
    return { order: toOrder(r) };
  }
  const r = await transition(o.id, ['ready', 'accepted'], { status: 'done' });
  await notifyCustomer(r, `Picked up from ${name}. Thanks for shopping local!`);
  return { order: toOrder(r) };
}

/**
 * Refund from the stall's wallet back to the wallet that paid, through the contract (which caps refunds at what was paid
 * and only ever pays the original payer). Step 1 `prepare: true` returns the intent to sign; step 2 sends the signature.
 */
async function refund(me: Me, b: B) {
  const o = await getOrder(str(b.orderId, 40));
  const v = await ownStall(me, o);
  if (!['paid', 'accepted', 'ready', 'done', 'part-refunded'].includes(o.status) || !o.payment) throw bad('This order can’t be refunded.');
  if (me.address.toLowerCase() !== v.wallet.toLowerCase()) throw deny('Refunds go out from the stall owner’s wallet. Sign in as the owner.');
  const paid = BigInt(o.amount);
  const done = (o.refunds ?? []).reduce((s, r) => s + BigInt(String(r.units ?? 0)), 0n);
  const amount = b.usd != null ? units(Number(b.usd)) : paid - done;
  const intent = await refundIntent(o, v.wallet, amount);
  if (b.prepare) return { intent };

  const reason = typeof b.reason === 'string' ? b.reason.trim().slice(0, 80) || 'Refund' : 'Refund';
  let s;
  if (isHash(b.tx)) s = await verifySubmitted(b.tx, intent);
  else {
    const { signed, signature } = sigOf(b);
    await checkSignature(intent, signed, signature);
    if (!has.relay) throw new HttpError(503, 'Gas-free refunds are off. Send it from your wallet instead.', 'relay-off');
    await allowRelay(o, 'refund');
    s = await relay(intent, signed.validBefore, signature);
    if (s.relayer) await logRelay({ kind: 'refund', order_id: o.id, user_id: me.id, vendor_id: o.vendor_id, tx_hash: s.hash, gas_wei: s.gasWei });
  }
  const usd = Number(s.amount) / 1e6;
  const entry = { amount: usd, units: s.amount.toString(), token: 'USDT', reason, tx: s.hash, at: new Date().toISOString(), simulated: false };
  const full = done + s.amount >= paid;
  const r = check(await db().from('orders').update({ refunds: [...(o.refunds ?? []), entry], status: full ? 'refunded' : 'part-refunded', updated_at: new Date().toISOString() }).eq('id', o.id).select('*').single(), 'Order') as OrderRow;
  await Promise.all([
    notifyCustomer(r, `${String(v.data.name ?? 'The stall')} refunded ₹${Math.round(usd * 84)} for order ${r.code}: ${reason}. Receipt: ${txUrl(s.hash)}`),
    deliver(o.vendor_id, 'payment.refunded', { order_id: o.id, amount_usdt: usd.toFixed(2), total_refunded_usdt: (Number(done + s.amount) / 1e6).toFixed(2), reason, tx_hash: s.hash, explorer_url: txUrl(s.hash) }),
  ]);
  return { order: toOrder(r) };
}

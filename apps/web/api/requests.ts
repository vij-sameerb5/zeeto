import { requireUser } from './_lib/auth.js';
import { check, db } from './_lib/db.js';
import { bad, body, deny, int, missing, route, str } from './_lib/http.js';
import { MAX_ORDER_INR, newId, REQUEST_TTL_MS, UNITS } from './_lib/shared.js';

interface Req { id: string; vendor_id: string; inr: number; lines: unknown[]; made_by: string; status: string; order_id: string | null; expires_at: string; created_at: string; reference?: string | null; success_url?: string | null; cancel_url?: string | null }

/** Public view of a bill: amount, items, stall name and wallet. No customer data. */
async function view(r: Req) {
  const v = (await db().from('vendors').select('id, wallet, data').eq('id', r.vendor_id).maybeSingle()).data as { id: string; wallet: string; data: { name?: string; avatar?: string } } | null;
  const expired = r.status === 'open' && Date.parse(r.expires_at) < Date.now();
  return {
    id: r.id, vendorId: r.vendor_id, inr: r.inr, lines: r.lines, by: r.made_by, status: expired ? 'expired' : r.status,
    orderId: r.order_id ?? undefined, createdAt: r.created_at, expiresAt: r.expires_at,
    vendor: v ? { id: v.id, name: v.data.name, avatar: v.data.avatar, wallet: v.wallet } : null,
    // Checkout API sessions: where to send the customer back to, and the store's own reference.
    reference: r.reference ?? undefined, successUrl: r.success_url ?? undefined, cancelUrl: r.cancel_url ?? undefined,
  };
}

/**
 * Bill QR at the counter: the stall rings up an amount, the QR opens /pay/r/<id>, the customer pays it once.
 * GET is public so any phone can open the QR; only the stall owner can create or cancel.
 */
export default route(['GET', 'POST'], async (req) => {
  if (req.method === 'GET') {
    const id = str(req.query.id, 40);
    const r = (await db().from('pay_requests').select('*').eq('id', id).maybeSingle()).data as Req | null;
    if (!r) throw missing('This bill doesn’t exist.');
    return { request: await view(r) };
  }

  const me = await requireUser(req);
  const b = body<{ action?: string; id?: string; vendorId?: string; inr?: number; lines?: { name?: string; unit?: string; qty?: number; priceInr?: number }[] }>(req);
  const stall = (await db().from('vendors').select('id, status').eq('owner_id', me.id).maybeSingle()).data as { id: string; status: string } | null;
  if (!stall) throw deny('Only a stall can make a bill.');

  if (b.action === 'cancel') {
    check(await db().from('pay_requests').update({ status: 'cancelled' }).eq('id', str(b.id, 40)).eq('vendor_id', stall.id).eq('status', 'open'), 'Bill');
    return { ok: true };
  }
  if (stall.status !== 'live') throw bad('Open your stall first.');
  const inr = int(b.inr, 1, MAX_ORDER_INR);
  const lines = (Array.isArray(b.lines) ? b.lines.slice(0, 30) : []).map((l) => ({
    productId: 'counter', name: str(l.name, 60, 1), unit: (UNITS as readonly string[]).includes(String(l.unit)) ? String(l.unit) : 'piece',
    qty: int(l.qty, 1, 100), priceInr: int(l.priceInr, 1, MAX_ORDER_INR),
  }));
  if (lines.length && lines.reduce((s, l) => s + l.qty * l.priceInr, 0) !== inr) throw bad('Items don’t add up to the total.');
  const r = check(await db().from('pay_requests').insert({
    id: newId('r', 8), vendor_id: stall.id, inr, lines, made_by: 'stall', expires_at: new Date(Date.now() + REQUEST_TTL_MS).toISOString(),
  }).select('*').single(), 'Bill') as Req;
  return { request: await view(r) };
}, { perMinute: 60 });

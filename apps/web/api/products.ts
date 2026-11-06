import { requireUser } from './_lib/auth.js';
import { check, db } from './_lib/db.js';
import { bad, body, deny, int, media, optStr, route, str } from './_lib/http.js';
import { toProduct, type ProductRow } from './_lib/orders.js';
import { UNITS } from './_lib/shared.js';

/**
 * Save your stall's full product list (the app sends it after each edit, debounced).
 * Only the stall's owner can write; anything not in the list is hidden, not deleted, so old orders keep their lines.
 */
export default route(['POST'], async (req) => {
  const me = await requireUser(req);
  const b = body<{ vendorId?: string; products?: Record<string, unknown>[] }>(req);
  const vendorId = str(b.vendorId, 48);
  const v = (await db().from('vendors').select('owner_id, status').eq('id', vendorId).maybeSingle()).data as { owner_id: string; status: string } | null;
  if (!v || v.owner_id !== me.id) throw deny('You can only edit your own stall.');
  if (v.status === 'suspended') throw deny('This stall is suspended.');
  if (!Array.isArray(b.products) || b.products.length > 200) throw bad('Send up to 200 products.');

  const now = new Date().toISOString();
  const rows = b.products.map((p) => {
    const id = str(p.id, 100);
    if (!/^[\w:-]+$/.test(id)) throw bad('Bad product id.');
    const unit = str(p.unit, 10);
    if (!(UNITS as readonly string[]).includes(unit)) throw bad('Unknown unit.');
    return {
      id: `${vendorId}:${id.replace(new RegExp(`^${vendorId}:`), '')}`,
      vendor_id: vendorId,
      price_inr: int(p.priceInr, 1, 100000),
      stock: int(Math.round(Number(p.stock)), 0, 10000),
      active: true,
      updated_at: now,
      data: {
        name: str(p.name, 60, 2),
        local: optStr(p.local, 40),
        unit,
        image: media(p.image, 160_000) ?? 'veg-1',
        byAi: !!p.byAi,
        freshUntil: typeof p.freshUntil === 'string' && !Number.isNaN(Date.parse(p.freshUntil)) ? p.freshUntil : undefined,
      },
    };
  });

  if (rows.length) check(await db().from('products').upsert(rows, { onConflict: 'id' }), 'Products');
  const keep = rows.map((r) => r.id);
  let hide = db().from('products').update({ active: false, updated_at: now }).eq('vendor_id', vendorId).eq('active', true);
  if (keep.length) hide = hide.not('id', 'in', `(${keep.map((k) => `"${k}"`).join(',')})`);
  check(await hide, 'Products');
  const all = check(await db().from('products').select('*').eq('vendor_id', vendorId).eq('active', true), 'Products') as ProductRow[];
  return { products: all.map(toProduct) };
}, { perMinute: 60 });

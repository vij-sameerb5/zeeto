import { requireUser } from './_lib/auth.js';
import { check, db } from './_lib/db.js';
import { bad, body, deny, HttpError, media, optStr, route, str } from './_lib/http.js';
import { deliver, hashKey, newSecret, safeWebhookUrl } from './_lib/webhooks.js';
import { toProduct, toVendor, type ProductRow, type VendorRow } from './_lib/orders.js';
import { CATEGORIES } from './_lib/shared.js';

function clean(s: Record<string, unknown>) {
  const loc = s.location as { lat?: unknown; lng?: unknown } | undefined;
  const lat = Number(loc?.lat), lng = Number(loc?.lng);
  if (!(lat >= 6 && lat <= 37 && lng >= 68 && lng <= 98)) throw bad('Pick a location in India.');
  const category = str(s.category, 20);
  if (!(CATEGORIES as readonly string[]).includes(category)) throw bad('Unknown category.');
  const hours = str(s.hours ?? '07:00-21:00', 11);
  if (!/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(hours)) throw bad('Hours look like 07:00-21:00.');
  const photos = Array.isArray(s.photos) ? s.photos.slice(0, 6).map((p) => media(p)).filter(Boolean) : [];
  const youtube = Array.isArray(s.youtube) ? s.youtube.slice(0, 4).map((u) => str(u, 120)).filter((u) => /^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(u)) : [];
  const languages = Array.isArray(s.languages) ? s.languages.slice(0, 6).map((l) => str(l, 20)) : [];
  return {
    name: str(s.name, 40, 2),
    owner: str(s.owner ?? s.name, 40, 1),
    category,
    tagline: optStr(s.tagline, 80) ?? '',
    bio: optStr(s.bio, 400) ?? '',
    location: { lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5 },
    landmark: optStr(s.landmark, 80) ?? '',
    market: optStr(s.market, 60) ?? '',
    hours,
    rating: 5,
    followers: 0,
    languages,
    fresh: !!s.fresh,
    offer: optStr(s.offer, 60),
    avatar: media(s.avatar) ?? 'veg-1',
    cover: media(s.cover) ?? 'veg-2',
    photos,
    youtube,
  };
}

const phone = (v: unknown) => {
  if (v == null || v === '') return null;
  const p = String(v).replace(/[^\d+]/g, '');
  if (!/^\+\d{10,15}$/.test(p)) throw bad('WhatsApp number must include the country code, like +91 98xxxxxxxx.');
  return p;
};

export default route(['GET', 'POST'], async (req) => {
  if (req.method === 'GET') {
    const id = typeof req.query.id === 'string' ? req.query.id : null;
    let q = db().from('vendors').select('id, owner_id, wallet, data, status, verified, created_at').neq('status', 'suspended').order('created_at', { ascending: false }).limit(500);
    if (id) q = q.eq('id', id);
    const vendors = check(await q, 'Stalls') as VendorRow[];
    const ids = vendors.map((v) => v.id);
    const products = ids.length ? check(await db().from('products').select('*').in('vendor_id', ids).eq('active', true).limit(5000), 'Products') as ProductRow[] : [];
    return { vendors: vendors.map(toVendor), products: products.map(toProduct) };
  }

  // Create or update your own stall. Payouts always go to your own Privy wallet.
  const me = await requireUser(req);
  const b = body<{ action?: string; stall?: Record<string, unknown>; open?: boolean; waPhone?: string; url?: string }>(req);
  if (b.action) return developer(me.id, b.action, b.url);
  if (!b.stall || typeof b.stall !== 'object') throw bad('Missing stall.');
  const data = clean(b.stall);
  const existing = (await db().from('vendors').select('*').eq('owner_id', me.id).maybeSingle()).data as VendorRow | null;

  if (existing) {
    if (existing.status === 'suspended') throw deny('This stall is suspended. Contact Zeeto support.');
    const r = check(await db().from('vendors').update({
      data, wallet: me.address, wa_phone: phone(b.waPhone ?? b.stall.waPhone), status: b.open === false ? 'closed' : 'live', updated_at: new Date().toISOString(),
    }).eq('id', existing.id).select('*').single(), 'Stall') as VendorRow;
    return { vendor: toVendor(r) };
  }

  const base = String(b.stall.id ?? data.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 36) || 'stall';
  const id = `${base}-${me.id.slice(-4).toLowerCase().replace(/[^a-z0-9]/g, 'x')}`;
  await db().from('users').update({ role: 'merchant' }).eq('privy_id', me.id).neq('role', 'admin');
  const ins = await db().from('vendors').insert({ id, owner_id: me.id, wallet: me.address, data, wa_phone: phone(b.waPhone ?? b.stall.waPhone), status: 'live' }).select('*').single();
  if (ins.error?.code === '23505') throw new HttpError(409, 'You already have a stall, or that name is taken.');
  return { vendor: toVendor(check(ins, 'Stall') as VendorRow) };
}, { perMinute: 60 });


/**
 * Developer settings for your stall: the secret API key (shown once, stored hashed), the webhook URL and its signing
 * secret, and the last deliveries. Everything a store needs to plug Zeeto Checkout in.
 */
async function developer(ownerId: string, action: string, url?: string) {
  const v = (await db().from('vendors').select('id, api_key_prefix, webhook_url, webhook_secret').eq('owner_id', ownerId).maybeSingle()).data as { id: string; api_key_prefix: string | null; webhook_url: string | null; webhook_secret: string | null } | null;
  if (!v) throw deny('Create your stall first.');
  const out: Record<string, unknown> = {};
  if (action === 'rotate-key') {
    const key = newSecret('zk_test_');
    check(await db().from('vendors').update({ api_key_hash: hashKey(key), api_key_prefix: key.slice(0, 14) }).eq('id', v.id), 'Stall');
    out.apiKey = key; // shown once
    v.api_key_prefix = key.slice(0, 14);
  } else if (action === 'set-webhook') {
    let safe: string | null = null;
    if (url) { try { safe = safeWebhookUrl(url); } catch (e) { throw bad((e as Error).message); } }
    const secret = v.webhook_secret ?? newSecret('whsec_');
    check(await db().from('vendors').update({ webhook_url: safe, webhook_secret: secret }).eq('id', v.id), 'Stall');
    if (!v.webhook_secret) out.webhookSecret = secret; // shown once
    v.webhook_url = safe;
  } else if (action === 'test-webhook') {
    if (!v.webhook_url) throw bad('Add a webhook URL first.');
    await deliver(v.id, 'payment.succeeded', { test: true, order_id: 'o_test', amount_inr: 120, amount_usdt: '1.43' });
  } else if (action !== 'developer') throw bad('Unknown action.');
  const log = (await db().from('webhook_log').select('event, status, at').eq('vendor_id', v.id).order('at', { ascending: false }).limit(10)).data ?? [];
  const gas = (await db().from('relay_log').select('gas_wei, kind').eq('vendor_id', v.id).limit(5000)).data as { gas_wei: string }[] | null;
  const gasWbt = (gas ?? []).reduce((s, r) => s + Number(r.gas_wei) / 1e18, 0);
  return { ...out, stallId: v.id, keyPrefix: v.api_key_prefix, webhookUrl: v.webhook_url, hasWebhookSecret: !!v.webhook_secret, deliveries: log, gasCovered: { wbt: gasWbt, txs: gas?.length ?? 0 } };
}

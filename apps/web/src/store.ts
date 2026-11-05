import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import {
  ALERTS, FOLLOWING, ME, MY_ORDERS, POINTS, PRODUCTS, VENDORS, VENDOR_ORDERS,
  hex, pickupCode, pointsFor, toUsd,
  type AiDraft, type Alert, type Order, type OrderLine, type Payment, type PointsEntry, type Product, type Refund, type Vendor,
} from '@zeeto/core';

/** The vendor account used for the vendor-side demo. */
export const MY_STALL = 'ravi';

const storage: StateStorage = {
  getItem: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  setItem: (k, v) => { try { localStorage.setItem(k, v); } catch { /* blocked */ } },
  removeItem: (k) => { try { localStorage.removeItem(k); } catch { /* blocked */ } },
};

/** A pay-at-the-counter request: the stall rings up an amount, the customer scans and pays. */
export interface PayRequest {
  id: string;
  vendorId: string;
  inr: number;
  lines: OrderLine[];
  /** 'stall' = dynamic QR made by the stall (amount locked); 'customer' = typed after scanning the printed QR. */
  by: 'stall' | 'customer';
  status: 'open' | 'paid' | 'cancelled';
  createdAt: string;
  expiresAt: string;
  orderId?: string;
  payer?: string;
}
export const COUNTER_MAX_INR = 20000;
export const REQUEST_TTL_MS = 5 * 60_000;

export interface ProfileEdit { name?: string; tagline?: string; bio?: string; avatar?: string; cover?: string; photos?: string[]; youtube?: string[]; hours?: string; landmark?: string; waPhone?: string; open?: boolean }

interface S {
  follows: string[];
  liked: string[];
  saved: string[];
  bag: { vendorId: string | null; lines: Record<string, number> };
  products: Product[];
  alerts: Alert[];
  myOrders: Order[];
  stallOrders: Order[];
  points: PointsEntry[];
  edits: Record<string, ProfileEdit>;
  requests: Record<string, PayRequest>;
  /** Admin overrides (demo; the API owns these once Supabase is live). */
  roles: Record<string, 'customer' | 'merchant' | 'admin'>;
  stallFlags: Record<string, { suspended?: boolean; verified?: boolean }>;
  /** Vendor finished onboarding in this browser. */
  onboarded: boolean;
  toast: string | null;

  follow: (vendorId: string) => void;
  like: (postId: string) => void;
  save: (postId: string) => void;
  setQty: (vendorId: string, productId: string, qty: number) => void;
  checkout: () => Order | null;
  paid: (orderId: string, p: Payment) => void;
  accept: (orderId: string) => void;
  packed: (orderId: string) => void;
  handedOver: (orderId: string) => void;
  refunded: (orderId: string, r: Refund, full: boolean) => void;
  toggleStock: (productId: string) => void;
  setPrice: (productId: string, inr: number) => void;
  publish: (vendorId: string, d: AiDraft, image?: string) => void;
  addProduct: (p: Omit<Product, 'id'>) => void;
  setStock: (productId: string, stock: number) => void;
  redeem: (label: string, cost: number, vendorId: string) => boolean;
  editProfile: (vendorId: string, e: ProfileEdit) => void;
  goLive: (vendorId: string, e: ProfileEdit) => void;
  /** Stall or customer opens a counter payment. Returns the request id. */
  openRequest: (vendorId: string, inr: number, lines: OrderLine[], by: PayRequest['by']) => string;
  cancelRequest: (id: string) => void;
  /** Customer starts paying a request: makes the order it settles. */
  counterOrder: (requestId: string) => Order | null;
  /** Payment verified: order is done on the spot (goods handed over at the counter). */
  counterPaid: (requestId: string, orderId: string, p: Payment) => void;
  setRole: (userId: string, role: 'customer' | 'merchant' | 'admin') => void;
  setStallFlag: (vendorId: string, f: { suspended?: boolean; verified?: boolean }) => void;
  say: (msg: string) => void;
  reset: () => void;
}

const fresh = () => ({
  follows: FOLLOWING,
  liked: [] as string[],
  saved: [] as string[],
  bag: { vendorId: null as string | null, lines: {} as Record<string, number> },
  products: PRODUCTS,
  alerts: ALERTS,
  myOrders: MY_ORDERS,
  stallOrders: VENDOR_ORDERS,
  points: POINTS,
  edits: {} as Record<string, ProfileEdit>,
  requests: {} as Record<string, PayRequest>,
  roles: {} as Record<string, 'customer' | 'merchant' | 'admin'>,
  stallFlags: {} as Record<string, { suspended?: boolean; verified?: boolean }>,
  onboarded: false,
  toast: null as string | null,
});

const patch = (list: Order[], id: string, f: (o: Order) => Order) => list.map((o) => (o.id === id ? f(o) : o));
const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

export const useApp = create<S>()(
  persist(
    (set, get) => ({
      ...fresh(),
      follow: (id) => {
        const on = get().follows.includes(id);
        set({ follows: toggle(get().follows, id) });
        get().say(on ? 'Unfollowed' : "Following. You'll hear when fresh stock lands.");
      },
      like: (id) => set({ liked: toggle(get().liked, id) }),
      save: (id) => set({ saved: toggle(get().saved, id) }),
      setQty: (vendorId, productId, qty) => {
        const b = get().bag;
        // One stall per bag: pickup happens at one place.
        const lines = b.vendorId && b.vendorId !== vendorId ? {} : { ...b.lines };
        if (qty <= 0) delete lines[productId];
        else lines[productId] = qty;
        set({ bag: { vendorId: Object.keys(lines).length ? vendorId : null, lines } });
      },
      checkout: () => {
        const { bag, products } = get();
        if (!bag.vendorId) return null;
        const lines = Object.entries(bag.lines).map(([id, qty]) => {
          const p = products.find((x) => x.id === id)!;
          return { productId: id, name: p.name, unit: p.unit, qty, priceInr: p.priceInr };
        });
        const inr = lines.reduce((s, l) => s + l.qty * l.priceInr, 0);
        const o: Order = { id: `o${1100 + Math.floor(Math.random() * 8000)}`, code: pickupCode(), customer: ME.name, vendorId: bag.vendorId, lines, inr, usd: toUsd(inr), status: 'paying', at: new Date().toISOString(), refunds: [], points: 0 };
        set({ myOrders: [o, ...get().myOrders] });
        return o;
      },
      paid: (orderId, payment) => {
        const o = get().myOrders.find((x) => x.id === orderId);
        if (!o) return;
        const pts = pointsFor(o.inr);
        const done: Order = { ...o, status: 'paid', payment, points: pts };
        const v = VENDORS.find((x) => x.id === o.vendorId);
        set({
          myOrders: patch(get().myOrders, orderId, () => done),
          stallOrders: [done, ...get().stallOrders], // demo: the vendor side sees it too
          products: get().products.map((p) => { const l = o.lines.find((x) => x.productId === p.id); return l ? { ...p, stock: Math.max(0, p.stock - l.qty) } : p; }),
          bag: { vendorId: null, lines: {} },
          points: [{ id: `pt-${orderId}`, points: pts, label: `Order at ${v?.name}`, at: new Date().toISOString(), vendorId: o.vendorId }, ...get().points],
        });
      },
      accept: (id) => { const f = (o: Order) => ({ ...o, status: 'accepted' as const }); set({ stallOrders: patch(get().stallOrders, id, f), myOrders: patch(get().myOrders, id, f) }); },
      packed: (id) => { const f = (o: Order) => ({ ...o, status: 'ready' as const }); set({ stallOrders: patch(get().stallOrders, id, f), myOrders: patch(get().myOrders, id, f) }); },
      handedOver: (id) => { const f = (o: Order) => ({ ...o, status: 'done' as const }); set({ stallOrders: patch(get().stallOrders, id, f), myOrders: patch(get().myOrders, id, f) }); },
      refunded: (id, r, full) => {
        const f = (o: Order) => ({ ...o, status: full ? ('refunded' as const) : ('part-refunded' as const), refunds: [...o.refunds, r] });
        set({ stallOrders: patch(get().stallOrders, id, f), myOrders: patch(get().myOrders, id, f) });
      },
      toggleStock: (id) => set({ products: get().products.map((p) => (p.id === id ? { ...p, stock: p.stock > 0 ? 0 : 10 } : p)) }),
      setPrice: (id, n) => set({ products: get().products.map((p) => (p.id === id ? { ...p, priceInr: n } : p)) }),
      publish: (vendorId, d, image) => {
        const until = new Date(Date.now() + 24 * 3600_000).toISOString();
        const vendor = VENDORS.find((v) => v.id === vendorId)!;
        const added: Product[] = d.items.map((it) => ({ id: `p-${hex(6)}`, vendorId, name: it.name, local: it.local, unit: it.unit, priceInr: it.priceInr, stock: it.qty, image: image ?? vendor.photos[0], freshUntil: until, byAi: true }));
        const alert: Alert = { id: `al-${hex(6)}`, vendorId, ...d.alert, productIds: added.map((p) => p.id), at: new Date().toISOString(), aiRequestId: d.run.requestId };
        set({ products: [...added, ...get().products], alerts: [alert, ...get().alerts] });
      },
      addProduct: (p) => set({ products: [{ ...p, id: `p-${hex(6)}` }, ...get().products] }),
      setStock: (id, n) => set({ products: get().products.map((p) => (p.id === id ? { ...p, stock: Math.max(0, Math.min(10000, n)) } : p)) }),
      redeem: (label, cost, vendorId) => {
        const bal = get().points.reduce((s, p) => s + p.points, 0);
        if (bal < cost) return false;
        set({ points: [{ id: `pt-${hex(5)}`, points: -cost, label: `Redeemed: ${label}`, at: new Date().toISOString(), vendorId }, ...get().points] });
        return true;
      },
      editProfile: (id, e) => set({ edits: { ...get().edits, [id]: { ...get().edits[id], ...e } } }),
      goLive: (id, e) => set({ onboarded: true, edits: { ...get().edits, [id]: { ...get().edits[id], ...e, open: true } } }),
      openRequest: (vendorId, inr, lines, by) => {
        const amount = Math.round(inr);
        if (!(amount >= 1 && amount <= COUNTER_MAX_INR)) throw new Error(`Amount must be between ₹1 and ₹${COUNTER_MAX_INR.toLocaleString('en-IN')}`);
        const id = `r${hex(10)}`;
        const now = Date.now();
        const req: PayRequest = { id, vendorId, inr: amount, lines, by, status: 'open', createdAt: new Date(now).toISOString(), expiresAt: new Date(now + REQUEST_TTL_MS).toISOString() };
        set({ requests: { ...get().requests, [id]: req } });
        return id;
      },
      cancelRequest: (id) => { const r = get().requests[id]; if (r && r.status === 'open') set({ requests: { ...get().requests, [id]: { ...r, status: 'cancelled' } } }); },
      counterOrder: (rid) => {
        const r = get().requests[rid];
        if (!r || r.status !== 'open' || Date.parse(r.expiresAt) < Date.now()) return null;
        const lines = r.lines.length ? r.lines : [{ productId: 'counter', name: 'Counter purchase', unit: 'piece' as const, qty: 1, priceInr: r.inr }];
        const o: Order = { id: `o${1100 + Math.floor(Math.random() * 8000)}`, code: pickupCode(), customer: ME.name, vendorId: r.vendorId, lines, inr: r.inr, usd: toUsd(r.inr), status: 'paying', at: new Date().toISOString(), refunds: [], points: 0 };
        set({ myOrders: [o, ...get().myOrders] });
        return o;
      },
      counterPaid: (rid, orderId, payment) => {
        const r = get().requests[rid];
        const o = get().myOrders.find((x) => x.id === orderId);
        if (!r || !o || r.status !== 'open') return; // single use: a second payment never settles the same request
        const pts = pointsFor(o.inr);
        const done: Order = { ...o, status: 'done', payment, points: pts };
        const v = VENDORS.find((x) => x.id === o.vendorId);
        set({
          requests: { ...get().requests, [rid]: { ...r, status: 'paid', orderId, payer: ME.name } },
          myOrders: patch(get().myOrders, orderId, () => done),
          stallOrders: [done, ...get().stallOrders],
          products: get().products.map((p) => { const l = o.lines.find((x) => x.productId === p.id); return l ? { ...p, stock: Math.max(0, p.stock - l.qty) } : p; }),
          points: [{ id: `pt-${orderId}`, points: pts, label: `Paid at ${v?.name}`, at: new Date().toISOString(), vendorId: o.vendorId }, ...get().points],
        });
      },
      setRole: (id, role) => set({ roles: { ...get().roles, [id]: role } }),
      setStallFlag: (id, f) => set({ stallFlags: { ...get().stallFlags, [id]: { ...get().stallFlags[id], ...f } } }),
      say: (msg) => { set({ toast: msg }); window.setTimeout(() => get().toast === msg && set({ toast: null }), 2600); },
      reset: () => set(fresh()),
    }),
    { name: 'zeeto-v2', storage: createJSONStorage(() => storage), partialize: (s) => ({ ...s, toast: null }) },
  ),
);

export const useBalance = () => useApp((s) => s.points.reduce((a, p) => a + p.points, 0));
export const useBagCount = () => useApp((s) => Object.values(s.bag.lines).reduce((a, b) => a + b, 0));

/** A vendor with the owner's profile edits applied; new uploads lead the grid. */
export function useVendor(id?: string): Vendor | undefined {
  const e = useApp((s) => (id ? s.edits[id] : undefined));
  const v = VENDORS.find((x) => x.id === id);
  if (!v || !e) return v;
  return { ...v, name: e.name ?? v.name, hours: e.hours ?? v.hours, landmark: e.landmark ?? v.landmark, tagline: e.tagline ?? v.tagline, bio: e.bio ?? v.bio, avatar: e.avatar ?? v.avatar, cover: e.cover ?? v.cover, photos: [...(e.photos ?? []), ...v.photos], youtube: [...(e.youtube ?? []), ...v.youtube] };
}

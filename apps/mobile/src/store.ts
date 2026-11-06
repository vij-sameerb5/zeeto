import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  ALERTS, FOLLOWING, ME, MY_ORDERS, POINTS, PRODUCTS, STORIES, VENDOR_ORDERS, hex, pickupCode, pointsFor, toUsd,
  type AiDraft, type Alert, type Hex, type Order, type Payment, type Product, type Refund, type Story,
} from '@zeeto/core';

/** The stall the demo seller runs (Ravi's Fresh Sabzi). */
export const MY_STALL = 'ravi';

type Bag = { vendorId: string | null; lines: Record<string, number> };
type PointRow = { id: string; label: string; points: number; at: string; vendorId: string };
/** What a customer sees in their inbox: offers and stock alerts from stalls they follow, and order updates. */
export type InboxItem = { id: string; vendorId: string; title: string; body: string; at: string; read: boolean; kind: 'offer' | 'order' };

interface State {
  follows: string[];
  liked: string[];
  saved: string[];
  products: Product[];
  bag: Bag;
  orders: Order[];
  stallOrders: Order[];
  points: number;
  history: PointRow[];
  /** Stall open/closed, set from seller mode. */
  stallOpen: boolean;
  stories: Story[];
  alerts: Alert[];
  inbox: InboxItem[];
  /** Stall posts a 24-hour story (photo + line of text) to its followers' story rail. */
  postStory: (media: string, text: string) => void;
  /** Stall sends an offer / stock alert to followers: shows on its page and in followers' inbox. */
  notifyFollowers: (title: string, body: string) => number;
  readInbox: () => void;
  follow: (vendorId: string) => void;
  like: (postId: string) => void;
  save: (postId: string) => void;
  /** One stall per bag. Adding from another stall starts a new bag. */
  setQty: (vendorId: string, productId: string, qty: number) => void;
  /** Creates the order as 'paying'. The customer name and paying wallet go on it so the stall knows who it is. */
  checkout: (customer?: string, payer?: Hex | null) => Order | null;
  /** Only a 'paying' order can become paid; a second confirmation is ignored. */
  paid: (orderId: string, payment: Payment) => void;
  // customer
  arrived: (orderId: string) => void;
  /** Only before the stall accepts. The stall then refunds in full. */
  askCancel: (orderId: string) => void;
  /** Points are per stall: a stall's reward is paid only with points earned at that stall. */
  redeem: (label: string, cost: number, vendorId: string) => boolean;
  // seller
  accept: (orderId: string) => void;
  packed: (orderId: string) => void;
  handedOver: (orderId: string) => void;
  refunded: (orderId: string, r: Refund, full: boolean) => void;
  setOpen: (open: boolean) => void;
  toggleStock: (productId: string) => void;
  setPrice: (productId: string, priceInr: number) => void;
  publish: (draft: AiDraft, photo: string | null) => void;
  resetDemo: () => void;
  /** Wallet this phone's personal data belongs to. A new sign-in starts empty: no sample orders, points or payments. */
  owner: string | null;
  startFresh: (owner: string) => void;
}

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

const initial = () => ({
  follows: FOLLOWING,
  liked: [] as string[],
  saved: [] as string[],
  products: PRODUCTS,
  bag: { vendorId: null, lines: {} } as Bag,
  orders: MY_ORDERS,
  stallOrders: VENDOR_ORDERS,
  points: POINTS.reduce((a, p) => a + p.points, 0),
  history: POINTS.filter((p) => p.vendorId).map((p) => ({ id: p.id, label: p.label, points: p.points, at: p.at, vendorId: p.vendorId! })),
  stallOpen: true,
  stories: STORIES,
  alerts: ALERTS,
  inbox: ALERTS.slice(0, 2).map((a) => ({ id: `in-${a.id}`, vendorId: a.vendorId, title: a.title, body: a.body, at: a.at, read: false, kind: 'offer' as const })),
});

export const useApp = create<State>()(persist((set, get) => {
  /** Moves an order only from the allowed states; anything else is a no-op (double taps, stale screens). */
  const move = (id: string, from: Order['status'][], f: (o: Order) => Order) => {
    const patch = (list: Order[]) => list.map((o) => (o.id === id && from.includes(o.status) ? f(o) : o));
    set((s) => ({ orders: patch(s.orders), stallOrders: patch(s.stallOrders) }));
  };

  return {
    ...initial(),

    follow: (id) => set((s) => ({ follows: toggle(s.follows, id) })),
    like: (id) => set((s) => ({ liked: toggle(s.liked, id) })),
    save: (id) => set((s) => ({ saved: toggle(s.saved, id) })),

    setQty: (vendorId, productId, qty) =>
      set((s) => {
        const lines = s.bag.vendorId === vendorId ? { ...s.bag.lines } : {};
        if (qty > 0) lines[productId] = qty;
        else delete lines[productId];
        return { bag: { vendorId: Object.keys(lines).length ? vendorId : null, lines } };
      }),

    checkout: (customer, payer) => {
      const { bag, products } = get();
      if (!bag.vendorId) return null;
      const lines = Object.entries(bag.lines).map(([id, qty]) => {
        const p = products.find((x) => x.id === id)!;
        return { productId: id, name: p.name, unit: p.unit, qty, priceInr: p.priceInr };
      });
      const inr = lines.reduce((a, l) => a + l.qty * l.priceInr, 0);
      const order: Order = {
        id: `o${hex(7)}`,
        code: pickupCode(),
        customer: customer || ME.name,
        vendorId: bag.vendorId,
        lines,
        inr,
        usd: toUsd(inr),
        status: 'paying',
        at: new Date().toISOString(),
        refunds: [],
        points: pointsFor(inr),
        payer: payer ?? undefined,
      };
      set((s) => ({ orders: [order, ...s.orders] }));
      return order;
    },

    paid: (orderId, payment) =>
      set((s) => {
        const o = s.orders.find((x) => x.id === orderId);
        if (!o || o.status !== 'paying') return {};
        const done: Order = { ...o, status: 'paid', payment, payer: o.payer ?? payment.from };
        return {
          orders: s.orders.map((x) => (x.id === orderId ? done : x)),
          // An order paid at the demo stall shows up on the seller side too.
          stallOrders: o.vendorId === MY_STALL ? [done, ...s.stallOrders] : s.stallOrders,
          bag: { vendorId: null, lines: {} },
          points: s.points + o.points,
          history: [{ id: `p${hex(5)}`, label: `Order ${o.id.toUpperCase()}`, points: o.points, at: new Date().toISOString(), vendorId: o.vendorId }, ...s.history],
        };
      }),

    arrived: (id) => move(id, ['paid', 'accepted', 'ready'], (o) => ({ ...o, arrivedAt: new Date().toISOString() })),
    askCancel: (id) => move(id, ['paid'], (o) => ({ ...o, cancelAsked: true })),
    redeem: (label, cost, vendorId) => {
      const bal = get().history.filter((h) => h.vendorId === vendorId).reduce((a, h) => a + h.points, 0);
      if (cost <= 0 || bal < cost) return false;
      set((s) => ({ points: s.points - cost, history: [{ id: `p${hex(5)}`, label: `Redeemed · ${label}`, points: -cost, at: new Date().toISOString(), vendorId }, ...s.history] }));
      return true;
    },

    // An order the customer asked to cancel can only be refunded, not accepted.
    accept: (id) => move(id, ['paid'], (o) => (o.cancelAsked ? o : { ...o, status: 'accepted' })),
    packed: (id) => {
      move(id, ['accepted'], (o) => ({ ...o, status: 'ready' }));
      const o = get().orders.find((x) => x.id === id);
      if (o?.status === 'ready') set((s) => ({ inbox: [{ id: `in-${hex(6)}`, vendorId: o.vendorId, title: 'Your order is ready', body: `Say your name and code ${o.code} at the stall.`, at: new Date().toISOString(), read: false, kind: 'order' as const }, ...s.inbox] }));
    },
    handedOver: (id) => move(id, ['ready', 'accepted'], (o) => ({ ...o, status: 'done' })),
    refunded: (id, r, full) =>
      move(id, ['paid', 'accepted', 'ready', 'done', 'part-refunded'], (o) => ({ ...o, status: full ? 'refunded' : 'part-refunded', refunds: [...o.refunds, r] })),
    setOpen: (stallOpen) => set({ stallOpen }),
    postStory: (media, text) => set((s) => ({ stories: [{ id: `st-${hex(6)}`, vendorId: MY_STALL, media, text: text.trim().slice(0, 120), at: new Date().toISOString() }, ...s.stories] })),
    notifyFollowers: (title, body) => {
      const at = new Date().toISOString();
      const a: Alert = { id: `al-${hex(6)}`, vendorId: MY_STALL, title: title.trim().slice(0, 60), body: body.trim().slice(0, 200), translations: {}, productIds: [], at };
      // In this demo the follower is the same phone, so the message lands in this inbox. With the server it fans out
      // to every follower (and over WhatsApp to those who opted in).
      const reached = get().follows.includes(MY_STALL) ? 1 : 0;
      set((s) => ({
        alerts: [a, ...s.alerts],
        inbox: reached ? [{ id: `in-${a.id}`, vendorId: MY_STALL, title: a.title, body: a.body, at, read: false, kind: 'offer' as const }, ...s.inbox] : s.inbox,
      }));
      return 1284 + reached; // demo follower count shown to the stall
    },
    readInbox: () => set((s) => ({ inbox: s.inbox.map((i) => ({ ...i, read: true })) })),

    toggleStock: (id) => set((s) => ({ products: s.products.map((p) => (p.id === id ? { ...p, stock: p.stock > 0 ? 0 : 10 } : p)) })),
    setPrice: (id, priceInr) => set((s) => ({ products: s.products.map((p) => (p.id === id ? { ...p, priceInr } : p)) })),

    publish: (draft, photo) =>
      set((s) => ({
        products: [
          ...draft.items.map((it) => ({
            id: `ai-${hex(6)}`,
            vendorId: MY_STALL,
            name: it.name,
            local: it.local,
            unit: it.unit,
            priceInr: it.priceInr,
            stock: it.qty,
            image: photo ?? 'veg-1',
            byAi: true,
          })),
          ...s.products,
        ],
      })),

    resetDemo: () => set(initial()),
    owner: null,
    startFresh: (owner) => {
      if (get().owner === owner) return;
      set({ owner, orders: [], history: [], points: 0, inbox: [], bag: { vendorId: null, lines: {} }, liked: [], saved: [] });
    },
  };
}, {
  name: 'zeeto-mobile-v3', // v3: points belong to a stall
  storage: createJSONStorage(() => AsyncStorage),
  // Bag and orders survive an app restart; nothing secret is stored here.
  partialize: (s) => ({ follows: s.follows, liked: s.liked, saved: s.saved, products: s.products, bag: s.bag, orders: s.orders, stallOrders: s.stallOrders, points: s.points, history: s.history, stallOpen: s.stallOpen, stories: s.stories, alerts: s.alerts, inbox: s.inbox, owner: s.owner }),
}));

export const useBagCount = () => useApp((s) => Object.values(s.bag.lines).reduce((a, n) => a + n, 0));
export const useBagTotal = () =>
  useApp((s) => Object.entries(s.bag.lines).reduce((a, [id, n]) => a + n * (s.products.find((p) => p.id === id)?.priceInr ?? 0), 0));

import { create } from 'zustand';
import {
  FOLLOWING, ME, MY_ORDERS, POINTS, PRODUCTS, VENDOR_ORDERS, hex, pickupCode, pointsFor, toUsd,
  type AiDraft, type Order, type Payment, type Product, type Refund,
} from '@zeeto/core';

/** The stall the demo seller runs (Ravi's Fresh Sabzi). */
export const MY_STALL = 'ravi';

type Bag = { vendorId: string | null; lines: Record<string, number> };

interface State {
  follows: string[];
  liked: string[];
  saved: string[];
  products: Product[];
  bag: Bag;
  orders: Order[];
  stallOrders: Order[];
  points: number;
  follow: (vendorId: string) => void;
  like: (postId: string) => void;
  save: (postId: string) => void;
  /** One stall per bag. Adding from another stall starts a new bag. */
  setQty: (vendorId: string, productId: string, qty: number) => void;
  checkout: () => Order | null;
  paid: (orderId: string, payment: Payment) => void;
  // seller
  accept: (orderId: string) => void;
  reject: (orderId: string, refund: Refund) => void;
  packed: (orderId: string) => void;
  handedOver: (orderId: string, code: string) => boolean;
  toggleStock: (productId: string) => void;
  setPrice: (productId: string, priceInr: number) => void;
  publish: (draft: AiDraft, photo: string | null) => void;
}

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

export const useApp = create<State>((set, get) => ({
  follows: FOLLOWING,
  liked: [],
  saved: [],
  products: PRODUCTS,
  bag: { vendorId: null, lines: {} },
  orders: MY_ORDERS,
  stallOrders: VENDOR_ORDERS,
  points: POINTS.reduce((a, p) => a + p.points, 0),

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

  checkout: () => {
    const { bag, products } = get();
    if (!bag.vendorId) return null;
    const lines = Object.entries(bag.lines).map(([id, qty]) => {
      const p = products.find((x) => x.id === id)!;
      return { productId: id, name: p.name, unit: p.unit, qty, priceInr: p.priceInr };
    });
    const inr = lines.reduce((a, l) => a + l.qty * l.priceInr, 0);
    const order: Order = {
      id: `o${Date.now().toString().slice(-5)}`,
      code: pickupCode(),
      customer: ME.name,
      vendorId: bag.vendorId,
      lines,
      inr,
      usd: toUsd(inr),
      status: 'paying',
      at: new Date().toISOString(),
      refunds: [],
      points: pointsFor(inr),
    };
    set((s) => ({ orders: [order, ...s.orders] }));
    return order;
  },

  paid: (orderId, payment) =>
    set((s) => {
      const o = s.orders.find((x) => x.id === orderId);
      if (!o) return {};
      const done = { ...o, status: 'paid' as const, payment };
      return {
        orders: s.orders.map((x) => (x.id === orderId ? done : x)),
        // An order paid at the demo stall shows up on the seller side too.
        stallOrders: o.vendorId === MY_STALL ? [done, ...s.stallOrders] : s.stallOrders,
        bag: { vendorId: null, lines: {} },
        points: s.points + o.points,
      };
    }),

  accept: (id) =>
    set((s) => ({
      stallOrders: s.stallOrders.map((o) => (o.id === id ? { ...o, status: 'accepted' } : o)),
      orders: s.orders.map((o) => (o.id === id ? { ...o, status: 'accepted' } : o)),
    })),

  reject: (id, r) =>
    set((s) => ({
      stallOrders: s.stallOrders.map((o) => (o.id === id ? { ...o, status: 'refunded', refunds: [...o.refunds, r] } : o)),
      orders: s.orders.map((o) => (o.id === id ? { ...o, status: 'refunded', refunds: [...o.refunds, r] } : o)),
    })),

  packed: (id) =>
    set((s) => ({
      stallOrders: s.stallOrders.map((o) => (o.id === id ? { ...o, status: 'ready' } : o)),
      orders: s.orders.map((o) => (o.id === id ? { ...o, status: 'ready' } : o)),
    })),

  handedOver: (id, code) => {
    const o = get().stallOrders.find((x) => x.id === id);
    if (!o || o.code.replace('-', '').toUpperCase() !== code.replace('-', '').trim().toUpperCase()) return false;
    set((s) => ({
      stallOrders: s.stallOrders.map((x) => (x.id === id ? { ...x, status: 'done' } : x)),
      orders: s.orders.map((x) => (x.id === id ? { ...x, status: 'done' } : x)),
    }));
    return true;
  },

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
}));

export const useBagCount = () => useApp((s) => Object.values(s.bag.lines).reduce((a, n) => a + n, 0));
export const useBagTotal = () =>
  useApp((s) => Object.entries(s.bag.lines).reduce((a, [id, n]) => a + n * (s.products.find((p) => p.id === id)?.priceInr ?? 0), 0));

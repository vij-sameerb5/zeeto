import { create } from 'zustand';
import type { Order, Product } from '@zeeto/core';
import { useSession } from './session';
import { WEB_URL } from './web';

/**
 * Your real data from the Zeeto server, the same the website shows: your orders as a customer, and, if you run a stall,
 * its incoming orders. Only with the app session from sign-in; nothing here can move money (payments open the web).
 */
export const useServer = create<{ mine: Order[]; stall: Order[]; stallId: string | null; ok: boolean }>(() => ({ mine: [], stall: [], stallId: null, ok: false }));

export class ApiError extends Error { constructor(m: string, public status: number) { super(m); } }

export async function api<T>(path: string, body?: unknown): Promise<T> {
  const { token } = useSession.getState();
  if (!WEB_URL) throw new ApiError('Web link not set.', 0);
  let r: Response;
  try {
    r = await fetch(`${WEB_URL}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch { throw new ApiError('No connection. Check your internet.', 0); }
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) useSession.getState().unlink(); // expired session: sign in again
  if (!r.ok) throw new ApiError((j as { error?: string }).error ?? `Request failed (${r.status}).`, r.status);
  return j as T;
}

export async function loadServer() {
  if (!useSession.getState().token) { useServer.setState({ mine: [], stall: [], stallId: null, ok: false }); return; }
  try {
    const r = await api<{ mine: Order[]; stall: Order[]; stallId: string | null }>('/api/orders');
    useServer.setState({ mine: r.mine, stall: r.stall, stallId: r.stallId, ok: true });
  } catch { /* keep the last copy */ }
}

/** A step on a real order (stall: accept / packed / handover; customer: arrived / cancel). */
export async function orderStep(orderId: string, action: 'accept' | 'packed' | 'handover' | 'arrived' | 'cancel') {
  const r = await api<{ order: Order }>('/api/orders', { action, orderId });
  const put = (list: Order[]) => list.map((o) => (o.id === r.order.id ? { ...o, ...r.order } : o));
  useServer.setState((s) => ({ mine: put(s.mine), stall: put(s.stall) }));
  return r.order;
}

/** Save your stall's whole product list (the server hides anything not in it). */
export async function saveProducts(vendorId: string, products: Product[]) {
  const body = products.map((p) => ({ id: p.id, name: p.name, local: p.local, unit: p.unit, priceInr: p.priceInr, stock: p.stock, image: p.image, byAi: p.byAi }));
  return (await api<{ products: Product[] }>('/api/products', { vendorId, products: body })).products;
}

import { useMemo } from 'react';
import { useApp } from './store';

/** Your orders: real ones from the server first, then any made on sample stalls on this phone. */
export function useMyOrders(): Order[] {
  const mine = useServer((s) => s.mine);
  const local = useApp((s) => s.orders);
  return useMemo(() => [...mine, ...local.filter((o) => !mine.some((m) => m.id === o.id))], [mine, local]);
}

import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

/** Bag for a real stall (the app's own, separate from sample stalls). One stall at a time, like the website. */
export const useRealBag = create<{ vendorId: string | null; lines: Record<string, number>; set: (vendorId: string, productId: string, qty: number) => void; clear: () => void }>((set, get) => ({
  vendorId: null,
  lines: {},
  set: (vendorId, productId, qty) => {
    const lines = get().vendorId === vendorId ? { ...get().lines } : {};
    if (qty > 0) lines[productId] = qty; else delete lines[productId];
    set({ vendorId: Object.keys(lines).length ? vendorId : null, lines });
  },
  clear: () => set({ vendorId: null, lines: {} }),
}));

export type PayResult = { status: 'paid' | 'cancel' | 'closed'; order: Order };

/**
 * Make the order in the app (the server prices it), then open Zeeto's secure checkout for the one thing Expo Go can't do:
 * the wallet's signature. The page returns to the app on its own when it's paid.
 */
export async function orderAndPay(body: { vendorId: string; lines?: { productId: string; qty: number }[]; amountInr?: number }): Promise<PayResult> {
  const r = await api<{ order: Order }>('/api/orders', { action: 'create', ...body });
  return payInBrowser(r.order);
}

export async function payInBrowser(order: Order): Promise<PayResult> {
  const back = Linking.createURL('paid');
  const res = await WebBrowser.openAuthSessionAsync(`${WEB_URL}/app-pay/${order.id}?back=${encodeURIComponent(back)}`, back);
  await loadServer();
  const fresh = useServer.getState().mine.find((o) => o.id === order.id) ?? order;
  if (res.type !== 'success') return { status: fresh.status === 'paying' ? 'closed' : 'paid', order: fresh };
  const q = Linking.parse(res.url).queryParams ?? {};
  return { status: q.status === 'paid' || fresh.status !== 'paying' ? 'paid' : 'cancel', order: fresh };
}

import { useEffect, useRef } from 'react';
import type { Order, Product, Vendor } from '@zeeto/core';
import { findVendor, useApp } from '../store';
import { api, checkServer, serverOn, useServer } from './api';

/** The signed-in user's own stall, if it lives on the server. */
export const ownServerStall = (): Vendor | undefined => {
  const s = useApp.getState();
  return serverOn() && s.me ? s.myStalls.find((v) => v.ownerId === s.me) : undefined;
};
/** Is this a real stall on the server (orders and payments go through the API)? */
export const isServerStall = (id?: string | null) => !!id && serverOn() && useApp.getState().myStalls.some((v) => v.id === id && !!v.ownerId);

/** What the server should hold for a product (the app's own image keys and uploads are kept as-is). */
const productBody = (p: Product) => ({ id: p.id, name: p.name, local: p.local, unit: p.unit, priceInr: p.priceInr, stock: p.stock, image: p.image, byAi: p.byAi, freshUntil: p.freshUntil });
const sig = (list: Product[]) => JSON.stringify(list.map(productBody).sort((a, b) => a.id.localeCompare(b.id)));

/** Last product list known to match the server for your own stall, so a pull never triggers a push back. */
let synced = '';

export async function loadStalls() {
  const r = await api<{ vendors: Vendor[]; products: Product[] }>('/api/stalls', { auth: false });
  const s = useApp.getState();
  const own = s.me ? r.vendors.find((v) => v.ownerId === s.me) : undefined;
  if (own) synced = sig(r.products.filter((p) => p.vendorId === own.id));
  s.setRemoteStalls(r.vendors, r.products);
}

export async function loadOrders() {
  const r = await api<{ mine: Order[]; stall: Order[] }>('/api/orders');
  useApp.getState().setRemoteOrders(r.mine, r.stall);
}

/**
 * Keeps this device in step with the server:
 * stalls every 30 s, your orders every 4 s while the tab is visible, and your own stall's product
 * and profile edits pushed up a second after you stop typing.
 */
export function ServerSync({ authed, userId }: { authed: boolean; userId: string | null }) {
  const status = useServer((s) => s.status);
  const lastEdit = useRef('');

  useEffect(() => { void checkServer(); }, []);

  useEffect(() => {
    if (status !== 'on') return;
    const tick = () => { if (document.visibilityState === 'visible') loadStalls().catch(() => undefined); };
    tick();
    const t = window.setInterval(tick, 30_000);
    return () => window.clearInterval(t);
  }, [status]);

  useEffect(() => {
    if (status !== 'on' || !authed) return;
    let stop = false;
    const tick = () => { if (!stop && document.visibilityState === 'visible') loadOrders().catch(() => undefined); };
    tick();
    const t = window.setInterval(tick, 4000);
    document.addEventListener('visibilitychange', tick);
    return () => { stop = true; window.clearInterval(t); document.removeEventListener('visibilitychange', tick); };
  }, [status, authed, userId]);

  // Push your own stall's product list when it changes locally.
  useEffect(() => {
    if (status !== 'on' || !authed) return;
    let timer = 0;
    const unsub = useApp.subscribe((s) => {
      const own = ownServerStall();
      if (!own) return;
      const mine = s.products.filter((p) => p.vendorId === own.id);
      const now = sig(mine);
      if (!synced || now === synced) return;
      synced = now;
      window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
        try {
          const r = await api<{ products: Product[] }>('/api/products', { body: { vendorId: own.id, products: mine.map(productBody) } });
          synced = sig(r.products);
          useApp.getState().setVendorProducts(own.id, r.products);
        } catch (e) {
          useApp.getState().say((e as Error).message);
        }
      }, 1000);
    });
    return () => { unsub(); window.clearTimeout(timer); };
  }, [status, authed]);

  // Push profile edits (name, hours, photos, open/closed) of your own stall.
  useEffect(() => {
    if (status !== 'on' || !authed) return;
    let timer = 0;
    const unsub = useApp.subscribe((s) => {
      const own = ownServerStall();
      const e = own ? s.edits[own.id] : undefined;
      if (!own || !e) return;
      const now = JSON.stringify(e);
      if (now === lastEdit.current) return;
      lastEdit.current = now;
      window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
        const v = findVendor(own.id)!;
        const stall = { ...v, ...e, photos: [...(e.photos ?? []), ...v.photos], youtube: [...(e.youtube ?? []), ...v.youtube] };
        try {
          const r = await api<{ vendor: Vendor }>('/api/stalls', { body: { stall, open: e.open, waPhone: e.waPhone } });
          const st = useApp.getState();
          const edits = { ...st.edits };
          delete edits[own.id];
          lastEdit.current = '';
          useApp.setState({ myStalls: st.myStalls.map((x) => (x.id === r.vendor.id ? r.vendor : x)), edits });
        } catch (err) {
          useApp.getState().say((err as Error).message);
        }
      }, 1200);
    });
    return () => { unsub(); window.clearTimeout(timer); };
  }, [status, authed]);

  return null;
}

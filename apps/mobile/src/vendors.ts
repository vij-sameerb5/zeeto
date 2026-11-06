import { useMemo } from 'react';
import { create } from 'zustand';
import { VENDORS, type Product, type Vendor } from '@zeeto/core';
import { WEB_URL } from './web';

/**
 * Real stalls come from the Zeeto server (the same list the website shows); the built-in demo stalls stay as samples.
 * A real stall's orders and payments open the secure web checkout, where the customer's own wallet signs gas-free.
 */
export const useRemote = create<{ vendors: Vendor[]; products: Product[]; ok: boolean }>(() => ({ vendors: [], products: [], ok: false }));

export async function loadRemote() {
  if (!WEB_URL) return;
  try {
    const r = await fetch(`${WEB_URL}/api/stalls`, { headers: { Accept: 'application/json' } });
    if (!r.ok) return;
    const j = await r.json() as { vendors?: Vendor[]; products?: Product[] };
    useRemote.setState({ vendors: (j.vendors ?? []).filter((v) => !v.closed), products: j.products ?? [], ok: true });
  } catch { /* offline: keep what we have */ }
}

export const isReal = (v?: Vendor) => !!v?.ownerId;
export const findVendor = (id?: string | null) => (id ? useRemote.getState().vendors.find((v) => v.id === id) ?? VENDORS.find((v) => v.id === id) : undefined);
/** Real stalls first, then the demo stalls. */
export function useVendors() {
  const remote = useRemote((s) => s.vendors);
  return useMemo(() => [...remote, ...VENDORS], [remote]);
}

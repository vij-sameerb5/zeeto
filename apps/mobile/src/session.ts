import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { CHAINS, ADDRESSES, type Hex } from '@zeeto/core';
import { WEB_URL } from './web';

/**
 * Expo Go can't run Privy's native SDK, so sign-in happens on the Zeeto web app in an in-app browser.
 * The web page sends back the public wallet address, a masked label and a 7-day app session (no keys, no Privy login),
 * so this app can show your real balance but can't sign; payments that need a signature open on the web.
 */
interface Session {
  /** Picked on the first screen: shopping or selling. Only decides where the app opens. */
  startAs: 'customer' | 'merchant' | null;
  setStartAs: (r: 'customer' | 'merchant' | null) => void;
  address: Hex | null;
  label: string | null;
  /** The app's own 7-day Zeeto session (from /api/session). Lets the app read your orders and run your stall; it can't move money. */
  token: string | null;
  link: () => Promise<'ok' | 'cancel' | 'no-web'>;
  unlink: () => void;
}

const isAddr = (a: string | null): a is Hex => !!a && /^0x[0-9a-fA-F]{40}$/.test(a);

export const useSession = create<Session>()(persist((set) => ({
  startAs: null,
  setStartAs: (startAs) => set({ startAs }),
  address: null,
  label: null,
  token: null,
  link: async () => {
    if (!WEB_URL) return 'no-web';
    const back = Linking.createURL('auth');
    const res = await WebBrowser.openAuthSessionAsync(`${WEB_URL}/app-link?to=${encodeURIComponent(back)}`, back);
    if (res.type !== 'success') return 'cancel';
    const q = Linking.parse(res.url).queryParams ?? {};
    const address = typeof q.address === 'string' ? q.address : null;
    const label = typeof q.label === 'string' ? q.label.slice(0, 40) : null;
    if (!isAddr(address)) return 'cancel';
    const token = typeof q.token === 'string' && /^zm1\.[\w-]+\.[\w-]+$/.test(q.token) ? q.token : null;
    set({ address, label, token });
    return 'ok';
  },
  unlink: () => set({ address: null, label: null, token: null }),
}), { name: 'zeeto-mobile-session', storage: createJSONStorage(() => AsyncStorage), partialize: (s) => ({ address: s.address, label: s.label, startAs: s.startAs, token: s.token }) }));

/** Plain JSON-RPC: no wallet library needed just to read balances. */
async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const r = await fetch(CHAINS.whitechain.rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j.result as T;
}

export async function readBalances(address: Hex): Promise<{ wbt: number; usdt: number }> {
  const data = `0x70a08231${address.slice(2).toLowerCase().padStart(64, '0')}`; // balanceOf(address)
  const [wei, raw] = await Promise.all([
    rpc<string>('eth_getBalance', [address, 'latest']),
    rpc<string>('eth_call', [{ to: ADDRESSES.usdtWhitechain, data }, 'latest']),
  ]);
  return { wbt: Number(BigInt(wei)) / 1e18, usdt: Number(BigInt(raw === '0x' ? '0x0' : raw)) / 1e6 };
}

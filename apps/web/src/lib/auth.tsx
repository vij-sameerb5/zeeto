import { PrivyProvider, usePrivy, useWallets, type EIP1193Provider } from '@privy-io/react-auth';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ME } from '@zeeto/core';
import { useApp } from '../store';
import { unichainSepolia, whitechain } from './chain';
import { setTokenGetter } from './api';
import { ServerSync } from './sync';

export type Role = 'customer' | 'merchant' | 'admin';

export interface Session {
  /** 'privy' when VITE_PRIVY_APP_ID is set, otherwise a local demo sign-in. */
  mode: 'privy' | 'demo';
  ready: boolean;
  authed: boolean;
  userId: string | null;
  /** Phone or email to show, masked. */
  label: string | null;
  /** Raw ids (Privy id, phone, email) for allow-list checks. Never shown. */
  handles: string[];
  address: `0x${string}` | null;
  /** Signed in with MetaMask (or another browser wallet): payments show that wallet's own confirm. */
  external?: boolean;
  login: () => void;
  logout: () => void;
  /** Signs with the embedded wallet (Privy only). */
  provider: () => Promise<EIP1193Provider | null>;
}

const Ctx = createContext<Session | null>(null);
export const useSession = () => useContext(Ctx)!;

const APP_ID = import.meta.env.VITE_PRIVY_APP_ID?.trim();
export const PRIVY_ON = !!APP_ID;

const mask = (s: string) => (s.startsWith('+') ? `${s.slice(0, 5)}•••• ${s.slice(-4)}` : s.replace(/^(.).+(@.+)$/, '$1•••$2'));

function PrivyBridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  useEffect(() => { setTokenGetter(() => getAccessToken()); }, [getAccessToken]);
  const { wallets } = useWallets();
  // Phone/email users pay with the wallet Privy made for them. MetaMask users pay with the MetaMask wallet they signed in with
  // (never just any wallet the browser happens to have connected). The server picks the same one.
  const linked = user?.wallet?.address?.toLowerCase();
  const embedded = wallets.find((w) => w.walletClientType === 'privy') ?? wallets.find((w) => w.address.toLowerCase() === linked);
  const value = useMemo<Session>(() => ({
    mode: 'privy',
    ready,
    authed: authenticated,
    userId: user?.id ?? null,
    label: user?.phone?.number ? mask(user.phone.number) : user?.email?.address ? mask(user.email.address) : linked ? `${linked.slice(0, 6)}…${linked.slice(-4)}` : null,
    handles: [user?.id, user?.phone?.number, user?.email?.address, linked].filter((x): x is string => !!x).map((x) => x.toLowerCase()),
    external: !!embedded && embedded.walletClientType !== 'privy',
    address: (embedded?.address as `0x${string}` | undefined) ?? null,
    login: () => login(),
    logout: () => void logout(),
    provider: async () => {
      if (!embedded) return null;
      await embedded.switchChain(whitechain.id).catch(() => undefined);
      return embedded.getEthereumProvider();
    },
  }), [ready, authenticated, user, embedded, login, logout]);
  return <Ctx.Provider value={value}><MeSync /><ServerSync authed={authenticated} userId={user?.id ?? null} />{children}</Ctx.Provider>;
}

function DemoSession({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(() => { try { return localStorage.getItem('zeeto-demo-auth') === '1'; } catch { return true; } });
  const set = (v: boolean) => { setAuthed(v); try { localStorage.setItem('zeeto-demo-auth', v ? '1' : '0'); } catch { /* ignore */ } };
  const value = useMemo<Session>(() => ({
    mode: 'demo', ready: true, authed, userId: authed ? 'demo:priya' : null, label: authed ? '+91 98•••• 4210' : null, handles: authed ? ['demo:priya'] : [],
    address: authed ? ME.wallet : null, login: () => set(true), logout: () => set(false), provider: async () => null,
  }), [authed]);
  return <Ctx.Provider value={value}><MeSync />{children}</Ctx.Provider>;
}

/** Tells the store who is signed in, so it can find their own stall. */
function MeSync() {
  const s = useContext(Ctx)!;
  useEffect(() => { useApp.getState().setMe(s.authed ? s.userId : null); }, [s.authed, s.userId]);
  return null;
}

/** Phone or email login with an embedded wallet on Whitechain. Falls back to a demo session without an app id. */
export function AuthProvider({ children }: { children: ReactNode }) {
  if (!APP_ID) return <DemoSession>{children}</DemoSession>;
  return (
    <PrivyProvider
      appId={APP_ID}
      config={{
        // Phone/email for everyone; MetaMask for people who already hold test USDT in a browser wallet.
        loginMethods: ['sms', 'email', 'wallet'],
        appearance: { theme: '#0A0A0A', accentColor: '#FF7A1A', logo: `${location.origin}/icon.svg`, landingHeader: 'Sign in to Zeeto', walletList: ['metamask', 'detected_ethereum_wallets'], walletChainType: 'ethereum-only' },
        // Phone/email users get no wallet pop-ups: they never see a signing screen, gas, chain or token; the app shows its own "Pay ₹120" confirm.
        // MetaMask users get MetaMask's own signature prompt (still no gas: the relayer submits it).
        embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' }, showWalletUIs: false },
        defaultChain: whitechain,
        supportedChains: [whitechain, unichainSepolia],
      }}
    >
      <PrivyBridge>{children}</PrivyBridge>
    </PrivyProvider>
  );
}

const ADMINS = (import.meta.env.VITE_ADMIN_USERS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

/** UI role. The API is the real gate (docs/ARCHITECTURE.md §9); this only decides what to show.
 *  Admin comes only from VITE_ADMIN_USERS (or the demo session), never from anything the browser can set. */
export function useRole(): Role {
  const s = useSession();
  const roles = useApp((x) => x.roles);
  const onboarded = useApp((x) => x.onboarded);
  if (!s.authed || !s.userId) return 'customer';
  if (s.mode === 'demo' || ADMINS.some((a) => s.handles.includes(a))) return 'admin';
  return roles[s.userId] === 'merchant' || onboarded ? 'merchant' : 'customer';
}

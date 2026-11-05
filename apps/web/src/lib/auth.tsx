import { PrivyProvider, usePrivy, useWallets, type EIP1193Provider } from '@privy-io/react-auth';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { ME } from '@zeeto/core';
import { useApp } from '../store';
import { whitechain } from './chain';

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
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const embedded = wallets.find((w) => w.walletClientType === 'privy') ?? wallets[0];
  const value = useMemo<Session>(() => ({
    mode: 'privy',
    ready,
    authed: authenticated,
    userId: user?.id ?? null,
    label: user?.phone?.number ? mask(user.phone.number) : user?.email?.address ? mask(user.email.address) : null,
    handles: [user?.id, user?.phone?.number, user?.email?.address].filter((x): x is string => !!x).map((x) => x.toLowerCase()),
    address: (embedded?.address as `0x${string}` | undefined) ?? null,
    login: () => login(),
    logout: () => void logout(),
    provider: async () => {
      if (!embedded) return null;
      await embedded.switchChain(whitechain.id).catch(() => undefined);
      return embedded.getEthereumProvider();
    },
  }), [ready, authenticated, user, embedded, login, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function DemoSession({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(() => { try { return localStorage.getItem('zeeto-demo-auth') === '1'; } catch { return true; } });
  const set = (v: boolean) => { setAuthed(v); try { localStorage.setItem('zeeto-demo-auth', v ? '1' : '0'); } catch { /* ignore */ } };
  const value = useMemo<Session>(() => ({
    mode: 'demo', ready: true, authed, userId: authed ? 'demo:priya' : null, label: authed ? '+91 98•••• 4210' : null, handles: authed ? ['demo:priya'] : [],
    address: authed ? ME.wallet : null, login: () => set(true), logout: () => set(false), provider: async () => null,
  }), [authed]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Phone or email login with an embedded wallet on Whitechain. Falls back to a demo session without an app id. */
export function AuthProvider({ children }: { children: ReactNode }) {
  if (!APP_ID) return <DemoSession>{children}</DemoSession>;
  return (
    <PrivyProvider
      appId={APP_ID}
      config={{
        loginMethods: ['sms', 'email'],
        appearance: { theme: '#0A0A0A', accentColor: '#FF7A1A', logo: `${location.origin}/icon.svg`, landingHeader: 'Sign in to Zeeto' },
        embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
        defaultChain: whitechain,
        supportedChains: [whitechain],
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

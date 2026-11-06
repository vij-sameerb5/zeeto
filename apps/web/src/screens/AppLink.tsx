import { LogIn, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, serverOn } from '../lib/api';
import { short } from '@zeeto/core';
import { Mark } from '../components/kit';
import { useSession } from '../lib/auth';

/** Only the Zeeto phone app may receive the address: its own scheme, or Expo Go while developing. */
const safeReturn = (raw: string | null) => {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return ['zeeto:', 'exp:', 'exps:'].includes(u.protocol) ? u : null;
  } catch {
    return null;
  }
};

/**
 * /app-link?to=<app url>: the phone app opens this in an in-app browser, you sign in here with Privy,
 * then tap Continue. Only your public wallet address and a masked name go back. Never keys or tokens.
 */
export default function AppLink() {
  const [q] = useSearchParams();
  const s = useSession();
  const to = safeReturn(q.get('to'));

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const go = async () => {
    if (!to || !s.address) return;
    setBusy(true); setErr('');
    to.searchParams.set('address', s.address);
    if (s.label) to.searchParams.set('label', s.label);
    // The app's own 7-day session, so it can show your real orders and run your stall. Not your Privy login, not a key.
    if (serverOn()) {
      try { to.searchParams.set('token', (await api<{ token: string }>('/api/session', { body: {} })).token); }
      catch (e) { setErr((e as Error).message); setBusy(false); return; }
    }
    location.href = to.toString();
  };

  return (
    <div className="gutter mx-auto flex min-h-[100dvh] max-w-sm flex-col justify-center gap-5 py-10 text-center">
      <Mark />
      <Smartphone size={34} className="mx-auto text-z" />
      {!to ? (
        <>
          <h1 className="text-2xl font-extrabold">Link not valid</h1>
          <p className="text-mute">Open this from the Zeeto phone app.</p>
        </>
      ) : !s.authed ? (
        <>
          <h1 className="text-2xl font-extrabold">Sign in to Zeeto</h1>
          <p className="text-mute">Use your phone number or email. Your wallet is made for you.</p>
          <button onClick={s.login} className="btn-z"><LogIn size={16} /> Sign in</button>
        </>
      ) : !s.address ? (
        <p className="text-mute">Creating your wallet…</p>
      ) : (
        <>
          <h1 className="text-2xl font-extrabold">Connect the phone app?</h1>
          <p className="text-mute">The app will see your wallet address <b className="font-mono text-chalk">{short(s.address)}</b>, your orders and your stall. It can’t move money: payments always open here for you to confirm.</p>
          <button onClick={() => void go()} disabled={busy} className="btn-z">{busy ? 'Linking…' : 'Continue to Zeeto app'}</button>
          {err && <p className="text-sm text-bad">{err}</p>}
        </>
      )}
    </div>
  );
}

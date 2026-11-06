import { LogIn, Smartphone } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
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

  const go = () => {
    if (!to || !s.address) return;
    to.searchParams.set('address', s.address);
    if (s.label) to.searchParams.set('label', s.label);
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
          <p className="text-mute">The app will see your wallet address <b className="font-mono text-chalk">{short(s.address)}</b> and balance. It can’t move money; payments always ask you here first.</p>
          <button onClick={go} className="btn-z">Continue to Zeeto app</button>
        </>
      )}
    </div>
  );
}

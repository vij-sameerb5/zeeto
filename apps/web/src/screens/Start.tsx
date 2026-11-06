import { ArrowRight, Check, LogIn, ShoppingBag, Store } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mark } from '../components/kit';
import { useSession } from '../lib/auth';
import { img } from '../lib/media';
import { useApp } from '../store';

type As = 'customer' | 'merchant';

const ROLES: { id: As; title: string; sub: string; icon: typeof Store }[] = [
  { id: 'customer', title: 'I’m shopping', sub: 'Find stalls near you, order ahead, pay in USDT with no gas fee.', icon: ShoppingBag },
  { id: 'merchant', title: 'I run a stall or shop', sub: 'Take USDT payments, see orders, know your regulars. No crypto knowledge needed.', icon: Store },
];

/**
 * First screen of the app: pick shopping or selling, then sign in (or sign up: a new phone number makes a new account).
 * The pick only decides where the app opens. Who may sell is decided by the server when the stall is created.
 */
export default function Start() {
  const s = useSession();
  const nav = useNavigate();
  const [q] = useSearchParams();
  const saved = useApp((x) => x.startAs);
  const setStartAs = useApp((x) => x.setStartAs);
  const setRole = useApp((x) => x.setRole);
  const hasStall = useApp((x) => x.myStalls.some((v) => v.ownerId && v.ownerId === x.me));
  const fromUrl = q.get('as') === 'merchant' || q.get('as') === 'customer' ? (q.get('as') as As) : null;
  const [as, setAs] = useState<As | null>(fromUrl ?? saved);

  const pick = (r: As) => { setAs(r); setStartAs(r); };

  // Signed in with a choice made: go to the right home.
  useEffect(() => {
    if (!s.ready || !s.authed || !as) return;
    if (as === 'merchant' && s.userId) setRole(s.userId, 'merchant');
    nav(as === 'merchant' ? (hasStall ? '/sell' : '/join') : '/explore', { replace: true });
  }, [s.ready, s.authed, s.userId, as, hasStall, nav, setRole]);

  return (
    <main className="relative min-h-[100dvh] overflow-hidden">
      <img src={img('hero-tall')} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/80 to-bg" />
      <div className="gutter relative mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-6 py-10">
        <div className="flex items-center gap-3"><Mark size={40} /><span className="text-2xl font-extrabold tracking-tight">zeeto<span className="text-z">.</span></span></div>

        <div>
          <p className="label text-z">Step {as ? 2 : 1} of 2</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{as ? 'Sign in or create your account' : 'How will you use Zeeto?'}</h1>
          <p className="mt-2 text-mute">{as ? 'Use your phone number or email. New here? The same step makes your account and a wallet for you. No seed phrase.' : 'You can switch any time from your account menu.'}</p>
        </div>

        <div className="flex flex-col gap-3" role="radiogroup" aria-label="Choose how you use Zeeto">
          {ROLES.map(({ id, title, sub, icon: I }) => {
            const on = as === id;
            return (
              <button key={id} role="radio" aria-checked={on} onClick={() => pick(id)}
                className={`panel flex items-center gap-4 p-4 text-left transition ${on ? 'border-z bg-z-soft' : 'hover:bg-white/[.04]'} ${as && !on ? 'opacity-60' : ''}`}>
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${on ? 'bg-z text-z-ink' : 'bg-z-soft text-z'}`}><I size={22} /></span>
                <span className="min-w-0 flex-1"><span className="block font-bold">{title}</span><span className="block text-sm text-mute">{sub}</span></span>
                {on && <Check size={20} className="text-z" />}
              </button>
            );
          })}
        </div>

        {as && (
          !s.ready ? <p className="text-center text-mute">Loading sign-in…</p>
            : s.authed ? <p className="text-center text-mute">Signed in. Opening…</p>
              : <button onClick={s.login} className="btn-z"><LogIn size={16} /> Continue with phone or email</button>
        )}

        <div className="flex items-center justify-between text-sm">
          {as ? <button onClick={() => pick(as === 'merchant' ? 'customer' : 'merchant')} className="text-mute hover:text-chalk">Switch to {as === 'merchant' ? 'shopping' : 'selling'}</button> : <span />}
          <Link to="/explore" className="inline-flex items-center gap-1 text-mute hover:text-chalk">Just look around <ArrowRight size={14} /></Link>
        </div>
        {s.mode === 'demo' && <p className="text-center font-mono text-[10px] uppercase tracking-wider text-dim">Demo mode · sign-in is simulated on this build</p>}
      </div>
    </main>
  );
}

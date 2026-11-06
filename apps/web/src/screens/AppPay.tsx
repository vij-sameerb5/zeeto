import { CheckCircle2, Lock, LogIn } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { inr, type Order } from '@zeeto/core';
import { Mark } from '../components/kit';
import { PaySteps } from '../components/PayFlow';
import { api, serverOn, useServer } from '../lib/api';
import { useSession } from '../lib/auth';
import { PayError, retryOnServer, type PayStep } from '../lib/pay';
import { findVendor, useApp } from '../store';

/** Only the Zeeto phone app may be sent back to (its own scheme, or Expo Go while developing). */
const safeBack = (raw: string | null) => {
  if (!raw) return null;
  try { const u = new URL(raw); return ['zeeto:', 'exp:', 'exps:'].includes(u.protocol) ? u : null; } catch { return null; }
};

/**
 * /app-pay/:orderId?back=<app url> — the one step the phone app can't do itself: the wallet's signature.
 * The app already made the order (bag, prices and stall all checked by the server); this page shows it, the customer taps
 * Pay, the wallet signs once (no gas), and the page hands straight back to the app with the result.
 */
export default function AppPay() {
  const { id = '' } = useParams();
  const [q] = useSearchParams();
  const back = safeBack(q.get('back'));
  const s = useSession();
  const on = useServer((x) => x.status === 'on');
  const [o, setO] = useState<Order | null>(null);
  const [err, setErr] = useState('');
  const [step, setStep] = useState<PayStep>('idle');
  const [payErr, setPayErr] = useState<PayError | null>(null);
  const sent = useRef(false);

  const goBack = (status: 'paid' | 'cancel', order?: Order) => {
    if (!back || sent.current) return;
    sent.current = true;
    back.searchParams.set('order', id);
    back.searchParams.set('status', status);
    if (order?.code) back.searchParams.set('code', order.code);
    location.href = back.toString();
  };

  // Load the order once signed in (it must be yours; the server checks).
  useEffect(() => {
    if (!s.authed || !on) return;
    api<{ mine: Order[] }>('/api/orders').then((r) => {
      const mine = r.mine.find((x) => x.id === id);
      if (!mine) setErr('This order isn’t on your account. Sign in with the same phone or email as the app.');
      else { setO(mine); if (mine.status !== 'paying') goBack('paid', mine); }
    }, (e) => setErr((e as Error).message));
  }, [s.authed, on, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const pay = async () => {
    if (!o) return;
    setPayErr(null);
    try {
      const done = await retryOnServer(o, s, setStep);
      useApp.getState().upsertOrder(done);
      setStep('done');
      setTimeout(() => goBack('paid', done), 900);
    } catch (e) {
      setStep('failed');
      setPayErr(e instanceof PayError ? e : new PayError((e as Error).message));
    }
  };

  const v = o ? findVendor(o.vendorId) : null;
  return (
    <div className="gutter mx-auto flex min-h-[100dvh] max-w-sm flex-col justify-center gap-5 py-10">
      <div className="flex items-center gap-2"><Mark size={30} /><span className="font-extrabold">Zeeto</span><span className="ml-auto flex items-center gap-1 text-xs text-mute"><Lock size={12} /> Secure checkout</span></div>
      {!back ? <p className="text-mute">Open this from the Zeeto app.</p>
        : !serverOn() && !on ? <p className="text-mute">Connecting…</p>
          : !s.authed ? (
            <>
              <h1 className="text-2xl font-extrabold">Sign in to pay</h1>
              <p className="text-mute">Use the same phone or email as the Zeeto app.</p>
              <button onClick={s.login} className="btn-z"><LogIn size={16} /> Sign in</button>
            </>
          ) : err ? <p className="rounded-2xl bg-bad-soft p-4 text-sm text-bad">{err}</p>
            : !o ? <p className="text-mute">Loading your order…</p>
              : step === 'done' ? (
                <div className="flex flex-col items-center gap-3 text-center">
                  <CheckCircle2 size={48} className="text-good" />
                  <h1 className="text-2xl font-extrabold">Paid {inr(o.inr)}</h1>
                  <p className="text-mute">Taking you back to the app…</p>
                </div>
              ) : (
                <>
                  <div className="panel flex flex-col gap-3 p-5">
                    <div className="label">Pay</div>
                    <div className="text-3xl font-extrabold nums">{inr(o.inr)}</div>
                    <div className="text-sm text-mute">to <b className="text-chalk">{v?.name ?? 'the stall'}</b> · {(o.usd).toFixed(2)} USDT · no gas fee</div>
                    <ul className="mt-1 flex flex-col gap-1 border-t border-line pt-3 text-sm">
                      {o.lines.map((l) => <li key={l.productId} className="flex justify-between"><span>{l.qty} × {l.name}</span><span className="nums text-mute">{inr(l.qty * l.priceInr)}</span></li>)}
                    </ul>
                  </div>
                  {step !== 'idle' && <PaySteps step={step} intent={null} error={payErr} plain />}
                  <button onClick={() => void pay()} disabled={!['idle', 'failed'].includes(step)} className="btn-z py-4 text-base">{step === 'failed' ? 'Try again' : `Pay ${inr(o.inr)}`}</button>
                  <button onClick={() => goBack('cancel')} className="text-sm text-mute">Back to the app</button>
                </>
              )}
    </div>
  );
}

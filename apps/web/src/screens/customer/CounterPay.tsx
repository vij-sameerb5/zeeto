import { BadgeCheck, Check, Delete, Lock, MapPin, ShieldCheck, ShoppingBag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CATEGORIES, UNITS, inr, short, toUsd, type PaymentIntent, type Vendor } from '@zeeto/core';
import { AccountButton, useEnsureAuth } from '../../components/Account';
import { Face, Mark, Sim } from '../../components/kit';
import { PaySteps, runPay, type PayStep } from '../../components/PayFlow';
import { COUNTER_MAX_INR, useApp, useVendor } from '../../store';

/** Who you're paying, big and clear. Stops a swapped QR sticker: the name comes from Zeeto, not from the QR. */
function StallId({ v }: { v: Vendor }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <Face media={v.avatar} size={84} ring />
      <div className="flex items-center gap-1.5 text-2xl font-extrabold tracking-tight">{v.name}{v.verified && <BadgeCheck size={20} className="text-z" aria-label="Verified" />}</div>
      <div className="flex items-center gap-1 text-sm text-mute"><MapPin size={14} /> {v.landmark} · {CATEGORIES[v.category].label}</div>
      <p className="max-w-xs text-xs text-dim">Check this is the shop in front of you before paying.</p>
    </div>
  );
}

const Top = () => (
  <header className="gutter mx-auto flex h-16 max-w-md items-center justify-between pt-safe">
    <Link to="/explore" aria-label="Zeeto"><Mark size={32} /></Link>
    <AccountButton />
  </header>
);

/** Printed shop QR → /p/:vendorId. The customer types the amount the stall told them. */
export function PayStall() {
  const { id } = useParams();
  const v = useVendor(id);
  const nav = useNavigate();
  const openRequest = useApp((s) => s.openRequest);
  const [d, setD] = useState('');
  if (!v) return <div className="p-10 text-center text-mute">This QR isn’t a Zeeto stall. Don’t pay it.</div>;
  const n = Number(d || 0);
  const press = (k: string) => setD((x) => {
    if (k === 'del') return x.slice(0, -1);
    const next = (x + k).replace(/^0+/, '').slice(0, 5);
    return Number(next) > COUNTER_MAX_INR ? x : next;
  });
  return (
    <div className="min-h-[100dvh]">
      <Top />
      <div className="gutter mx-auto flex max-w-md flex-col gap-6 pb-10 pt-4">
        <StallId v={v} />
        <div className="text-center"><div className="label">Amount the stall told you</div><div className="mega mt-2 text-7xl nums">₹{d || '0'}</div><div className="mt-2 text-sm text-mute nums">≈ {toUsd(n).toFixed(2)} USDT</div></div>
        <div className="grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'del'].map((k) => (
            <button key={k} onClick={() => press(k)} aria-label={k === 'del' ? 'Delete' : k} className="grid h-14 place-items-center rounded-2xl bg-raised text-xl font-bold active:bg-z active:text-z-ink">{k === 'del' ? <Delete size={20} /> : k}</button>
          ))}
        </div>
        <button disabled={n < 1} onClick={() => nav(`/pay/r/${openRequest(v.id, n, [], 'customer')}`)} className="btn-z py-4 text-base">Continue</button>
        <Link to={`/s/${v.id}`} className="text-center text-sm text-z"><ShoppingBag size={14} className="mr-1 inline" />Order ahead from {v.name} instead</Link>
      </div>
    </div>
  );
}

/** Dynamic QR from the stall (amount locked) or the step after /p/:vendorId. One request, paid once. */
export function PayRequestPage() {
  const { id = '' } = useParams();
  const req = useApp((s) => s.requests[id]);
  const v = useVendor(req?.vendorId);
  const order = useApp((s) => s.myOrders.find((o) => o.id === req?.orderId));
  const counterOrder = useApp((s) => s.counterOrder);
  const counterPaid = useApp((s) => s.counterPaid);
  const [step, setStep] = useState<PayStep>('idle');
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const [now, setNow] = useState(Date.now());
  const ensure = useEnsureAuth();
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  if (!req || !v) {
    return (
      <div className="min-h-[100dvh]"><Top />
        <div className="gutter mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
          <h1 className="text-2xl font-extrabold">Payment request not found</h1>
          <p className="text-mute">Ask the stall to show a new QR. In this demo, open the link in the same browser as the stall screen.</p>
        </div>
      </div>
    );
  }

  const expired = req.status === 'open' && Date.parse(req.expiresAt) < now;
  const busy = step !== 'idle' && step !== 'failed' && step !== 'done';
  const usd = toUsd(req.inr).toFixed(2);

  const pay = async () => {
    if (!ensure()) return;
    const o = counterOrder(req.id);
    if (!o) return setStep('failed');
    try {
      const p = await runPay(o, v.wallet, setStep, setIntent);
      counterPaid(req.id, o.id, p);
      setStep('done');
    } catch { setStep('failed'); }
  };

  if (req.status === 'paid') {
    const t = new Date(now);
    return (
      <div className="min-h-[100dvh]"><Top />
        <div className="gutter mx-auto flex max-w-md flex-col items-center gap-5 py-6 text-center">
          <div className="relative grid h-32 w-32 place-items-center">
            <span className="absolute inset-0 rounded-full bg-good/30" style={{ animation: 'ping-ring 1.8s ease-out infinite' }} />
            <span className="relative grid h-28 w-28 place-items-center rounded-full bg-good text-bg"><Check size={58} strokeWidth={3} /></span>
          </div>
          <div><div className="label text-good">Paid to {v.name}</div><div className="mega mt-2 text-7xl nums">{inr(req.inr)}</div><div className="mt-2 font-mono text-mute">{usd} USDT · Whitechain</div></div>
          {/* A live clock so a screenshot of an old receipt is easy to spot */}
          <div className="rounded-2xl border border-good/40 bg-good-soft px-4 py-2 font-mono text-lg text-good nums" aria-label="Live time">{t.toLocaleTimeString('en-IN')}</div>
          <p className="text-sm text-mute">Show this screen. The stall’s phone already announced it.</p>
          {order?.payment && <div className="font-mono text-xs text-dim">tx {short(order.payment.tx)}{order.payment.simulated ? ' · simulated' : ''}</div>}
          {order && <div className="text-sm text-good">+{order.points} Zeeto points</div>}
          <Link to={order ? `/orders/${order.id}` : '/orders'} className="btn-line w-full">See receipt</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh]"><Top />
      <div className="gutter mx-auto flex max-w-md flex-col gap-5 pb-10 pt-4">
        <StallId v={v} />
        <div className="panel flex flex-col gap-2 p-5">
          {req.lines.map((l) => <div key={l.productId} className="flex justify-between text-sm"><span>{l.qty} {UNITS[l.unit]} {l.name}</span><span className="nums">{inr(l.qty * l.priceInr)}</span></div>)}
          <div className={`flex items-baseline justify-between ${req.lines.length ? 'border-t border-line pt-3' : ''}`}><span className="font-bold">To pay</span><span className="text-4xl font-extrabold nums">{inr(req.inr)}</span></div>
          <div className="flex justify-between text-sm text-mute"><span>{req.by === 'stall' ? 'Amount set by the stall' : 'Amount you entered'}</span><span className="font-mono">{usd} USDT</span></div>
        </div>

        {req.status === 'cancelled' && <p className="rounded-2xl bg-bad-soft p-4 text-sm text-bad">The stall cancelled this. Ask for a new QR.</p>}
        {expired && <p className="rounded-2xl bg-warn-soft p-4 text-sm text-warn">This QR expired after 5 minutes. Ask the stall for a new one.</p>}
        {step !== 'idle' && <PaySteps step={step} intent={intent} />}

        {req.status === 'open' && !expired && (
          <>
            <button onClick={pay} disabled={busy} className="btn-z py-4 text-base shadow-glow"><Lock size={16} /> {busy ? 'Paying…' : `Pay ${usd} USDT`}</button>
            <p className="flex items-start gap-2 text-xs text-mute"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-good" /> Money goes straight to {v.name}’s wallet {short(v.wallet)}. This QR works once and only for this amount.</p>
          </>
        )}
        <div className="flex justify-center"><Sim /></div>
      </div>
    </div>
  );
}

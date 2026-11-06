import { BadgeCheck, Check, Delete, Lock, MapPin, ShieldCheck, ShoppingBag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CATEGORIES, RAILS, UNITS, inr, short, toUsd, type PaymentIntent, type Vendor } from '@zeeto/core';
import { AccountButton, useEnsureAuth } from '../../components/Account';
import { Face, Mark, Sim } from '../../components/kit';
import { PayMode, PaySteps } from '../../components/PayFlow';
import { useSession } from '../../lib/auth';
import { PayError, canPayReal, payOnServer, payOrder, type PayStep } from '../../lib/pay';
import { api, serverOn, useServer } from '../../lib/api';
import { isServerStall, loadStalls } from '../../lib/sync';
import { COUNTER_MAX_INR, useApp, useVendor, type PayRequest } from '../../store';

/** The store's success URL with the session and order appended (the store must verify server-side with its API key). */
const backTo = (url: string, session: string, order?: string) => {
  const u = new URL(url);
  u.searchParams.set('zeeto_session', session);
  if (order) u.searchParams.set('zeeto_order', order);
  return u.toString();
};

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
  const session = useSession();
  const ensure = useEnsureAuth();
  const [step, setStep] = useState<PayStep>('idle');
  const [error, setError] = useState<PayError | null>(null);
  const server = useServer((x) => x.status);
  // A shared link can open before the stall list has loaded.
  useEffect(() => { if (!v && server === 'on') loadStalls().catch(() => undefined); }, [v, server]);
  if (!v && server === 'checking') return <div className="p-10 text-center text-mute">Loading…</div>;
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
        <div className="text-center"><div className="label">Amount the stall told you</div><div className="mega mt-2 text-7xl nums">₹{d || '0'}</div>{!isServerStall(v.id) && <div className="mt-2 text-sm text-mute nums">≈ {toUsd(n).toFixed(2)} USDT</div>}</div>
        <div className="grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'del'].map((k) => (
            <button key={k} onClick={() => press(k)} aria-label={k === 'del' ? 'Delete' : k} className="grid h-14 place-items-center rounded-2xl bg-raised text-xl font-bold active:bg-z active:text-z-ink">{k === 'del' ? <Delete size={20} /> : k}</button>
          ))}
        </div>
        {isServerStall(v.id) ? (
          <>
            {step !== 'idle' && <PaySteps step={step} intent={null} error={error} plain />}
            <button disabled={n < 1 || (step !== 'idle' && step !== 'failed')} className="btn-z py-4 text-base shadow-glow" onClick={async () => {
              if (!ensure()) return;
              setError(null);
              try {
                // Real stall: the server makes the order for exactly this amount and checks the payment onchain.
                const o = await payOnServer({ vendorId: v.id, amountInr: n }, session, setStep);
                useApp.getState().upsertOrder(o);
                nav(`/orders/${o.id}?new=1`, { replace: true });
              } catch (e) { setError(e instanceof PayError ? e : new PayError('Something went wrong. Nothing was charged.')); setStep('failed'); }
            }}><Lock size={16} /> {step !== 'idle' && step !== 'failed' ? 'Paying…' : `Pay ${inr(n)}`}</button>
            <PayMode real stall={v.name} />
          </>
        ) : (
          <button disabled={n < 1} onClick={() => nav(`/pay/r/${openRequest(v.id, n, [], 'customer')}`)} className="btn-z py-4 text-base">Continue</button>
        )}
        <Link to={`/s/${v.id}`} className="text-center text-sm text-z"><ShoppingBag size={14} className="mr-1 inline" />Order ahead from {v.name} instead</Link>
      </div>
    </div>
  );
}

/** Dynamic QR from the stall (amount locked) or the step after /p/:vendorId. One request, paid once. */
export function PayRequestPage() {
  const { id = '' } = useParams();
  const local = useApp((s) => s.requests[id]);
  const [remote, setRemote] = useState<PayRequest | null>(null);
  const [looking, setLooking] = useState(!local);
  const server = useServer((x) => x.status);
  const req = local ?? remote ?? undefined;
  // Bills from real stalls (and WhatsApp pay links) live on the server; poll so the status updates live.
  useEffect(() => {
    if (local || server === 'checking') return;
    if (server === 'off') { setLooking(false); return; }
    let on = true;
    const get = async () => {
      try {
        const r = await api<{ request: PayRequest & { status: string } }>(`/api/requests?id=${encodeURIComponent(id)}`, { auth: false });
        if (!on) return;
        const st = (r.request.status as string) === 'expired' ? 'open' : r.request.status; // expiry is checked by time below
        setRemote({ ...r.request, status: st as PayRequest['status'] });
        if (!useApp.getState().myStalls.some((x) => x.id === r.request.vendorId)) await loadStalls().catch(() => undefined);
      } catch { /* not found */ }
      if (on) setLooking(false);
    };
    void get();
    const t = setInterval(get, 3000);
    return () => { on = false; clearInterval(t); };
  }, [id, local, server]);
  const v = useVendor(req?.vendorId);
  const order = useApp((s) => s.myOrders.find((o) => o.id === req?.orderId));
  const counterOrder = useApp((s) => s.counterOrder);
  const counterPaid = useApp((s) => s.counterPaid);
  const [step, setStep] = useState<PayStep>('idle');
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const [error, setError] = useState<PayError | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const session = useSession();
  const pendingOrder = useApp((s) => s.myOrders.find((o) => o.id === pendingId && o.status === 'paying'));
  const [now, setNow] = useState(Date.now());
  const ensure = useEnsureAuth();
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  // Checkout API sessions: tell the store's page (checkout.js popup) and send the shopper back.
  useEffect(() => {
    if (!remote || remote.status !== 'paid') return;
    const msg = { type: 'zeeto:paid', session: remote.id, orderId: remote.orderId ?? null, reference: remote.reference ?? null };
    try { window.opener?.postMessage(msg, remote.successUrl ? new URL(remote.successUrl).origin : '*'); } catch { /* opener gone */ }
    if (remote.successUrl) { const t = setTimeout(() => { location.href = backTo(remote.successUrl!, remote.id, remote.orderId); }, 2500); return () => clearTimeout(t); }
  }, [remote]);

  if (looking && !req) return <div className="min-h-[100dvh]"><Top /><p className="p-10 text-center text-mute">Loading bill…</p></div>;
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
    setError(null);
    if (remote && serverOn()) {
      try {
        const o = await payOnServer({ requestId: remote.id }, session, setStep);
        useApp.getState().upsertOrder(o);
        setRemote({ ...remote, status: 'paid', orderId: o.id });
        setStep('done');
      } catch (e) { setError(e instanceof PayError ? e : new PayError('Something went wrong. Nothing was charged.')); setStep('failed'); }
      return;
    }
    // Retry reuses the same unpaid order; the request still settles only once.
    const o = pendingOrder ?? counterOrder(req.id, session.label ?? 'Customer', session.address);
    if (!o) { setError(new PayError('This QR can’t be paid any more. Ask the stall for a new one.')); return setStep('failed'); }
    setPendingId(o.id);
    try {
      const p = await payOrder(o, v, session, setStep, setIntent);
      counterPaid(req.id, o.id, p);
      setStep('done');
    } catch (e) { setError(e instanceof PayError ? e : new PayError('Something went wrong. Nothing was charged.')); setStep('failed'); }
  };

  if (req.status === 'paid') {
    const t = new Date(now);
    const receipt = order?.payment && !order.payment.simulated ? `${RAILS[order.payment.rail].txUrl(order.payment.tx)}` : null;
    return (
      <div className="min-h-[100dvh]"><Top />
        <div className="gutter mx-auto flex max-w-md flex-col items-center gap-5 py-6 text-center">
          <div className="relative grid h-32 w-32 place-items-center">
            <span className="absolute inset-0 rounded-full bg-good/30" style={{ animation: 'ping-ring 1.8s ease-out infinite' }} />
            <span className="relative grid h-28 w-28 place-items-center rounded-full bg-good text-bg"><Check size={58} strokeWidth={3} /></span>
          </div>
          <div><div className="label text-good">Paid to {v.name}</div><div className="mega mt-2 text-7xl nums">{inr(req.inr)}</div>{remote ? null : <div className="mt-2 font-mono text-mute">{usd} USDT · Whitechain</div>}</div>
          {/* A live clock so a screenshot of an old receipt is easy to spot */}
          <div className="rounded-2xl border border-good/40 bg-good-soft px-4 py-2 font-mono text-lg text-good nums" aria-label="Live time">{t.toLocaleTimeString('en-IN')}</div>
          <p className="text-sm text-mute">Show this screen. The stall’s phone already announced it.</p>
          {order?.payment && !remote && <div className="font-mono text-xs text-dim">tx {short(order.payment.tx)}{order.payment.simulated ? ' · simulated' : ''}</div>}
          {receipt && <a href={receipt} target="_blank" rel="noreferrer" className="text-xs text-mute underline-offset-2 hover:underline">Public receipt</a>}
          {remote?.successUrl && <a href={backTo(remote.successUrl, remote.id, order?.id)} className="btn-z w-full">Back to the store</a>}
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
          <div className="flex justify-between text-sm text-mute"><span>{req.by === 'customer' ? 'Amount you entered' : 'Amount set by the stall'}</span>{!remote && <span className="font-mono">{usd} USDT</span>}</div>
        </div>

        {req.status === 'cancelled' && <p className="rounded-2xl bg-bad-soft p-4 text-sm text-bad">The stall cancelled this. Ask for a new QR.</p>}
        {expired && <p className="rounded-2xl bg-warn-soft p-4 text-sm text-warn">This QR expired after 5 minutes. Ask the stall for a new one.</p>}
        {step !== 'idle' && <PaySteps step={step} intent={intent} error={error} plain={!!remote} />}
        {req.status === 'open' && <PayMode real={!!remote || canPayReal(v, session.address)} stall={v.name} />}

        {req.status === 'open' && !expired && (
          <>
            <button onClick={pay} disabled={busy} className="btn-z py-4 text-base shadow-glow"><Lock size={16} /> {busy ? 'Paying…' : remote ? `Pay ${inr(req.inr)}` : `Pay ${usd} USDT`}</button>
            <p className="flex items-start gap-2 text-xs text-mute"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-good" /> Goes straight to {v.name}. This link works once and only for this amount.</p>
          </>
        )}
        {!remote && <div className="flex justify-center"><Sim /></div>}
      </div>
    </div>
  );
}

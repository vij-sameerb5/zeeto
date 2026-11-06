import { ArrowRightLeft, Loader2, Lock, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FX, RAILS, UNITS, inr, mockPayments, pointsFor, short, toUsd, type Order, type PaymentIntent, type Quote, type RailId } from '@zeeto/core';
import { PayMode, PaySteps } from '../../components/PayFlow';
import { useSession } from '../../lib/auth';
import { PayError, canPayReal, payOnServer, payOrder, retryOnServer, type PayStep } from '../../lib/pay';
import { isServerStall } from '../../lib/sync';
import { useEnsureAuth } from '../../components/Account';
import { Empty, Face, Header, Pic, Qty, Sim } from '../../components/kit';
import { findVendor, useApp } from '../../store';

type Step = PayStep;

export default function Bag() {
  const nav = useNavigate();
  const bag = useApp((s) => s.bag);
  const products = useApp((s) => s.products);
  const setQty = useApp((s) => s.setQty);
  const checkout = useApp((s) => s.checkout);
  const paid = useApp((s) => s.paid);
  const [step, setStep] = useState<Step>('idle');
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const [error, setError] = useState<PayError | null>(null);
  const [rail, setRail] = useState<RailId>('streetpay-usdt');
  const [quote, setQuote] = useState<Quote | null>(null);
  // A failed payment keeps its order, so "try again" never creates a second one.
  const [pending, setPending] = useState<Order | null>(null);
  const s = useSession();
  const v = findVendor(bag.vendorId);
  const lines = Object.entries(bag.lines).map(([id, n]) => ({ p: products.find((x) => x.id === id), n })).filter((l) => l.p);
  const total = lines.reduce((s, l) => s + l.n * l.p!.priceInr, 0);
  const busy = step !== 'idle' && step !== 'failed';
  const ensure = useEnsureAuth();

  if (!v || !lines.length) {
    return (
      <div className="min-h-[100dvh]">
        <Header title="Your bag" back />
        <Empty icon="ShoppingBasket" title="Your bag is empty" body="Open a stall and add what you need. Pickup is at one stall per order." action={<Link to="/explore" className="btn-z">Find a stall</Link>} />
      </div>
    );
  }

  // A real stall on the Zeeto server: the server prices the order and verifies the payment onchain.
  const live = isServerStall(v.id);
  const real = rail === 'streetpay-usdt' && (live || canPayReal(v, s.address));
  const rails = (['streetpay-usdt', 'uniswap-usdc'] as RailId[]).filter((r) => v.rails.includes(r) && (!live || r === 'streetpay-usdt'));
  const usd = toUsd(total);

  const pay = async () => {
    if (!ensure()) return;
    setError(null);
    if (live) {
      try {
        const o = pending?.server && pending.vendorId === v.id && pending.inr === total && pending.status === 'paying'
          ? await retryOnServer(pending, s, setStep)
          : await payOnServer({ vendorId: v.id, lines: lines.map((l) => ({ productId: l.p!.id, qty: l.n })) }, s, setStep, (o) => { setPending(o); useApp.getState().upsertOrder(o); });
        useApp.getState().upsertOrder(o);
        useApp.setState({ bag: { vendorId: null, lines: {} } });
        setStep('done');
        nav(`/orders/${o.id}?new=1`, { replace: true });
      } catch (e) {
        setError(e instanceof PayError ? e : new PayError('Something went wrong. Nothing was charged. Try again.'));
        setStep('failed');
      }
      return;
    }
    const order = pending && pending.vendorId === v.id && pending.inr === total ? pending : checkout(s.label ?? 'Customer', s.address);
    if (!order) return;
    setPending(order);
    try {
      let p;
      if (rail === 'uniswap-usdc') {
        // Uniswap route: quote ETH → USDC, then swap and pay. Simulated until the Uniswap API key is set.
        setStep('check');
        const q = await mockPayments.quote(order.usd);
        setQuote(q);
        setStep('sign');
        p = await mockPayments.payEth(order, q);
        setStep('verify');
      } else {
        p = await payOrder(order, v, s, setStep, setIntent);
      }
      paid(order.id, p);
      setStep('done');
      nav(`/orders/${order.id}?new=1`, { replace: true });
    } catch (e) {
      setError(e instanceof PayError ? e : new PayError('Something went wrong. Nothing was charged. Try again.'));
      setStep('failed');
    }
  };

  return (
    <div className="min-h-[100dvh] pb-40">
      <Header title="Your bag" sub={`Pickup at ${v.name}`} back />
      <div className="gutter mx-auto grid max-w-5xl gap-6 pt-6 lg:grid-cols-[1fr_400px]">
        <section className="flex flex-col gap-4">
          <Link to={`/s/${v.id}`} className="panel flex items-center gap-3 p-4 hover:border-line-2">
            <Face media={v.avatar} size={52} />
            <div className="min-w-0 flex-1"><div className="font-bold">{v.name}</div><div className="truncate text-sm text-mute">{v.landmark} · {v.hours.replace('-', '–')}</div></div>
            <span className="text-sm text-z">Add more</span>
          </Link>
          <ul className="panel divide-y divide-line">
            {lines.map(({ p, n }) => (
              <li key={p!.id} className="flex items-center gap-3 p-3">
                <Pic media={p!.image} className="h-14 w-14 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{p!.name}</div>
                  <div className="text-sm text-mute nums">{inr(p!.priceInr)} / {UNITS[p!.unit]} · <b className="text-chalk">{inr(n * p!.priceInr)}</b></div>
                </div>
                <Qty qty={n} max={p!.stock} onChange={(q) => setQty(v.id, p!.id, q)} />
                <button aria-label={`Remove ${p!.name}`} disabled={busy} onClick={() => setQty(v.id, p!.id, 0)} className="grid h-9 w-9 place-items-center rounded-full text-dim hover:bg-white/5 hover:text-bad"><Trash2 size={16} /></button>
              </li>
            ))}
          </ul>
          <p className="flex items-start gap-2 text-sm text-mute"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-good" /> The stall only sees your order once the payment is confirmed onchain. If they can’t fill it, you’re refunded in USDT.</p>
        </section>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <div className="panel flex flex-col gap-3 p-5">
            <Row l="Items" r={inr(total)} />
            <Row l="Pickup" r="Free" />
            <div className="my-1 h-px bg-line" />
            <Row l="Total" r={inr(total)} big />
            {!live && <Row l={<>You pay <span className="text-dim">(₹{FX.inrPerUsd} = $1 demo rate)</span></>} r={`${toUsd(total).toFixed(2)} USDT`} />}
            <div className="text-sm text-good">+{pointsFor(total)} points on your {v.name.split(' ')[0]} card</div>
          </div>

          {!live && <fieldset className="panel flex flex-col gap-2 p-3" disabled={busy}>
            <legend className="sr-only">Pay with</legend>
            <div className="label px-2 pt-1 text-z">Pay with</div>
            {rails.map((r) => {
              const R = RAILS[r];
              const on = rail === r;
              return (
                <label key={r} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 ${on ? 'border-z bg-z-soft' : 'border-line hover:border-line-2'}`}>
                  <input type="radio" name="rail" checked={on} onChange={() => setRail(r)} className="mt-1 accent-[#FF7A1A]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-semibold">{r === 'uniswap-usdc' && <ArrowRightLeft size={15} className="text-z" />}{R.label}</div>
                    <div className="text-xs text-mute">{R.blurb}</div>
                    <div className="mt-1 truncate font-mono text-[10px] text-dim">{R.network} · to {short(v.wallet)}</div>
                  </div>
                  {r === 'uniswap-usdc' || !real ? <Sim /> : <span className="rounded-full bg-good-soft px-2 py-0.5 font-mono text-[10px] uppercase text-good">Live</span>}
                </label>
              );
            })}
          </fieldset>}
          {rail === 'uniswap-usdc' && quote && <div className="panel p-4 text-sm"><div className="label mb-1">Uniswap quote</div>{quote.ethIn.toFixed(5)} ETH → {quote.usdcOut.toFixed(2)} USDC · {quote.route} · impact {quote.impactPct}%</div>}

          {step !== 'idle' && <PaySteps step={step} intent={rail === 'streetpay-usdt' ? intent : null} error={error} plain={live} />}
          {rail === 'streetpay-usdt' ? <PayMode real={real} stall={v.name} /> : <p className="text-xs text-warn">Uniswap payments are simulated until the Uniswap API key is added.</p>}


          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 p-4 backdrop-blur-xl pb-safe lg:static lg:border-0 lg:bg-transparent lg:p-0">
            <button onClick={pay} disabled={busy} className="btn-z w-full py-4 text-base shadow-glow">
              {busy ? <><Loader2 size={18} className="animate-spin" /> {step === 'sign' && !live ? 'Confirm in your wallet…' : 'Paying…'}</> : step === 'failed' ? <><Lock size={16} /> Try again</> : <><Lock size={16} /> Pay {live ? inr(total) : rail === 'uniswap-usdc' ? `${(usd / FX.usdPerEth).toFixed(5)} ETH` : `${usd.toFixed(2)} USDT`}</>}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

const Row = ({ l, r, big }: { l: React.ReactNode; r: string; big?: boolean }) => (
  <div className={`flex items-baseline justify-between gap-4 ${big ? 'text-lg font-extrabold' : 'text-sm'}`}><span className={big ? '' : 'text-mute'}>{l}</span><span className="nums">{r}</span></div>
);

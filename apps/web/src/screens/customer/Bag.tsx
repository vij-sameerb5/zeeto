import { Loader2, Lock, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FX, RAILS, UNITS, VENDORS, inr, pointsFor, short, toUsd, type PaymentIntent } from '@zeeto/core';
import { PaySteps, runPay, type PayStep } from '../../components/PayFlow';
import { useEnsureAuth } from '../../components/Account';
import { Empty, Face, Header, Pic, Qty, Sim } from '../../components/kit';
import { useApp } from '../../store';

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
  const v = VENDORS.find((x) => x.id === bag.vendorId);
  const lines = Object.entries(bag.lines).map(([id, n]) => ({ p: products.find((x) => x.id === id), n })).filter((l) => l.p);
  const total = lines.reduce((s, l) => s + l.n * l.p!.priceInr, 0);
  const rail = RAILS['streetpay-usdt'];
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

  const pay = async () => {
    if (!ensure()) return;
    const order = checkout();
    if (!order) return;
    try {
      const p = await runPay(order, v.wallet, setStep, setIntent);
      paid(order.id, p);
      setStep('done');
      nav(`/orders/${order.id}?new=1`, { replace: true });
    } catch {
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
            <Row l={<>You pay <span className="text-dim">(₹{FX.inrPerUsd} = $1 demo rate)</span></>} r={`${toUsd(total).toFixed(2)} USDT`} />
            <div className="text-sm text-good">+{pointsFor(total)} points with this order</div>
          </div>

          <div className="panel flex flex-col gap-3 border-z/40 p-5">
            <div className="flex items-center justify-between"><span className="label text-z">Pay with</span><Sim /></div>
            <div className="text-lg font-bold">{rail.label}</div>
            <p className="text-sm text-mute">{rail.blurb}</p>
            <div className="font-mono text-[11px] text-dim">{rail.network} · chain {rail.chainId} · to {short(v.wallet)}</div>
          </div>

          {step !== 'idle' && <PaySteps step={step} intent={intent} />}

          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 p-4 backdrop-blur-xl pb-safe lg:static lg:border-0 lg:bg-transparent lg:p-0">
            <button onClick={pay} disabled={busy} className="btn-z w-full py-4 text-base shadow-glow">
              {busy ? <><Loader2 size={18} className="animate-spin" /> Paying…</> : <><Lock size={16} /> Pay {toUsd(total).toFixed(2)} USDT</>}
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

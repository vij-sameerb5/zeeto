import { CheckCircle2, ExternalLink, MapPin, PartyPopper } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { RAILS, UNITS, VENDORS, ago, inr, short, type OrderStatus } from '@zeeto/core';
import { Face, Header, Sim, Status } from '../../components/kit';
import { useApp } from '../../store';

const TRACK: { s: OrderStatus[]; label: string }[] = [
  { s: ['paid', 'accepted', 'ready', 'done'], label: 'Paid' },
  { s: ['accepted', 'ready', 'done'], label: 'Accepted' },
  { s: ['ready', 'done'], label: 'Ready' },
  { s: ['done'], label: 'Picked up' },
];

export default function OrderDetail() {
  const { id } = useParams();
  const [q] = useSearchParams();
  const o = useApp((s) => s.myOrders.find((x) => x.id === id));
  if (!o) return <Navigate to="/orders" replace />;
  const v = VENDORS.find((x) => x.id === o.vendorId)!;
  const live = ['paid', 'accepted', 'ready'].includes(o.status);
  const p = o.payment;
  const rail = p ? RAILS[p.rail] : null;

  return (
    <div className="min-h-[100dvh] pb-28">
      <Header title={`Order ${o.id.toUpperCase()}`} sub={`${v.name} · ${ago(o.at)}`} back="/orders" right={<Status s={o.status} />} />
      <div className="gutter mx-auto grid max-w-5xl gap-6 pt-6 md:grid-cols-[1fr_360px]">
        <section className="flex flex-col gap-5">
          {q.get('new') && (
            <div className="a-up flex items-center gap-3 rounded-[22px] border border-good/30 bg-good-soft p-4">
              <PartyPopper className="shrink-0 text-good" />
              <div><div className="font-bold">Paid. {v.owner.split(' ')[0]} has your order.</div><div className="text-sm text-mute">You earned {o.points} points. We’ll show “Ready” here when it’s packed.</div></div>
            </div>
          )}

          <ol className="panel grid grid-cols-4 gap-2 p-4">
            {TRACK.map((t) => {
              const on = t.s.includes(o.status);
              return (
                <li key={t.label} className="flex flex-col items-center gap-2 text-center">
                  <span className={`h-1.5 w-full rounded-full ${on ? 'bg-z' : 'bg-raised'}`} />
                  <span className={`text-xs font-semibold ${on ? '' : 'text-dim'}`}>{t.label}</span>
                </li>
              );
            })}
          </ol>

          <div className="panel flex flex-col gap-3 p-5">
            <div className="flex items-center gap-3">
              <Face media={v.avatar} size={48} />
              <div className="min-w-0 flex-1"><Link to={`/s/${v.id}`} className="font-bold hover:text-z">{v.name}</Link><div className="text-sm text-mute">{v.landmark}</div></div>
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${v.location.lat},${v.location.lng}&travelmode=walking`} target="_blank" rel="noreferrer" className="btn-line px-4 py-2 text-sm"><MapPin size={15} /> Walk there</a>
            </div>
            <ul className="divide-y divide-line">
              {o.lines.map((l) => (
                <li key={l.productId} className="flex justify-between py-2.5 text-sm"><span>{l.qty} × {l.name} <span className="text-dim">/ {UNITS[l.unit]}</span></span><span className="nums">{inr(l.qty * l.priceInr)}</span></li>
              ))}
            </ul>
            <div className="flex justify-between border-t border-line pt-3 text-lg font-extrabold"><span>Total</span><span className="nums">{inr(o.inr)}</span></div>
          </div>

          {p && rail && (
            <div className="panel flex flex-col gap-2 p-5">
              <div className="flex items-center justify-between"><span className="label">Payment</span>{p.simulated && <Sim />}</div>
              <div className="font-bold nums">{p.paidAmount.toFixed(p.paidToken === 'ETH' ? 5 : 2)} {p.paidToken} → {p.settled.toFixed(2)} {p.settledToken}</div>
              <div className="text-sm text-mute">{rail.label} · {rail.network} · chain {p.chainId}</div>
              {p.simulated ? (
                <div className="font-mono text-xs text-dim">tx {short(p.tx)} (simulated, not on a block explorer)</div>
              ) : (
                <a href={rail.txUrl(p.tx)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-z">tx {short(p.tx)} <ExternalLink size={12} /></a>
              )}
              {o.refunds.map((r, i) => <div key={i} className="text-sm text-warn">Refunded {r.amount.toFixed(2)} {r.token}: {r.reason}</div>)}
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-4 md:sticky md:top-24 md:self-start">
          <div className={`panel flex flex-col items-center gap-4 p-6 text-center ${live ? 'border-z/50 shadow-glow' : ''}`}>
            {live ? (
              <>
                <span className="label">Show this at the stall</span>
                <div className="rounded-2xl bg-chalk p-3"><QRCodeSVG value={`zeeto:pickup:${o.id}:${o.code}`} size={168} bgColor="#FAF8F3" fgColor="#0A0A0A" /></div>
                <div className="font-mono text-4xl font-bold tracking-[0.18em]">{o.code}</div>
                <p className="text-sm text-mute">{v.owner.split(' ')[0]} types this code to hand over your order. Don’t share it before you’re at the stall.</p>
              </>
            ) : (
              <>
                <CheckCircle2 size={36} className={o.status === 'done' ? 'text-good' : 'text-mute'} />
                <div className="text-lg font-bold">{o.status === 'done' ? 'Picked up' : o.status === 'paying' ? 'Waiting for payment' : 'Refunded'}</div>
                <div className="font-mono text-mute">{o.code}</div>
              </>
            )}
          </div>
          {o.points > 0 && <div className="panel flex items-center justify-between p-4"><span className="text-sm text-mute">Points earned</span><span className="font-extrabold text-z nums">+{o.points}</span></div>}
        </aside>
      </div>
    </div>
  );
}

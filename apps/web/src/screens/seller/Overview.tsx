import { ArrowRight, Bell, Camera, ClipboardList, QrCode, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { WEEK_INR, inr, toUsd } from '@zeeto/core';
import { Face, Header, Metric, Sim, Status } from '../../components/kit';
import { MY_STALL, useApp, useVendor } from '../../store';

const DAYS = ['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Today'];

export default function Overview() {
  const v = useVendor(MY_STALL)!;
  const orders = useApp((s) => s.stallOrders.filter((o) => o.vendorId === MY_STALL));
  const products = useApp((s) => s.products.filter((p) => p.vendorId === MY_STALL));
  const today = orders.filter((o) => Date.now() - new Date(o.at).getTime() < 864e5 && !['paying', 'refunded'].includes(o.status));
  const sales = today.reduce((s, o) => s + o.inr, 0);
  const waiting = orders.filter((o) => o.status === 'paid');
  const packing = orders.filter((o) => o.status === 'accepted' || o.status === 'ready');
  const low = products.filter((p) => p.stock > 0 && p.stock <= 5);
  const out = products.filter((p) => p.stock <= 0);
  const week = [...WEEK_INR.slice(0, 6), Math.max(sales, WEEK_INR[6])];
  const max = Math.max(...week);

  return (
    <div>
      <Header title={`Namaste, ${v.owner.split(' ')[0]}`} sub={v.name} right={<Face media={v.avatar} size={40} />} />
      <div className="gutter mx-auto flex max-w-5xl flex-col gap-6 py-6">
        {waiting.length > 0 && (
          <Link to="/sell/orders" className="a-up flex items-center gap-4 rounded-[24px] border border-z/50 bg-gradient-to-r from-z/25 to-transparent p-4 shadow-glow">
            <span className="relative grid h-12 w-12 place-items-center rounded-full bg-z text-z-ink"><Bell size={22} /><span className="absolute inset-0 rounded-full bg-z" style={{ animation: 'ping-ring 1.6s ease-out infinite' }} /></span>
            <div className="flex-1"><div className="font-bold">{waiting.length} new paid order{waiting.length > 1 ? 's' : ''}</div><div className="text-sm text-mute">Accept to start packing. The customer already paid.</div></div>
            <ArrowRight className="text-z" />
          </Link>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="Today" value={inr(sales)} hint={`≈ ${toUsd(sales).toFixed(2)} USDT`} hot />
          <Metric label="Orders today" value={today.length} hint={`${packing.length} being packed`} />
          <Metric label="Followers" value={v.followers.toLocaleString('en-IN')} hint="see your alerts" />
          <Metric label="Stock alerts" value={low.length + out.length} hint={`${out.length} sold out · ${low.length} low`} />
        </div>

        <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
          <section className="panel p-5">
            <div className="flex items-center justify-between"><div className="label">This week</div><Sim label="Demo history" /></div>
            <div className="mt-5 flex h-40 items-end gap-2" aria-label="Sales this week">
              {week.map((n, i) => (
                <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <span className="text-[10px] text-dim nums">{Math.round(n / 100) / 10}k</span>
                  <div className={`w-full rounded-lg ${i === 6 ? 'bg-z shadow-glow' : 'bg-raised'}`} style={{ height: `${Math.max(6, (n / max) * 100)}px`, minHeight: 6 }} />
                  <span className={`text-[11px] ${i === 6 ? 'font-bold text-chalk' : 'text-dim'}`}>{DAYS[i]}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3">
            {[
              { to: '/sell/collect', icon: <QrCode />, l: 'Collect', d: 'Customer at the counter' },
              { to: '/sell/products?snap=1', icon: <Camera />, l: 'Snap & Sell', d: 'Photo → listing' },
              { to: '/sell/orders', icon: <ClipboardList />, l: 'Orders', d: `${waiting.length + packing.length} open` },
              { to: '/sell/payments', icon: <Wallet />, l: 'Payments', d: 'USDT received' },
            ].map((x) => (
              <Link key={x.l} to={x.to} className="panel flex flex-col gap-3 p-4 transition hover:border-z/40">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-z-soft text-z">{x.icon}</span>
                <div><div className="font-bold">{x.l}</div><div className="text-xs text-mute">{x.d}</div></div>
              </Link>
            ))}
          </section>
        </div>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between"><div className="label">Latest orders</div><Link to="/sell/orders" className="text-sm text-z">All orders</Link></div>
          <ul className="panel divide-y divide-line">
            {orders.slice(0, 4).map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                <div className="min-w-0"><div className="font-semibold">{o.customer} · {o.id.toUpperCase()}</div><div className="truncate text-mute">{o.lines.map((l) => `${l.qty} ${l.name}`).join(', ')}</div></div>
                <div className="flex shrink-0 items-center gap-3"><span className="font-bold nums">{inr(o.inr)}</span><Status s={o.status} /></div>
              </li>
            ))}
          </ul>
        </section>

        {(low.length > 0 || out.length > 0) && (
          <section className="panel flex flex-col gap-2 p-5">
            <div className="label">Restock</div>
            {[...out, ...low].map((p) => <div key={p.id} className="flex justify-between text-sm"><span>{p.name}</span><span className={p.stock <= 0 ? 'text-bad' : 'text-warn'}>{p.stock <= 0 ? 'Sold out' : `${p.stock} left`}</span></div>)}
            <Link to="/sell/products" className="mt-2 text-sm text-z">Update stock →</Link>
          </section>
        )}
      </div>
    </div>
  );
}

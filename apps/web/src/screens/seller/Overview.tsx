import { ArrowRight, ArrowUpRight, Bell, Bot, MessageCircle, Camera, ClipboardList, Flame, Loader2, Package, QrCode, Send, Sparkles, TrendingUp, Users, Wallet, Zap } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { WEEK_INR, ago, inr, tierFor, toUsd, type Order, type Product } from '@zeeto/core';
import { Face, Status } from '../../components/kit';
import { api, feature } from '../../lib/api';
import { isDemoStall, useMyStallId, useApp, useVendor } from '../../store';

const COUNTED: Order['status'][] = ['paid', 'accepted', 'ready', 'done', 'part-refunded'];
const DAY = 864e5;

/** Counts up to a number once, so the dashboard feels alive (instant with reduced motion). */
function useCount(target: number, ms = 900) {
  const [n, setN] = useState(target);
  const from = useRef(0);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(target); return; }
    const start = performance.now(); const a = from.current;
    let raf = 0;
    const tick = (t: number) => { const k = Math.min(1, (t - start) / ms); const e = 1 - (1 - k) ** 3; setN(a + (target - a) * e); if (k < 1) raf = requestAnimationFrame(tick); else from.current = target; };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return n;
}

export default function Overview() {
  const MY = useMyStallId();
  const v = useVendor(MY)!;
  const sample = isDemoStall(MY);
  const all = useApp((s) => s.stallOrders);
  const allProducts = useApp((s) => s.products);
  const orders = useMemo(() => all.filter((o) => o.vendorId === MY), [all, MY]);
  const products = useMemo(() => allProducts.filter((p) => p.vendorId === MY), [allProducts, MY]);
  const [range, setRange] = useState<7 | 30>(7);

  const s = useMemo(() => stats(orders, products, range, sample), [orders, products, range, sample]);
  const waiting = orders.filter((o) => o.status === 'paid');

  return (
    <div className="relative min-h-[100dvh] overflow-hidden">
      <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-z/10 blur-[120px]" />
      <div className="gutter relative mx-auto flex max-w-6xl flex-col gap-6 py-6 md:py-10">
        {/* Hero */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <Face media={v.avatar} size={56} ring />
            <div>
              <p className="label text-z">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}{sample ? ' · sample stall' : ''}</p>
              <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Namaste, {v.owner.split(' ')[0].replace(/^0x.*/, 'friend')}</h1>
              <p className="text-mute">{v.name}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to={`/s/${MY}`} className="btn-line px-4 py-2 text-sm">View my stall <ArrowUpRight size={15} /></Link>
            <Link to="/sell/collect" className="btn-z px-4 py-2 text-sm"><QrCode size={16} /> Collect</Link>
          </div>
        </header>

        {waiting.length > 0 && (
          <Link to="/sell/orders" className="a-up flex items-center gap-4 rounded-[24px] border border-z/50 bg-gradient-to-r from-z/25 to-transparent p-4 shadow-glow">
            <span className="relative grid h-12 w-12 place-items-center rounded-full bg-z text-z-ink"><Bell size={22} /><span className="absolute inset-0 rounded-full bg-z" style={{ animation: 'ping-ring 1.6s ease-out infinite' }} /></span>
            <div className="flex-1"><div className="font-bold">{waiting.length} new paid order{waiting.length > 1 ? 's' : ''}</div><div className="text-sm text-mute">Accept to start packing. The customer already paid.</div></div>
            <ArrowRight className="text-z" />
          </Link>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={<TrendingUp size={16} />} label="Sales today" value={s.today} fmt={inr} hint={`≈ ${toUsd(s.today).toFixed(2)} USDT · ${s.delta >= 0 ? '▲' : '▼'} ${Math.abs(s.delta)}% vs yesterday`} hot />
          <Kpi icon={<ClipboardList size={16} />} label="Orders today" value={s.ordersToday} hint={`${s.open} open now`} />
          <Kpi icon={<Users size={16} />} label="Come back" value={s.returning} fmt={(n) => `${Math.round(n)}%`} hint={`${s.customers} customers in ${range} days`} />
          <Kpi icon={<Zap size={16} />} label="Gas paid for them" value={s.gasless} hint="payments your customers made with zero gas" />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          {/* Sales chart */}
          <section className="panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><div className="label">Sales</div><div className="mt-1 text-2xl font-extrabold nums">{inr(s.rangeTotal)}<span className="ml-2 text-sm font-normal text-mute">last {range} days</span></div></div>
              <div className="flex rounded-full border border-line p-1 text-xs">{([7, 30] as const).map((r) => <button key={r} onClick={() => setRange(r)} className={`rounded-full px-3 py-1.5 ${range === r ? 'bg-chalk font-bold text-bg' : 'text-mute'}`}>{r}d</button>)}</div>
            </div>
            <Bars days={s.days} />
            {sample && <p className="mt-2 text-xs text-dim">Sample stall: earlier days are example numbers.</p>}
          </section>

          <Assistant sample={sample} local={s} />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Busiest hours */}
          <section className="panel p-5">
            <div className="label flex items-center gap-1.5"><Flame size={14} className="text-z" /> Busiest hours</div>
            <div className="mt-4 grid grid-cols-12 gap-1" role="img" aria-label="Orders by hour of day">
              {s.hours.map((n, h) => (
                <div key={h} title={`${h}:00 · ${n} orders`} className="aspect-square rounded-md" style={{ background: n ? `rgba(255,122,26,${0.15 + 0.85 * (n / s.maxHour)})` : 'rgba(250,248,243,0.05)' }} />
              ))}
            </div>
            <div className="mt-2 flex justify-between font-mono text-[10px] text-dim"><span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span></div>
            <p className="mt-3 text-sm text-mute">{s.peak !== null ? <>Most orders around <b className="text-chalk">{fmtHour(s.peak)}</b>. Keep stock ready before then.</> : 'Shows up after your first orders.'}</p>
          </section>

          {/* Top products */}
          <section className="panel p-5">
            <div className="flex items-center justify-between"><div className="label">Best sellers</div><Link to="/sell/products" className="text-xs text-z">Products</Link></div>
            <ul className="mt-4 flex flex-col gap-3">
              {s.top.length ? s.top.map((t) => (
                <li key={t.name} className="text-sm">
                  <div className="flex justify-between"><span className="truncate font-semibold">{t.name}</span><span className="nums text-mute">{inr(t.inr)}</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-raised"><div className="h-full rounded-full bg-z transition-all duration-700" style={{ width: `${(t.inr / s.top[0].inr) * 100}%` }} /></div>
                </li>
              )) : <li className="text-sm text-mute">Your best sellers show here after a few orders.</li>}
            </ul>
          </section>

          {/* Stock */}
          <section className="panel p-5">
            <div className="flex items-center justify-between"><div className="label flex items-center gap-1.5"><Package size={14} /> Stock</div><span className="text-xs text-mute">{products.length} items</span></div>
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              {s.restock.length ? s.restock.map((p) => (
                <li key={p.id} className="flex justify-between"><span className="truncate">{p.name}</span><span className={p.stock <= 0 ? 'text-bad' : 'text-warn'}>{p.stock <= 0 ? 'Sold out' : `${p.stock} left`}</span></li>
              )) : <li className="text-mute">{products.length ? 'Everything is in stock.' : 'No products yet.'}</li>}
            </ul>
            <Link to={products.length ? '/sell/products' : '/sell/products?snap=1'} className="mt-4 inline-flex items-center gap-1 text-sm text-z">{products.length ? 'Update stock' : 'Add products'} <ArrowRight size={14} /></Link>
          </section>
        </div>

        {/* Quick actions */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { to: '/sell/collect', icon: <QrCode />, l: 'Collect', d: 'Customer at the counter' },
            { to: '/sell/products?snap=1', icon: <Camera />, l: 'Snap & Sell', d: 'Photo → listing' },
            { to: '/sell/orders', icon: <ClipboardList />, l: 'Orders', d: `${s.open} open` },
            { to: '/sell/payments', icon: <Wallet />, l: 'Payments', d: 'USDT received · CSV' },
            { to: '/sell/whatsapp', icon: <MessageCircle />, l: 'WhatsApp', d: 'Run the stall by chat' },
          ].map((x) => (
            <Link key={x.l} to={x.to} className="panel group flex flex-col gap-3 p-4 transition hover:-translate-y-0.5 hover:border-z/40">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-z-soft text-z transition group-hover:bg-z group-hover:text-z-ink">{x.icon}</span>
              <div><div className="font-bold">{x.l}</div><div className="text-xs text-mute">{x.d}</div></div>
            </Link>
          ))}
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between"><div className="label">Latest orders</div><Link to="/sell/orders" className="text-sm text-z">All orders</Link></div>
            <ul className="panel divide-y divide-line">
              {orders.slice(0, 5).map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                  <div className="min-w-0"><div className="font-semibold">{o.customer} · {o.code}</div><div className="truncate text-mute">{o.lines.map((l) => `${l.qty} ${l.name}`).join(', ')} · {ago(o.at)}</div></div>
                  <div className="flex shrink-0 items-center gap-3"><span className="font-bold nums">{inr(o.inr)}</span><Status s={o.status} /></div>
                </li>
              ))}
              {!orders.length && <li className="p-6 text-center text-sm text-mute">No orders yet. Share your QR from Collect to get the first one.</li>}
            </ul>
          </section>
          <Regulars orders={orders} />
        </div>
      </div>
    </div>
  );
}

type Stats = ReturnType<typeof stats>;

function stats(orders: Order[], products: Product[], range: number, sample: boolean) {
  const now = Date.now();
  const paid = orders.filter((o) => COUNTED.includes(o.status));
  const dayStart = (offset: number) => { const d = new Date(now - offset * DAY); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const sumDay = (offset: number) => paid.filter((o) => { const t = Date.parse(o.at); return t >= dayStart(offset) && t < dayStart(offset) + DAY; }).reduce((a, o) => a + o.inr, 0);
  const days = Array.from({ length: range }, (_, i) => {
    const off = range - 1 - i;
    let inrDay = sumDay(off);
    if (sample && off < 7 && inrDay === 0) inrDay = WEEK_INR[6 - off] ?? 0;
    return { label: new Date(dayStart(off)).toLocaleDateString('en-IN', range === 7 ? { weekday: 'short' } : { day: 'numeric' }), inr: inrDay, today: off === 0 };
  });
  const today = days[days.length - 1].inr;
  const yesterday = days[days.length - 2]?.inr ?? 0;
  const inRange = paid.filter((o) => now - Date.parse(o.at) < range * DAY);
  const people = new Map<string, number>();
  inRange.forEach((o) => people.set(o.customer, (people.get(o.customer) ?? 0) + 1));
  const hours = Array.from({ length: 24 }, () => 0);
  paid.forEach((o) => { hours[new Date(o.at).getHours()] += 1; });
  const maxHour = Math.max(1, ...hours);
  const items = new Map<string, number>();
  inRange.forEach((o) => o.lines.forEach((l) => items.set(l.name, (items.get(l.name) ?? 0) + l.qty * l.priceInr)));
  return {
    days, today, rangeTotal: days.reduce((a, d) => a + d.inr, 0),
    delta: yesterday ? Math.round(((today - yesterday) / yesterday) * 100) : 0,
    ordersToday: paid.filter((o) => Date.parse(o.at) >= dayStart(0)).length,
    open: orders.filter((o) => ['paid', 'accepted', 'ready'].includes(o.status)).length,
    customers: people.size,
    returning: people.size ? ([...people.values()].filter((n) => n > 1).length / people.size) * 100 : 0,
    gasless: paid.filter((o) => o.payment?.gasless).length,
    hours, maxHour, peak: hours.some(Boolean) ? hours.indexOf(Math.max(...hours)) : null,
    top: [...items.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, v]) => ({ name, inr: v })),
    restock: products.filter((p) => p.stock <= 5).sort((a, b) => a.stock - b.stock).slice(0, 6),
    products: products.length,
  };
}

const fmtHour = (h: number) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;

function Kpi({ icon, label, value, fmt = (n) => String(Math.round(n)), hint, hot }: { icon: React.ReactNode; label: string; value: number; fmt?: (n: number) => string; hint: string; hot?: boolean }) {
  const n = useCount(value);
  return (
    <div className={`panel relative overflow-hidden p-4 ${hot ? 'border-z/40' : ''}`}>
      {hot && <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-z/20 blur-2xl" />}
      <div className="label flex items-center gap-1.5">{icon}{label}</div>
      <div className={`mt-2 text-2xl font-extrabold tracking-tight nums md:text-3xl ${hot ? 'text-z' : ''}`}>{fmt(n)}</div>
      <div className="mt-1 text-xs text-mute">{hint}</div>
    </div>
  );
}

function Bars({ days }: { days: Stats['days'] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.inr));
  const many = days.length > 10;
  return (
    <div className="relative mt-6">
      <div className="flex h-56 items-end gap-1.5 lg:h-64" onMouseLeave={() => setHover(null)} role="img" aria-label="Sales per day">
        {days.map((d, i) => (
          <button key={i} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onClick={() => setHover(i)} className="group flex h-full flex-1 flex-col items-center justify-end gap-2 outline-none" aria-label={`${d.label}: ${inr(d.inr)}`}>
            <div className={`w-full rounded-md transition-all duration-500 ${d.today ? 'bg-z shadow-glow' : hover === i ? 'bg-chalk/70' : 'bg-raised group-hover:bg-chalk/40'}`} style={{ height: `${Math.max(3, (d.inr / max) * 100)}%` }} />
            {(!many || i % 5 === 0 || d.today) && <span className={`text-[10px] ${d.today ? 'font-bold text-chalk' : 'text-dim'}`}>{d.today ? 'Today' : d.label}</span>}
          </button>
        ))}
      </div>
      {hover !== null && (
        <div className="pointer-events-none absolute -top-2 rounded-xl border border-line-2 bg-bg px-3 py-1.5 text-xs shadow-lift" style={{ left: `clamp(0px, calc(${((hover + 0.5) / days.length) * 100}% - 50px), calc(100% - 100px))` }}>
          <div className="text-dim">{days[hover].today ? 'Today' : days[hover].label}</div><div className="font-bold nums">{inr(days[hover].inr)}</div>
        </div>
      )}
    </div>
  );
}

type Insight = { title: string; body: string; kind: string };
type Msg = { who: 'me' | 'ai'; text: string };
const ASK = ['What should I restock today?', 'When are my busiest hours?', 'Write a WhatsApp offer for my regulars', 'How can I sell more this week?'];

/** Zeeto AI: insights from the stall's own numbers, plus a chat. Real Gemini when the key is on; simple rules otherwise. */
function Assistant({ sample, local }: { sample: boolean; local: Stats }) {
  const live = feature('ai') && !sample;
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [summary, setSummary] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!live) { setInsights(rules(local)); setSummary(''); return; }
    let on = true;
    api<{ answer: string; insights: Insight[] }>('/api/ai', { body: { action: 'ask', text: '' } })
      .then((r) => { if (on) { setInsights(r.insights.length ? r.insights : rules(local)); setSummary(r.answer); } })
      .catch(() => on && setInsights(rules(local)));
    return () => { on = false; };
  }, [live]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [msgs, busy]);

  const send = async (text: string) => {
    const t = text.trim().slice(0, 400);
    if (!t || busy) return;
    setMsgs((m) => [...m, { who: 'me', text: t }]); setQ('');
    if (!live) { setMsgs((m) => [...m, { who: 'ai', text: sample ? 'This is a sample stall. Open your own stall to chat with Zeeto AI about your real sales.' : 'Zeeto AI needs the Gemini key on the server (GEMINI_API_KEY). Meanwhile, the tips above come from your own numbers.' }]); return; }
    setBusy(true);
    try {
      const r = await api<{ answer: string }>('/api/ai', { body: { action: 'ask', text: t } });
      setMsgs((m) => [...m, { who: 'ai', text: r.answer }]);
    } catch (e) { setMsgs((m) => [...m, { who: 'ai', text: (e as Error).message }]); } finally { setBusy(false); }
  };

  return (
    <section className="panel flex min-h-[420px] flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-line p-4">
        <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-z text-z-ink"><Bot size={16} /></span><div><div className="font-bold leading-tight">Zeeto AI</div><div className="text-[11px] text-mute">{live ? 'Gemini · reads only your stall’s numbers' : 'Tips from your numbers'}</div></div></div>
        <Sparkles size={16} className="text-z" />
      </div>
      <div className="flex max-h-[360px] flex-1 flex-col gap-3 overflow-y-auto p-4">
        {summary && <p className="text-sm">{summary}</p>}
        {!insights ? <div className="flex items-center gap-2 text-sm text-mute"><Loader2 size={15} className="animate-spin" /> Reading your sales…</div> : insights.map((i, k) => (
          <div key={k} className="rounded-2xl border border-line bg-raised/60 p-3 text-sm">
            <div className="font-semibold"><span className="mr-1.5 rounded-full bg-z-soft px-1.5 py-0.5 font-mono text-[9px] uppercase text-z">{i.kind}</span>{i.title}</div>
            <p className="mt-1 text-mute">{i.body}</p>
          </div>
        ))}
        {msgs.map((m, k) => (
          <div key={k} className={`max-w-[88%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm ${m.who === 'me' ? 'self-end bg-z text-z-ink' : 'self-start bg-raised'}`}>{m.text}</div>
        ))}
        {busy && <div className="self-start rounded-2xl bg-raised px-3 py-2 text-sm text-mute"><Loader2 size={14} className="inline animate-spin" /> Thinking…</div>}
        <div ref={end} />
      </div>
      <div className="flex flex-wrap gap-1.5 px-4 pb-2">{ASK.map((a) => <button key={a} onClick={() => send(a)} className="rounded-full border border-line px-2.5 py-1 text-[11px] text-mute hover:border-z hover:text-chalk">{a}</button>)}</div>
      <form onSubmit={(e) => { e.preventDefault(); void send(q); }} className="flex gap-2 border-t border-line p-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about your sales, stock, customers…" aria-label="Ask Zeeto AI" maxLength={400} className="h-11 flex-1 rounded-full border border-line bg-raised px-4 text-sm outline-none focus:border-z" />
        <button disabled={!q.trim() || busy} aria-label="Send" className="grid h-11 w-11 place-items-center rounded-full bg-z text-z-ink disabled:opacity-40"><Send size={16} /></button>
      </form>
    </section>
  );
}

/** Plain rules over the stall's own numbers, used when Gemini is off. */
function rules(s: Stats): Insight[] {
  const out: Insight[] = [];
  if (!s.products) out.push({ kind: 'stock', title: 'Add your products', body: 'Snap a photo or type “tacos 350 rupees, 20 plates”. Stalls with photos get more orders.' });
  if (s.restock.length) out.push({ kind: 'stock', title: `Restock ${s.restock[0].name}`, body: `${s.restock.length} item${s.restock.length > 1 ? 's are' : ' is'} low or sold out. Sold-out items can’t be ordered.` });
  if (s.peak !== null) out.push({ kind: 'sales', title: `Busy around ${fmtHour(s.peak)}`, body: 'Have stock packed 30 minutes before your rush so pickups stay quick.' });
  if (s.top[0]) out.push({ kind: 'sales', title: `${s.top[0].name} leads`, body: `It made ${inr(s.top[0].inr)} recently. Keep it visible at the top of your stall.` });
  if (s.customers) out.push({ kind: 'customers', title: `${Math.round(s.returning)}% come back`, body: 'Send regulars a small offer on WhatsApp to bring them back this week.' });
  if (out.length < 3) out.push({ kind: 'offer', title: 'Share your QR', body: 'Print the QR from Collect and keep it on the counter. Every scan is a gas-free USDT payment.' });
  return out.slice(0, 4);
}

/** Who keeps coming back: visits and spend per customer at this stall, so the stall can recognise and reward them. */
function Regulars({ orders }: { orders: Order[] }) {
  const by = new Map<string, { name: string; visits: number; spent: number; last: string }>();
  for (const o of orders) {
    if (!COUNTED.includes(o.status)) continue;
    const r = by.get(o.customer) ?? { name: o.customer, visits: 0, spent: 0, last: o.at };
    r.visits += 1; r.spent += o.inr; if (o.at > r.last) r.last = o.at;
    by.set(o.customer, r);
  }
  const list = [...by.values()].sort((a, b) => b.visits - a.visits || b.spent - a.spent).slice(0, 6);
  return (
    <section className="flex flex-col gap-3">
      <div className="label">Your regulars</div>
      <ul className="panel divide-y divide-line">
        {list.map((r) => (
          <li key={r.name} className="flex items-center justify-between gap-3 p-4 text-sm">
            <div className="min-w-0"><div className="truncate font-semibold">{r.name}</div><div className="text-mute">{tierFor(r.visits).name} · last {ago(r.last)}</div></div>
            <div className="text-right"><div className="font-bold nums">{r.visits} {r.visits === 1 ? 'visit' : 'visits'}</div><div className="text-xs text-dim nums">{inr(r.spent)} spent</div></div>
          </li>
        ))}
        {!list.length && <li className="p-6 text-center text-sm text-mute">Customers who pay you show up here, with how often they come back.</li>}
      </ul>
    </section>
  );
}

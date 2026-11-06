import { Activity, BadgeCheck, Ban, CheckCircle2, CircleDashed, ExternalLink, LayoutDashboard, Receipt, Shield, Store, Users, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ADDRESSES, CATEGORIES, CHAINS, ago, inr, short } from '@zeeto/core';
import { AccountButton } from '../../components/Account';
import { Face, Mark, Metric, Status } from '../../components/kit';
import { useRole, useSession, type Role } from '../../lib/auth';
import { chainStatus } from '../../lib/chain';
import { findVendor, useApp, useVendors } from '../../store';
import { useServer } from '../../lib/api';
import AdminLive from './AdminLive';

type Tab = 'overview' | 'users' | 'stalls' | 'orders' | 'system';
const TABS: [Tab, string, ReactNode][] = [
  ['overview', 'Overview', <LayoutDashboard key="o" size={16} />],
  ['users', 'Users & roles', <Users key="u" size={16} />],
  ['stalls', 'Stalls', <Store key="s" size={16} />],
  ['orders', 'Orders & payments', <Receipt key="r" size={16} />],
  ['system', 'System', <Activity key="y" size={16} />],
];

/** Zeeto admin. The page is hidden from non-admins; every action is enforced again by the API once it's live. */
export default function Admin() {
  const s = useSession();
  const role = useRole();
  const [tab, setTab] = useState<Tab>('overview');
  const live = useServer((x) => x.status === 'on');

  if (!s.ready) return <div className="p-10 text-center text-mute">Loading…</div>;
  if (role !== 'admin') {
    return (
      <div className="grid min-h-[100dvh] place-items-center gutter">
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <Shield size={36} className="text-z" />
          <h1 className="text-2xl font-extrabold">Admins only</h1>
          <p className="text-mute">{s.authed ? 'This account isn’t on the admin list. Add your phone or email to ADMIN_USERS (server) and VITE_ADMIN_USERS.' : 'Sign in with an admin phone number or email.'}</p>
          {!s.authed && <AccountButton />}
          <Link to="/explore" className="text-sm text-z">Back to Zeeto</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur-xl pt-safe">
        <div className="gutter mx-auto flex h-16 max-w-6xl items-center gap-3">
          <Link to="/" aria-label="Zeeto"><Mark size={32} /></Link>
          <div className="min-w-0 flex-1"><div className="font-extrabold">Admin</div><div className="truncate text-xs text-mute">{s.mode === 'demo' ? 'Demo session' : s.label}</div></div>
          <AccountButton />
        </div>
        <nav className="gutter no-bar mx-auto flex max-w-6xl gap-1 overflow-x-auto pb-2" aria-label="Admin sections">
          {TABS.map(([t, l, i]) => <button key={t} onClick={() => setTab(t)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold ${tab === t ? 'bg-chalk text-bg' : 'text-mute hover:text-chalk'}`}>{i}{l}</button>)}
        </nav>
      </header>
      <main className="gutter mx-auto max-w-6xl py-6">
        {live ? <AdminLive tab={tab} /> : <>
        {tab === 'overview' && <Overview />}
        {tab === 'users' && <UsersTab />}
        {tab === 'stalls' && <Stalls />}
        {tab === 'orders' && <Orders />}
        {tab === 'system' && <System />}
        </>}
      </main>
    </div>
  );
}

function useAllOrders() {
  const mine = useApp((s) => s.myOrders);
  const stall = useApp((s) => s.stallOrders);
  return useMemo(() => {
    const m = new Map<string, (typeof mine)[number]>();
    [...stall, ...mine].forEach((o) => m.set(o.id, o));
    return [...m.values()].sort((a, b) => b.at.localeCompare(a.at));
  }, [mine, stall]);
}

function Overview() {
  const all = useVendors();
  const orders = useAllOrders();
  const flags = useApp((s) => s.stallFlags);
  const paid = orders.filter((o) => o.payment);
  const usdt = paid.reduce((a, o) => a + (o.payment?.settled ?? 0) - o.refunds.reduce((x, r) => x + r.amount, 0), 0);
  const open = orders.filter((o) => ['paid', 'accepted', 'ready'].includes(o.status)).length;
  const suspended = Object.values(flags).filter((f) => f.suspended).length;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Stalls live" value={all.length - suspended} hint={`${suspended} suspended`} hot />
        <Metric label="Orders" value={orders.length} hint={`${open} open now`} />
        <Metric label="Volume" value={usdt.toFixed(2)} hint="USDT + USDC, net of refunds" />
        <Metric label="Categories" value={new Set(all.map((v) => v.category)).size} hint="kinds of stall" />
      </div>
      <section className="panel p-5">
        <div className="label mb-3">Latest activity</div>
        <ul className="divide-y divide-line">
          {orders.slice(0, 8).map((o) => {
            const v = findVendor(o.vendorId)!;
            return <li key={o.id} className="flex items-center justify-between gap-3 py-2.5 text-sm"><span className="min-w-0 truncate"><b>{o.customer}</b> → {v.name} <span className="text-dim">· {ago(o.at)}</span></span><span className="flex shrink-0 items-center gap-2"><span className="nums">{inr(o.inr)}</span><Status s={o.status} /></span></li>;
          })}
        </ul>
      </section>
    </div>
  );
}

interface Person { id: string; name: string; handle: string; role: Role; detail: string; you?: boolean }

function UsersTab() {
  const all = useVendors();
  const s = useSession();
  const myRole = useRole();
  const roles = useApp((x) => x.roles);
  const setRole = useApp((x) => x.setRole);
  const say = useApp((x) => x.say);
  const orders = useAllOrders();
  const [q, setQ] = useState('');

  const people: Person[] = useMemo(() => {
    const list: Person[] = [];
    if (s.authed && s.userId) list.push({ id: s.userId, name: 'You', handle: s.label ?? s.userId, role: myRole, detail: s.address ? short(s.address) : 'no wallet yet', you: true });
    all.forEach((v) => list.push({ id: `vendor:${v.id}`, name: v.owner, handle: v.name, role: roles[`vendor:${v.id}`] ?? 'merchant', detail: CATEGORIES[v.category].label }));
    [...new Set(orders.map((o) => o.customer))].filter((n) => n !== 'Priya' || !s.authed).forEach((n) => list.push({ id: `cust:${n}`, name: n, handle: 'customer', role: roles[`cust:${n}`] ?? 'customer', detail: `${orders.filter((o) => o.customer === n).length} orders` }));
    return list;
  }, [s, myRole, roles, orders, all]);
  const shown = people.filter((p) => !q || `${p.name} ${p.handle}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people or stalls" className="input max-w-sm" />
        <div className="flex gap-2 text-xs">{(['customer', 'merchant', 'admin'] as Role[]).map((r) => <span key={r} className="pill">{r} · {people.filter((p) => p.role === r).length}</span>)}</div>
      </div>
      <p className="text-sm text-mute">Admins come only from the server’s admin list, so nobody can make themselves admin from a browser. Changing roles here is demo-only until the API is live.</p>
      <ul className="panel divide-y divide-line">
        {shown.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 p-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-raised font-bold text-z">{p.name[0]}</span>
            <div className="min-w-0 flex-1"><div className="font-semibold">{p.name}{p.you && <span className="ml-2 rounded-full bg-z-soft px-2 py-0.5 text-[10px] text-z">you</span>}</div><div className="truncate text-xs text-mute">{p.handle} · {p.detail}</div></div>
            <select aria-label={`Role for ${p.name}`} value={p.role} disabled={p.you} onChange={(e) => { setRole(p.id, e.target.value as Role); say(`${p.name} is now ${e.target.value}`); }} className="h-10 rounded-xl border border-line bg-raised px-3 text-sm outline-none disabled:opacity-50">
              <option value="customer">customer</option>
              <option value="merchant">merchant</option>
              <option value="admin" disabled>admin (server list)</option>
            </select>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stalls() {
  const all = useVendors();
  const flags = useApp((s) => s.stallFlags);
  const setFlag = useApp((s) => s.setStallFlag);
  const say = useApp((s) => s.say);
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {all.map((v) => {
        const f = flags[v.id] ?? {};
        const verified = f.verified ?? v.verified;
        return (
          <li key={v.id} className={`panel flex items-center gap-3 p-3 ${f.suspended ? 'opacity-60' : ''}`}>
            <Face media={v.avatar} size={48} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 font-semibold"><span className="truncate">{v.name}</span>{verified && <BadgeCheck size={15} className="shrink-0 text-z" />}</div>
              <div className="truncate text-xs text-mute">{CATEGORIES[v.category].label} · {v.owner} · {short(v.wallet)}</div>
              {f.suspended && <div className="text-xs text-bad">Suspended: hidden from the map, can’t take payments</div>}
            </div>
            <button onClick={() => { setFlag(v.id, { verified: !verified }); say(verified ? `${v.name} unverified` : `${v.name} verified`); }} className="btn-line px-3 py-2 text-xs">{verified ? 'Unverify' : 'Verify'}</button>
            <button onClick={() => { setFlag(v.id, { suspended: !f.suspended }); say(f.suspended ? `${v.name} restored` : `${v.name} suspended`); }} className={`btn px-3 py-2 text-xs ${f.suspended ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad'}`}><Ban size={13} />{f.suspended ? 'Restore' : 'Suspend'}</button>
          </li>
        );
      })}
    </ul>
  );
}

function Orders() {
  const orders = useAllOrders();
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead><tr className="border-b border-line text-left text-xs text-mute"><th className="p-3">Order</th><th>Customer → stall</th><th>Amount</th><th>Paid</th><th>Status</th><th>Tx</th></tr></thead>
        <tbody>
          {orders.map((o) => {
            const v = findVendor(o.vendorId)!;
            return (
              <tr key={o.id} className="border-b border-line last:border-0">
                <td className="p-3 font-mono">{o.id.toUpperCase()}</td>
                <td>{o.customer} → {v.name}</td>
                <td className="nums">{inr(o.inr)}</td>
                <td className="font-mono nums">{o.payment ? `${o.payment.settled.toFixed(2)} ${o.payment.settledToken}` : '—'}</td>
                <td><Status s={o.status} /></td>
                <td className="font-mono text-xs text-dim">{o.payment ? `${short(o.payment.tx)}${o.payment.simulated ? ' · sim' : ''}` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function System() {
  const s = useSession();
  const [chain, setChain] = useState<{ id: number; block: number } | null | 'err'>(null);
  useEffect(() => { chainStatus().then(setChain, () => setChain('err')); }, []);
  const env = import.meta.env;
  const rows: [string, 'ok' | 'off' | 'wait' | 'err', string][] = [
    ['Whitechain RPC', chain === null ? 'wait' : chain === 'err' ? 'err' : chain.id === CHAINS.whitechain.id ? 'ok' : 'err', chain && chain !== 'err' ? `chain ${chain.id} · block ${chain.block.toLocaleString('en-IN')} · ${CHAINS.whitechain.rpc}` : chain === 'err' ? 'unreachable' : 'checking…'],
    ['Test USDT', 'ok', `${short(ADDRESSES.usdtWhitechain)} · 6 decimals (checked on chain)`],
    ['ZeetoCheckout', 'off', 'server not connected: payments are simulated (see apps/web/.env.example)'],
    ['Privy login', s.mode === 'privy' ? 'ok' : 'off', s.mode === 'privy' ? 'app id set · SMS + email · embedded wallet on 1874' : 'VITE_PRIVY_APP_ID missing: demo sign-in'],
    ['Mapbox', env.VITE_MAPBOX_TOKEN ? 'ok' : 'off', env.VITE_MAPBOX_TOKEN ? 'token set' : 'VITE_MAPBOX_TOKEN missing: offline map'],
    ['Zeeto server', 'off', '/api not reachable: run `npx vercel dev` or deploy to Vercel'],
    ['Gemini · Uniswap · WhatsApp', 'off', 'server-side keys; shown here once the server is up'],
  ];
  const icon = { ok: <CheckCircle2 size={18} className="text-good" />, off: <CircleDashed size={18} className="text-dim" />, wait: <CircleDashed size={18} className="animate-spin text-z" />, err: <XCircle size={18} className="text-bad" /> };
  return (
    <ul className="panel divide-y divide-line">
      {rows.map(([n, st, d]) => <li key={n} className="flex items-center gap-3 p-4"><span>{icon[st]}</span><div className="min-w-0 flex-1"><div className="font-semibold">{n}</div><div className="truncate font-mono text-xs text-mute">{d}</div></div></li>)}
      <li className="p-4 text-sm"><a href={CHAINS.whitechain.explorer} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-z">Whitechain explorer <ExternalLink size={13} /></a></li>
    </ul>
  );
}

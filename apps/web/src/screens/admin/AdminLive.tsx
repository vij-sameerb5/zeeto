import { AlertTriangle, BadgeCheck, Ban, CheckCircle2, CircleDashed, ExternalLink, Fuel, RefreshCw, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { CHAINS, ago, inr, short, type Order } from '@zeeto/core';
import { Metric, Status } from '../../components/kit';
import { api } from '../../lib/api';
import { useApp } from '../../store';

interface Data {
  features: Record<string, boolean>;
  checkout: string | null;
  relayer: { address: string; wbt: number | null; low: boolean } | null;
  limits: { minInr: number; userPerDay: number; stallPerDay: number; dailyGasWbt: number; maxGwei: number };
  overview: { gmvInr: number; orders: number; refundsUsdt: number; gasToday: { txs: number; wbt: number } };
  users: { privy_id: string; label: string; role: string; address: string; created_at: string }[];
  stalls: { id: string; name: string; wallet: string; status: string; verified: boolean; created_at: string; api_key_prefix: string | null; webhook_url: string | null }[];
  orders: Order[];
  relays: { kind: string; gas_wei: string; at: string; vendor_id: string; tx_hash: string }[];
  webhooks: { vendor_id: string; event: string; status: number; at: string }[];
}

const tx = (h: string) => `${CHAINS.whitechain.explorer}/tx/${h}`;
const addr = (a: string) => `${CHAINS.whitechain.explorer}/address/${a}`;

/** Admin on live server data: every number here comes from the database and the chain, every action is re-checked by the API. */
export default function AdminLive({ tab }: { tab: string }) {
  const say = useApp((s) => s.say);
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => api<Data>('/api/admin').then((r) => { setD(r); setErr(''); }, (e) => setErr((e as Error).message)), []);
  useEffect(() => { void load(); const t = setInterval(load, 15_000); return () => clearInterval(t); }, [load]);
  const act = async (action: string, id: string, role?: string) => {
    try { await api('/api/admin', { body: { action, id, role } }); say('Saved'); void load(); } catch (e) { say((e as Error).message); }
  };

  if (err) return <p className="rounded-2xl bg-bad-soft p-4 text-sm text-bad">{err}</p>;
  if (!d) return <div className="h-40 animate-pulse rounded-3xl bg-white/5" />;

  if (tab === 'overview') return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Paid volume" value={inr(d.overview.gmvInr)} hint={`${d.overview.orders} orders`} hot />
        <Metric label="Refunded" value={d.overview.refundsUsdt.toFixed(2)} hint="USDT" />
        <Metric label="Stalls" value={String(d.stalls.length)} hint={`${d.stalls.filter((s) => s.status === 'live').length} open`} />
        <Metric label="Users" value={String(d.users.length)} hint="signed in" />
      </div>
      <Relayer d={d} />
      <button onClick={load} className="btn-line self-start px-4 py-2 text-sm"><RefreshCw size={15} /> Refresh</button>
    </div>
  );

  if (tab === 'users') return (
    <div className="panel overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="text-left text-xs text-mute"><tr><th className="p-3">User</th><th>Wallet</th><th>Joined</th><th className="p-3">Role</th></tr></thead>
        <tbody className="divide-y divide-line">
          {d.users.map((u) => (
            <tr key={u.privy_id}>
              <td className="p-3">{u.label}<div className="font-mono text-[10px] text-dim">{u.privy_id.slice(-10)}</div></td>
              <td><a href={addr(u.address)} target="_blank" rel="noreferrer" className="font-mono text-xs text-z">{short(u.address)}</a></td>
              <td className="text-mute">{ago(u.created_at)}</td>
              <td className="p-3"><select value={u.role} onChange={(e) => act('role', u.privy_id, e.target.value)} className="input py-1 text-sm">{['customer', 'merchant', 'admin'].map((r) => <option key={r}>{r}</option>)}</select></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (tab === 'stalls') return (
    <ul className="flex flex-col gap-3">
      {d.stalls.map((v) => (
        <li key={v.id} className="panel flex flex-wrap items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 font-bold">{v.name}{v.verified && <BadgeCheck size={16} className="text-z" />}</div>
            <div className="text-xs text-mute">{v.id} · <a href={addr(v.wallet)} target="_blank" rel="noreferrer" className="font-mono text-z">{short(v.wallet)}</a> · {ago(v.created_at)}</div>
            <div className="text-xs text-dim">{v.api_key_prefix ? `API key ${v.api_key_prefix}…` : 'no API key'} · {v.webhook_url ? 'webhook on' : 'no webhook'}</div>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${v.status === 'live' ? 'bg-good-soft text-good' : v.status === 'suspended' ? 'bg-bad-soft text-bad' : 'bg-white/5 text-mute'}`}>{v.status}</span>
          <button onClick={() => act(v.verified ? 'unverify' : 'verify', v.id)} className="btn-line px-3 py-1.5 text-sm"><BadgeCheck size={15} /> {v.verified ? 'Unverify' : 'Verify'}</button>
          {v.status === 'suspended'
            ? <button onClick={() => act('reopen', v.id)} className="btn-line px-3 py-1.5 text-sm"><RotateCcw size={15} /> Reopen</button>
            : <button onClick={() => act('suspend', v.id)} className="btn-line px-3 py-1.5 text-sm text-bad"><Ban size={15} /> Suspend</button>}
        </li>
      ))}
      {!d.stalls.length && <p className="text-mute">No stalls yet.</p>}
    </ul>
  );

  if (tab === 'orders') return (
    <div className="panel overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="text-left text-xs text-mute"><tr><th className="p-3">Order</th><th>Stall</th><th>Customer</th><th>Amount</th><th>Status</th><th>Gas</th><th className="p-3">Receipt</th></tr></thead>
        <tbody className="divide-y divide-line">
          {d.orders.map((o) => {
            const p = o.payment as (Order['payment'] & { gasless?: boolean }) | undefined;
            return (
              <tr key={o.id}>
                <td className="p-3 font-mono text-xs">{o.id}<div className="text-dim">{ago(o.at)}</div></td>
                <td>{o.vendorId}</td>
                <td>{o.customer}</td>
                <td className="nums">{inr(o.inr)}<div className="text-xs text-dim">{o.usd.toFixed(2)} USDT</div></td>
                <td><Status s={o.status} /></td>
                <td className="text-xs">{p ? (p.gasless ? 'Zeeto paid' : 'customer') : '—'}</td>
                <td className="p-3">{p?.tx ? <a href={tx(p.tx)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-z">{short(p.tx)} <ExternalLink size={11} /></a> : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  // system
  const rows: [string, boolean, string][] = [
    ['Database (Supabase)', !!d.features.db, 'stalls, orders, bills, logs'],
    ['Sign-in (Privy)', !!d.features.auth, 'phone/email, embedded wallet on chain 1874'],
    ['ZeetoCheckout contract', !!d.features.checkout, d.checkout ?? 'CHECKOUT_ADDRESS not set'],
    ['Gas-free relayer', !!d.features.relay, d.relayer?.address ?? 'RELAYER_PRIVATE_KEY not set'],
    ['Gemini (Snap & Sell)', !!d.features.ai, 'GEMINI_API_KEY'],
    ['Uniswap Trading API', !!d.features.uniswap, 'UNISWAP_API_KEY'],
    ['WhatsApp Cloud API', !!d.features.whatsapp, 'WHATSAPP_* keys'],
  ];
  return (
    <div className="flex flex-col gap-4">
      <ul className="panel divide-y divide-line">
        {rows.map(([n, ok, x]) => <li key={n} className="flex items-center gap-3 p-4">{ok ? <CheckCircle2 size={18} className="text-good" /> : <CircleDashed size={18} className="text-dim" />}<div className="min-w-0"><div className="font-semibold">{n}</div><div className="truncate font-mono text-xs text-mute">{x}</div></div></li>)}
      </ul>
      {d.checkout && <a href={addr(d.checkout)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-z">Contract on the explorer <ExternalLink size={13} /></a>}
      <div className="panel p-4">
        <div className="label mb-2">Webhook deliveries</div>
        {d.webhooks.length ? d.webhooks.map((w, i) => <div key={i} className="flex justify-between py-1 text-xs"><span>{w.vendor_id} · {w.event}</span><span className={w.status >= 200 && w.status < 300 ? 'text-good' : 'text-bad'}>{w.status || 'failed'} · {ago(w.at)}</span></div>) : <p className="text-sm text-mute">None yet.</p>}
      </div>
    </div>
  );
}

/** Who pays gas, how much is left, and the limits that stop anyone draining it. */
function Relayer({ d }: { d: Data }) {
  const r = d.relayer;
  const used = d.overview.gasToday.wbt;
  const pct = Math.min(100, (used / d.limits.dailyGasWbt) * 100);
  return (
    <section className="panel flex flex-col gap-4 p-5">
      <div className="flex items-center gap-2 font-bold"><Fuel size={18} className="text-z" /> Gas-free relayer</div>
      {!r ? <p className="text-sm text-mute">Not configured. Payments fall back to customers submitting themselves.</p> : (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <a href={addr(r.address)} target="_blank" rel="noreferrer" className="font-mono text-sm text-z">{short(r.address)}</a>
            <span className={`font-mono text-lg nums ${r.low ? 'text-bad' : ''}`}>{r.wbt?.toFixed(4) ?? '—'} WBT</span>
          </div>
          {r.low && <p className="flex items-center gap-2 rounded-xl bg-bad-soft p-3 text-sm text-bad"><AlertTriangle size={16} /> Low on WBT. Top it up from the Whitechain faucet.</p>}
          <div>
            <div className="flex justify-between text-xs text-mute"><span>Gas spent today · {d.overview.gasToday.txs} txs</span><span className="nums">{used.toFixed(6)} / {d.limits.dailyGasWbt} WBT</span></div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-raised"><div className="h-full rounded-full bg-z" style={{ width: `${pct}%` }} /></div>
          </div>
        </>
      )}
      <ul className="grid gap-1 text-xs text-mute sm:grid-cols-2">
        <li>• Only orders this server created, signed by their own customer</li>
        <li>• Simulated before sending: failures cost nothing</li>
        <li>• Minimum order ₹{d.limits.minInr}</li>
        <li>• {d.limits.userPerDay} gas-free payments per customer per day</li>
        <li>• {d.limits.stallPerDay} per stall per day</li>
        <li>• Gas price ceiling {d.limits.maxGwei} gwei; holds WBT only, never USDT</li>
      </ul>
      {!!d.relays.length && (
        <div className="max-h-48 overflow-y-auto text-xs">
          {d.relays.map((x, i) => <div key={i} className="flex justify-between border-t border-line py-1.5"><span>{x.kind} · {x.vendor_id}</span><a href={tx(x.tx_hash)} target="_blank" rel="noreferrer" className="font-mono text-z">{(Number(x.gas_wei) / 1e18).toFixed(7)} WBT</a></div>)}
        </div>
      )}
    </section>
  );
}

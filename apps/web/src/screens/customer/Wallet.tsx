import { Copy, Droplets, KeyRound, LogIn, LogOut, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CHAINS, RAILS, VENDORS, ago, mockPayments, short, type Balance } from '@zeeto/core';
import { readBalances } from '../../lib/chain';
import { useSession } from '../../lib/auth';
import { Header, Sim } from '../../components/kit';
import { useApp } from '../../store';

export default function Wallet() {
  const orders = useApp((s) => s.myOrders.filter((o) => o.payment));
  const say = useApp((s) => s.say);
  const s = useSession();
  const [bal, setBal] = useState<Balance[] | null>(null);
  const [err, setErr] = useState('');
  const live = s.mode === 'privy' && !!s.address;
  useEffect(() => {
    let on = true;
    setBal(null); setErr('');
    if (live) {
      // Real balances from the Whitechain Testnet RPC
      readBalances(s.address!).then((b) => on && setBal([
        { token: 'USDT', amount: b.usdt, network: CHAINS.whitechain.name },
        { token: 'WBT', amount: b.wbt, network: `${CHAINS.whitechain.name} · gas` },
      ]), () => on && setErr('Couldn’t reach Whitechain. Check your connection and refresh.'));
    } else if (s.mode === 'demo') mockPayments.balances().then((b) => on && setBal(b));
    else setBal([]); // signed out with Privy: nothing to show until sign-in
    return () => { on = false; };
  }, [live, s.address, s.mode]);

  return (
    <div>
      <Header title="Wallet" sub="Testnet only · no real money" right={live ? <span className="rounded-full bg-good-soft px-2.5 py-1 font-mono text-[10px] uppercase text-good">Live · chain {CHAINS.whitechain.id}</span> : <Sim />} />
      <div className="gutter mx-auto grid max-w-5xl gap-6 py-6 md:grid-cols-[380px_1fr]">
        <section className="flex flex-col gap-4">
          <div className="relative overflow-hidden rounded-[28px] border border-line bg-gradient-to-br from-raised to-panel p-6">
            <div className="noise pointer-events-none absolute inset-0" />
            <div className="flex items-center justify-between"><div className="label">{s.label ?? 'Your wallet'}</div>{s.authed && <button onClick={s.logout} className="inline-flex items-center gap-1 text-xs text-mute hover:text-chalk"><LogOut size={13} /> Sign out</button>}</div>
            {s.authed && s.address ? (
              <button onClick={() => navigator.clipboard?.writeText(s.address!).then(() => say('Address copied'), () => undefined)} className="mt-3 inline-flex items-center gap-2 font-mono text-lg hover:text-z">{short(s.address)} <Copy size={15} /></button>
            ) : s.authed ? (
              <div className="mt-3 text-sm text-mute">Creating your wallet…</div>
            ) : (
              <button onClick={s.login} className="btn-z mt-4 w-full"><LogIn size={16} /> Sign in with phone or email</button>
            )}
            {err && <p className="mt-3 text-sm text-bad">{err}</p>}
            <div className="mt-6 flex flex-col gap-3">
              {!bal && <div className="h-24 animate-pulse rounded-2xl bg-white/5" />}
              {bal?.map((b) => (
                <div key={b.token + b.network} className="flex items-baseline justify-between">
                  <div><div className="font-bold">{b.token}</div><div className="text-xs text-dim">{b.network}</div></div>
                  <div className="font-mono text-lg nums">{b.amount.toFixed(b.token === 'ETH' || b.token === 'WBT' ? 4 : 2)}</div>
                </div>
              ))}
            </div>
          </div>
          <a href={CHAINS.whitechain.faucet} target="_blank" rel="noreferrer" className="btn-line"><Droplets size={16} /> Get test WBT (gas) from the faucet</a>
          <ul className="panel flex flex-col gap-3 p-5 text-sm text-mute">
            <li className="flex gap-2"><KeyRound size={16} className="mt-0.5 shrink-0 text-z" /> Made for you at sign-in (Privy embedded wallet). No seed phrase to lose, no MetaMask.</li>
            <li className="flex gap-2"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-z" /> Zeeto never holds your keys or your money. Payments go straight from you to the stall.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <div className="label">Payments</div>
          {orders.map((o) => {
            const v = VENDORS.find((x) => x.id === o.vendorId)!;
            const p = o.payment!;
            return (
              <Link key={o.id} to={`/orders/${o.id}`} className="panel flex items-center justify-between gap-3 p-4 hover:border-line-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{v.name}</div>
                  <div className="text-xs text-mute">{RAILS[p.rail].network} · {ago(p.at)}</div>
                  <div className="mt-1 font-mono text-[11px] text-dim">tx {short(p.tx)}{p.simulated ? ' · simulated' : ''}</div>
                </div>
                <div className="text-right font-mono nums">−{p.paidAmount.toFixed(p.paidToken === 'ETH' ? 5 : 2)} {p.paidToken}</div>
              </Link>
            );
          })}
        </section>
      </div>
    </div>
  );
}

import { Copy, Droplets, KeyRound, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CHAINS, ME, RAILS, VENDORS, ago, mockPayments, short, type Balance } from '@zeeto/core';
import { Header, Sim } from '../../components/kit';
import { useApp } from '../../store';

export default function Wallet() {
  const orders = useApp((s) => s.myOrders.filter((o) => o.payment));
  const say = useApp((s) => s.say);
  const [bal, setBal] = useState<Balance[] | null>(null);
  useEffect(() => { let on = true; mockPayments.balances().then((b) => on && setBal(b)); return () => { on = false; }; }, []);

  return (
    <div>
      <Header title="Wallet" sub="Testnet only · no real money" right={<Sim />} />
      <div className="gutter mx-auto grid max-w-5xl gap-6 py-6 md:grid-cols-[380px_1fr]">
        <section className="flex flex-col gap-4">
          <div className="relative overflow-hidden rounded-[28px] border border-line bg-gradient-to-br from-raised to-panel p-6">
            <div className="noise pointer-events-none absolute inset-0" />
            <div className="label">{ME.name}’s wallet</div>
            <button onClick={() => navigator.clipboard?.writeText(ME.wallet).then(() => say('Address copied'), () => undefined)} className="mt-3 inline-flex items-center gap-2 font-mono text-lg hover:text-z">{short(ME.wallet)} <Copy size={15} /></button>
            <div className="mt-6 flex flex-col gap-3">
              {!bal && <div className="h-24 animate-pulse rounded-2xl bg-white/5" />}
              {bal?.map((b) => (
                <div key={b.token + b.network} className="flex items-baseline justify-between">
                  <div><div className="font-bold">{b.token}</div><div className="text-xs text-dim">{b.network}</div></div>
                  <div className="font-mono text-lg nums">{b.amount.toFixed(b.token === 'ETH' ? 4 : 2)}</div>
                </div>
              ))}
            </div>
          </div>
          <a href={CHAINS.whitechain.faucet} target="_blank" rel="noreferrer" className="btn-line"><Droplets size={16} /> Get test USDT on Whitechain</a>
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

import { Gift, Sparkles } from 'lucide-react';
import { REWARDS, TIERS, VENDORS, ago } from '@zeeto/core';
import { Face, Header, Sim } from '../../components/kit';
import { useApp, useBalance } from '../../store';

export default function Rewards() {
  const bal = useBalance();
  const history = useApp((s) => s.points);
  const redeem = useApp((s) => s.redeem);
  const say = useApp((s) => s.say);
  const tier = [...TIERS].reverse().find((t) => bal >= t.at)!;
  const next = TIERS.find((t) => t.at > bal);
  const pct = next ? Math.round(((bal - tier.at) / (next.at - tier.at)) * 100) : 100;

  return (
    <div>
      <Header title="Rewards" sub="₹10 spent = 1 point · use them at the stalls you love" right={<Sim label="Offchain points" />} />
      <div className="gutter mx-auto grid max-w-5xl gap-6 py-6 md:grid-cols-[380px_1fr]">
        <section className="relative overflow-hidden rounded-[28px] border border-z/40 bg-gradient-to-br from-z/25 via-panel to-panel p-6">
          <div className="noise pointer-events-none absolute inset-0" />
          <div className="label text-z">Zeeto points</div>
          <div className="mega mt-3 text-[88px] text-z nums" style={{ textShadow: '0 0 40px rgba(255,122,26,.55)' }}>{bal}</div>
          <div className="mt-2 flex items-center gap-2 font-bold"><Sparkles size={16} className="text-z" /> {tier.name}</div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-z transition-all" style={{ width: `${pct}%` }} /></div>
          <div className="mt-2 text-sm text-mute">{next ? `${next.at - bal} points to ${next.name}` : 'Top tier. The lane knows you.'}</div>
          <div className="mt-6 grid grid-cols-4 gap-1 text-center text-[10px] text-mute">
            {TIERS.map((t) => <div key={t.name} className={bal >= t.at ? 'text-chalk' : ''}><div className={`mx-auto mb-1 h-2 w-2 rounded-full ${bal >= t.at ? 'bg-z' : 'bg-raised'}`} />{t.name}</div>)}
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="label">Spend points</div>
            {REWARDS.map((r) => {
              const v = VENDORS.find((x) => x.id === r.vendorId)!;
              const can = bal >= r.cost;
              return (
                <div key={r.id} className="panel flex items-center gap-3 p-3 pr-4">
                  <Face media={v.avatar} size={48} />
                  <div className="min-w-0 flex-1"><div className="font-semibold">{r.label}</div><div className="text-sm text-mute">{v.name}</div></div>
                  <button disabled={!can} onClick={() => say(redeem(r.label, r.cost, r.vendorId) ? `Redeemed. Show this screen at ${v.name}.` : 'Not enough points yet')} className={can ? 'btn-z px-4 py-2 text-sm' : 'btn-line px-4 py-2 text-sm'}>
                    <Gift size={15} /> {r.cost}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="flex flex-col gap-2">
            <div className="label">History</div>
            <ul className="panel divide-y divide-line">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                  <div><div>{h.label}</div><div className="text-xs text-dim">{ago(h.at)}</div></div>
                  <b className={`nums ${h.points >= 0 ? 'text-good' : 'text-mute'}`}>{h.points >= 0 ? '+' : ''}{h.points}</b>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

import { Gift, Sparkles, Store } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { REWARDS, ago } from '@zeeto/core';
import { Face, Header } from '../../components/kit';
import { WalletPassButton } from '../../components/Pass';
import { findVendor, useApp, useLoyalty } from '../../store';

/**
 * Loyalty, one card per stall (like a paper stamp card at each shop).
 * Points earned at a stall are spent only at that stall, on its own rewards. Visits decide the tier.
 */
export default function Rewards() {
  const { cards, entries } = useLoyalty();
  const redeem = useApp((s) => s.redeem);
  const say = useApp((s) => s.say);
  const [open, setOpen] = useState<string | null>(cards[0]?.vendorId ?? null);

  return (
    <div>
      <Header title="Loyalty cards" sub="Each stall has its own card · ₹10 = 1 point at that stall" />
      <div className="gutter mx-auto flex max-w-3xl flex-col gap-4 py-6">
        {!cards.length && (
          <div className="panel flex flex-col items-center gap-3 p-10 text-center">
            <Store className="text-z" />
            <div className="font-bold">No cards yet</div>
            <p className="text-sm text-mute">Pay at any stall and you get its loyalty card. Points there, rewards there.</p>
            <Link to="/explore" className="btn-z">Find a stall</Link>
          </div>
        )}
        {cards.map((c) => {
          const v = findVendor(c.vendorId);
          if (!v) return null;
          const rewards = REWARDS.filter((r) => r.vendorId === c.vendorId);
          const pct = c.next ? Math.min(100, (c.visits / c.next.at) * 100) : 100;
          const isOpen = open === c.vendorId;
          const history = entries.filter((e) => e.vendorId === c.vendorId).slice(0, 6);
          return (
            <article key={c.vendorId} className={`overflow-hidden rounded-[26px] border ${isOpen ? 'border-z/50' : 'border-line'} bg-panel`}>
              <button onClick={() => setOpen(isOpen ? null : c.vendorId)} className="relative flex w-full items-center gap-4 bg-gradient-to-br from-z/20 via-panel to-panel p-5 text-left" aria-expanded={isOpen}>
                <Face media={v.avatar} size={56} ring />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-lg font-extrabold">{v.name}</div>
                  <div className="flex items-center gap-2 text-sm text-mute"><Sparkles size={14} className="text-z" /> {c.tier} · {c.visits} {c.visits === 1 ? 'visit' : 'visits'}</div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-z" style={{ width: `${pct}%` }} /></div>
                  <div className="mt-1 text-xs text-dim">{c.next ? `${c.next.at - c.visits} more ${c.next.at - c.visits === 1 ? 'visit' : 'visits'} to ${c.next.name}` : 'Top tier at this stall'}</div>
                </div>
                <div className="text-right"><div className="mega text-4xl text-z nums">{c.points}</div><div className="text-xs text-mute">points here</div></div>
              </button>
              {isOpen && (
                <div className="flex flex-col gap-3 border-t border-line p-5">
                  <div className="label">Rewards at {v.name.split(' ')[0]}</div>
                  {rewards.length ? rewards.map((r) => {
                    const can = c.points >= r.cost;
                    return (
                      <div key={r.id} className="flex items-center justify-between gap-3 rounded-2xl bg-raised p-3">
                        <div className="min-w-0"><div className="font-semibold">{r.label}</div><div className="text-xs text-mute">{can ? 'Ready to use' : `${r.cost - c.points} more points`}</div></div>
                        <button disabled={!can} onClick={() => say(redeem(r.label, r.cost, r.vendorId) ? `Redeemed. Show this screen at ${v.name}.` : 'Not enough points at this stall yet')} className={can ? 'btn-z px-4 py-2 text-sm' : 'btn-line px-4 py-2 text-sm'}><Gift size={15} /> {r.cost}</button>
                      </div>
                    );
                  }) : <p className="text-sm text-mute">{v.name} hasn’t set rewards yet. Your points keep adding up here.</p>}
                  <WalletPassButton kind="loyalty" />
                  {!!history.length && (
                    <ul className="divide-y divide-line text-sm">
                      {history.map((h) => <li key={h.id} className="flex justify-between py-2"><span className="text-mute">{h.label} · {ago(h.at)}</span><b className={`nums ${h.points >= 0 ? 'text-good' : 'text-mute'}`}>{h.points >= 0 ? '+' : ''}{h.points}</b></li>)}
                    </ul>
                  )}
                </div>
              )}
            </article>
          );
        })}
        <p className="text-center text-xs text-dim">Points can’t move between stalls: each stall pays for its own rewards.</p>
      </div>
    </div>
  );
}

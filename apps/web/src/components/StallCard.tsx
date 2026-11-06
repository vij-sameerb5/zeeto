import { BadgeCheck, Clock, Leaf, Star, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CATEGORIES, ME, distance, inr, km, type Product, type Vendor } from '@zeeto/core';
import { useApp } from '../store';
import { Face, Pic } from './kit';

/** Real stalls show no crypto words to shoppers; demo stalls keep their rail labels. */
export const Rails = ({ v }: { v: Vendor }) => v.ownerId ? <span className="text-sm text-chalk/80">Phone or email · no fees</span> : (
  <div className="flex flex-wrap gap-1.5">
    {v.rails.includes('streetpay-usdt') && <span className="rounded-full border border-line bg-raised px-2 py-0.5 font-mono text-[10px] text-chalk/80">USDT · Whitechain</span>}
    {v.rails.includes('uniswap-usdc') && <span className="rounded-full border border-line bg-raised px-2 py-0.5 font-mono text-[10px] text-chalk/80">ETH→USDC · Uniswap</span>}
  </div>
);

export const Tags = ({ v }: { v: Vendor }) =>
  v.fresh || v.offer ? (
    <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
      {v.fresh && <span className="inline-flex items-center gap-1 rounded-full bg-good-soft px-2 py-0.5 text-good"><Leaf size={11} /> Fresh today</span>}
      {v.offer && <span className="inline-flex items-center gap-1 rounded-full bg-z-soft px-2 py-0.5 text-z"><Tag size={11} /> {v.offer}</span>}
    </div>
  ) : null;

/** List row: two photos, like a stall seen from across the lane. */
export function StallRow({ v, active, onHover }: { v: Vendor; active?: boolean; onHover?: () => void }) {
  return (
    <Link to={`/s/${v.id}`} onMouseEnter={onHover} onFocus={onHover} className={`group block rounded-[24px] p-2 transition ${active ? 'bg-white/[.05]' : 'hover:bg-white/[.03]'}`}>
      <div className="grid grid-cols-[1.6fr_1fr] gap-1.5 overflow-hidden rounded-[18px]">
        <Pic media={v.cover} className="aspect-[16/11] h-full w-full transition duration-500 group-hover:scale-[1.03]" />
        <Pic media={v.photos[2] ?? v.avatar} className="aspect-[16/11] h-full w-full" />
      </div>
      <div className="flex items-start justify-between gap-3 px-1 pt-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5"><h3 className="truncate font-semibold">{v.name}</h3>{v.verified && <BadgeCheck size={15} className="shrink-0 text-z" aria-label="Verified" />}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] text-mute">
            <span>{CATEGORIES[v.category].label}</span><span className="text-dim">·</span>
            <span className="nums">{distance(km(ME.home, v.location))}</span><span className="text-dim">·</span>
            <span className="inline-flex items-center gap-1"><Clock size={12} />{v.hours.replace('-', '–')}</span>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold nums"><Star size={13} className="fill-z text-z" />{v.rating.toFixed(1)}</span>
      </div>
      <div className="px-1 pt-2"><Tags v={v} /></div>
    </Link>
  );
}

/** Card that slides up when a pin is tapped. */
export function StallPeek({ v, products }: { v: Vendor; products: Product[] }) {
  const following = useApp((s) => s.follows.includes(v.id));
  const follow = useApp((s) => s.follow);
  return (
    <div className="a-up overflow-hidden rounded-[26px] border border-line bg-panel/95 shadow-lift backdrop-blur-xl">
      <div className="flex items-center gap-3 p-3">
        <Face media={v.avatar} size={52} ring={v.fresh} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5"><h3 className="truncate text-[17px] font-bold">{v.name}</h3>{v.verified && <BadgeCheck size={15} className="shrink-0 text-z" />}</div>
          <div className="text-[13px] text-mute">{CATEGORIES[v.category].label} · {distance(km(ME.home, v.location))} · <Star size={11} className="inline fill-z text-z" /> {v.rating}</div>
        </div>
        <button onClick={() => follow(v.id)} className={`pill ${following ? '' : 'pill-on'}`}>{following ? 'Following' : 'Follow'}</button>
      </div>
      <div className="no-bar flex gap-2 overflow-x-auto px-3 pb-3">
        {products.slice(0, 5).map((p) => (
          <Link key={p.id} to={`/s/${v.id}`} className="relative w-[112px] shrink-0 overflow-hidden rounded-2xl">
            <Pic media={p.image} className="aspect-square w-full" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 pt-6">
              <div className="truncate text-xs font-semibold">{p.name}</div>
              <div className="text-xs font-bold text-z nums">{inr(p.priceInr)}</div>
            </div>
          </Link>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line p-3">
        <Rails v={v} />
        <Link to={`/s/${v.id}`} className="btn-z shrink-0 px-4 py-2.5 text-sm">Open stall</Link>
      </div>
    </div>
  );
}

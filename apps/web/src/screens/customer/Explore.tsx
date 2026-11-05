import { List, Map as MapIcon, Search } from 'lucide-react';
import { Suspense, lazy, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CATEGORIES, GROUPS, ME, VENDORS, km, type Category, type CategoryGroup, type Vendor } from '@zeeto/core';
import { Icon } from '../../components/kit';
import { StallPeek, StallRow } from '../../components/StallCard';
import StreetMap from '../../components/StreetMap';

const MapboxMap = lazy(() => import('../../components/MapboxMap'));
const MAPBOX = !!import.meta.env.VITE_MAPBOX_TOKEN;
import { StoryRail } from '../../components/Stories';
import { useApp, useBagCount } from '../../store';

type Quick = 'fresh' | 'offers' | 'following' | 'usdt' | 'eth';
const QUICK: [Quick, string][] = [['fresh', 'Fresh today'], ['offers', 'Offers'], ['following', 'Following'], ['usdt', 'Takes USDT'], ['eth', 'Takes ETH']];

export default function Explore() {
  const [group, setGroup] = useState<CategoryGroup | 'all'>('all');
  const [quick, setQuick] = useState<Quick | null>(null);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [view, setView] = useState<'map' | 'list'>('map');
  const products = useApp((s) => s.products);
  const follows = useApp((s) => s.follows);
  const edits = useApp((s) => s.edits);
  const flags = useApp((s) => s.stallFlags);
  const bag = useBagCount();
  const bagStall = useApp((s) => s.bag.vendorId);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    const ok = (v: Vendor) =>
      (group === 'all' || CATEGORIES[v.category].group === group) &&
      (!quick || (quick === 'fresh' && v.fresh) || (quick === 'offers' && !!v.offer) || (quick === 'following' && follows.includes(v.id)) || (quick === 'usdt' && v.rails.includes('streetpay-usdt')) || (quick === 'eth' && v.rails.includes('uniswap-usdc'))) &&
      (!t || v.name.toLowerCase().includes(t) || CATEGORIES[v.category].label.toLowerCase().includes(t) || products.some((p) => p.vendorId === v.id && p.name.toLowerCase().includes(t)));
    return VENDORS.filter((v) => edits[v.id]?.open !== false && !flags[v.id]?.suspended).filter(ok).sort((a, b) => km(ME.home, a.location) - km(ME.home, b.location));
  }, [group, quick, q, follows, products, edits, flags]);
  const hidden = useMemo(() => new Set(VENDORS.filter((v) => !shown.includes(v)).map((v) => v.id)), [shown]);
  const peek = shown.find((v) => v.id === sel);

  const search = (
    <label className="flex h-12 items-center gap-2.5 rounded-full border border-line bg-panel px-4 focus-within:border-z/60">
      <Search size={18} className="text-mute" />
      <input id="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tomatoes, medicine, LED bulb…" className="w-full bg-transparent text-[15px] outline-none placeholder:text-dim" />
    </label>
  );
  const groups = (
    <div className="no-bar -mx-4 flex gap-2 overflow-x-auto px-4">
      <button onClick={() => setGroup('all')} className={`pill ${group === 'all' ? 'pill-on' : ''}`}>All</button>
      {GROUPS.map((g) => <button key={g.id} onClick={() => setGroup(g.id)} className={`pill ${group === g.id ? 'pill-on' : ''}`}>{g.label}</button>)}
    </div>
  );

  return (
    <div className="md:flex md:h-[100dvh]">
      <section className={`flex-col md:flex md:w-[440px] md:shrink-0 md:border-r md:border-line ${view === 'list' ? 'flex' : 'hidden'}`}>
        <div className="gutter flex flex-col gap-3 pb-3 pt-5 pt-safe">
          <div className="flex items-center justify-between">
            <div><div className="label">Kalbadevi · Mumbai</div><h1 className="mt-1 text-2xl font-extrabold tracking-tight">{shown.length} stalls near you</h1></div>
            <button aria-label="Show map" onClick={() => setView('map')} className="grid h-11 w-11 place-items-center rounded-full border border-line md:hidden"><MapIcon size={18} /></button>
          </div>
          {search}
          {groups}
          <div className="no-bar -mx-4 flex gap-2 overflow-x-auto px-4">
            {QUICK.map(([id, l]) => <button key={id} onClick={() => setQuick(quick === id ? null : id)} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium ${quick === id ? 'border-z text-z' : 'border-line text-mute'}`}>{l}</button>)}
          </div>
        </div>
        <div className="gutter pb-2"><StoryRail /></div>
        <div className="gutter pt-2">
          <div className="label">Shop by kind</div>
          <div className="no-bar -mx-4 mt-3 flex gap-3 overflow-x-auto px-4">
            {(Object.keys(CATEGORIES) as Category[]).map((c) => (
              <button key={c} onClick={() => setQ(CATEGORIES[c].label)} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
                <span className="grid h-14 w-14 place-items-center rounded-2xl border border-line bg-panel text-z"><Icon name={CATEGORIES[c].icon} size={22} /></span>
                <span className="w-full truncate text-center text-[11px] text-mute">{CATEGORIES[c].label}</span>
              </button>
            ))}
          </div>
        </div>
        <ul className="gutter flex flex-col gap-1 pb-28 pt-3 md:flex-1 md:overflow-y-auto md:pb-6">
          <li className="label px-2 py-2">Nearest first</li>
          {shown.map((v) => <li key={v.id}><StallRow v={v} active={v.id === sel} onHover={() => setSel(v.id)} /></li>)}
          {!shown.length && <li className="py-12 text-center text-mute">No stalls match. Try another filter.</li>}
        </ul>
      </section>

      <section className={`relative h-[100dvh] md:block md:flex-1 ${view === 'map' ? 'block' : 'hidden'}`}>
        {MAPBOX ? (
          <Suspense fallback={<StreetMap vendors={VENDORS} me={ME.home} selected={peek?.id ?? null} onSelect={setSel} hidden={hidden} />}>
            <MapboxMap vendors={VENDORS} me={ME.home} selected={peek?.id ?? null} onSelect={setSel} hidden={hidden} />
          </Suspense>
        ) : <StreetMap vendors={VENDORS} me={ME.home} selected={peek?.id ?? null} onSelect={setSel} hidden={hidden} />}
        <div className="gutter absolute inset-x-0 top-0 flex flex-col gap-2.5 bg-gradient-to-b from-bg via-bg/75 to-transparent pb-8 pt-4 pt-safe md:hidden">
          <div className="flex items-center justify-between">
            <div><div className="label">Kalbadevi · Mumbai</div><div className="text-xl font-extrabold tracking-tight">{shown.length} stalls near you</div></div>
            <button aria-label="Show list" onClick={() => setView('list')} className="grid h-11 w-11 place-items-center rounded-full border border-line bg-panel"><List size={18} /></button>
          </div>
          {search}
          {groups}
        </div>
        <div className={`gutter absolute inset-x-0 md:left-auto md:right-6 md:w-[380px] ${bag ? 'bottom-[148px] md:bottom-24' : 'bottom-24 md:bottom-6'}`}>
          {peek ? <StallPeek key={peek.id} v={peek} products={products.filter((p) => p.vendorId === peek.id)} /> : <div className="frost mx-auto w-fit rounded-full px-4 py-2 text-sm text-chalk/80">Tap a stall to see what's on sale</div>}
        </div>
      </section>

      {bag > 0 && bagStall && (
        <Link to="/bag" className="btn-z fixed inset-x-4 bottom-[88px] z-30 mx-auto max-w-md justify-between shadow-glow md:bottom-6 md:left-auto md:right-6 md:w-[380px]">
          <span>{bag} item{bag > 1 ? 's' : ''} · {VENDORS.find((v) => v.id === bagStall)?.name}</span><span>View bag →</span>
        </Link>
      )}
    </div>
  );
}

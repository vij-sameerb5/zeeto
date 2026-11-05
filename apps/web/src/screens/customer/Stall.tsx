import { BadgeCheck, Bell, BellRing, ChevronLeft, Clock, Grid3x3, Info, Languages, Leaf, MapPin, Play, Share2, ShoppingBag, Star, Youtube } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { CATEGORIES, ME, POSTS, UNITS, ago, distance, inr, km } from '@zeeto/core';
import { Face, Pic, Qty, Toast } from '../../components/kit';
import { Rails, Tags } from '../../components/StallCard';
import { img } from '../../lib/media';
import { useApp, useVendor } from '../../store';

type Tab = 'shop' | 'posts' | 'videos' | 'about';

/** Instagram profile on top, Swiggy menu underneath. */
export default function Stall() {
  const { id } = useParams();
  const nav = useNavigate();
  const v = useVendor(id);
  const products = useApp((s) => s.products.filter((p) => p.vendorId === id));
  const alert = useApp((s) => s.alerts.find((a) => a.vendorId === id));
  const following = useApp((s) => s.follows.includes(id ?? ''));
  const follow = useApp((s) => s.follow);
  const bag = useApp((s) => s.bag);
  const setQty = useApp((s) => s.setQty);
  const say = useApp((s) => s.say);
  const [tab, setTab] = useState<Tab>('shop');
  const [zoom, setZoom] = useState<string | null>(null);
  if (!v) return <Navigate to="/explore" replace />;

  const mine = bag.vendorId === v.id ? bag.lines : {};
  const count = Object.values(mine).reduce((a, b) => a + b, 0);
  const total = Object.entries(mine).reduce((s, [pid, q]) => s + q * (products.find((p) => p.id === pid)?.priceInr ?? 0), 0);
  const grid = [...new Set([...v.photos, ...POSTS.filter((p) => p.vendorId === v.id).flatMap((p) => p.media)])];
  const TABS: [Tab, string, ReactNode][] = [['shop', 'Shop', <ShoppingBag key="s" size={16} />], ['posts', 'Posts', <Grid3x3 key="p" size={16} />], ['videos', 'Videos', <Youtube key="v" size={16} />], ['about', 'About', <Info key="a" size={16} />]];

  return (
    <div className="min-h-[100dvh] pb-36">
      <div className="relative h-[230px] overflow-hidden md:m-4 md:h-[300px] md:rounded-[32px]">
        <img src={img(v.cover)} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-bg md:to-black/70" />
        <div className="gutter absolute inset-x-0 top-0 flex justify-between pt-4 pt-safe">
          <button aria-label="Back" onClick={() => nav(-1)} className="frost grid h-10 w-10 place-items-center rounded-full"><ChevronLeft size={20} /></button>
          <button aria-label="Share" onClick={() => { navigator.clipboard?.writeText(window.location.href).then(() => say('Stall link copied'), () => say('Could not copy the link')); }} className="frost grid h-10 w-10 place-items-center rounded-full"><Share2 size={18} /></button>
        </div>
      </div>

      <div className="gutter mx-auto max-w-5xl">
        <div className="relative z-10 -mt-14 flex flex-col gap-4 md:-mt-20 md:flex-row md:items-end md:gap-8">
          <Face media={v.avatar} size={112} ring={v.fresh} alt={v.name} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><h1 className="text-[28px] font-extrabold leading-tight tracking-tight md:text-4xl">{v.name}</h1>{v.verified && <BadgeCheck size={22} className="shrink-0 text-z" aria-label="Verified" />}</div>
            <p className="mt-1 text-sm text-mute">{CATEGORIES[v.category].label} · {v.market} · {distance(km(ME.home, v.location))}</p>
          </div>
          <dl className="grid grid-cols-3 gap-2 text-center md:min-w-[320px]">
            {([[v.photos.length * 7, 'posts'], [v.followers + (following ? 1 : 0), 'followers'], [v.rating.toFixed(1), 'rating']] as const).map(([n, l]) => (
              <div key={l} className="rounded-2xl border border-line bg-panel px-2 py-3"><dt className="sr-only">{l}</dt><dd className="text-xl font-extrabold nums">{typeof n === 'number' ? n.toLocaleString('en-IN') : n}</dd><dd className="text-xs text-mute">{l}</dd></div>
            ))}
          </dl>
        </div>

        <p className="mt-4 max-w-2xl leading-relaxed text-chalk/90">{v.bio}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => follow(v.id)} className={following ? 'btn-line' : 'btn-z'}>{following ? <BellRing size={17} /> : <Bell size={17} />}{following ? 'Following' : 'Follow'}</button>
          <button onClick={() => setTab('shop')} className="btn-chalk">Order for pickup</button>
          <a className="btn-line" href={`https://www.google.com/maps/search/?api=1&query=${v.location.lat},${v.location.lng}`} target="_blank" rel="noreferrer"><MapPin size={17} /> Directions</a>
        </div>
        <div className="mt-4"><Tags v={v} /></div>

        <div className="no-bar -mx-4 mt-6 flex gap-4 overflow-x-auto px-4">
          {[['Today', v.photos[0]], ['Stall', v.photos[1] ?? v.avatar], ['Offers', v.photos[2] ?? v.avatar]].map(([l, m]) => (
            <button key={l} onClick={() => setZoom(m)} className="flex w-[72px] shrink-0 flex-col items-center gap-1.5"><Face media={m} size={68} ring="seen" /><span className="text-xs text-mute">{l}</span></button>
          ))}
          {v.youtube.length > 0 && (
            <button onClick={() => setTab('videos')} className="flex w-[72px] shrink-0 flex-col items-center gap-1.5"><span className="grid h-[68px] w-[68px] place-items-center rounded-full border border-line-2 bg-raised text-z"><Play size={22} className="fill-current" /></span><span className="text-xs text-mute">Videos</span></button>
          )}
        </div>

        <div role="tablist" className="sticky top-0 z-20 -mx-4 mt-6 flex border-b border-line bg-bg/90 px-4 backdrop-blur-xl">
          {TABS.map(([t, l, i]) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 py-3.5 text-sm font-semibold md:flex-none md:px-6 ${tab === t ? 'border-z text-chalk' : 'border-transparent text-dim'}`}>{i}{l}</button>
          ))}
        </div>

        {tab === 'shop' && (
          <div className="flex flex-col gap-5 pt-5">
            {alert && (
              <div className="flex gap-3 rounded-2xl border border-good/25 bg-good-soft p-4">
                <Leaf size={18} className="mt-0.5 shrink-0 text-good" />
                <div className="text-sm"><b>{alert.title}</b> <span className="text-mute">· {ago(alert.at)}</span><p className="mt-0.5 text-chalk/80">{alert.body}</p></div>
              </div>
            )}
            {bag.vendorId && bag.vendorId !== v.id && <p className="rounded-2xl bg-warn-soft px-4 py-3 text-sm text-warn">Your bag has items from another stall. Adding here starts a new bag, since pickup is at one stall.</p>}
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
                <li key={p.id} className="overflow-hidden rounded-[22px] border border-line bg-panel">
                  <div className="relative">
                    <Pic media={p.image} alt={p.name} className="aspect-square w-full" />
                    {p.freshUntil && <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-good backdrop-blur">Fresh</span>}
                    {p.stock > 0 && p.stock <= 10 && <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-warn backdrop-blur">{p.stock} left</span>}
                  </div>
                  <div className="flex items-end justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{p.name}</div>
                      {p.local && <div className="truncate text-xs text-dim">{p.local}</div>}
                      <div className="mt-1 text-sm nums"><b className="text-z">{inr(p.priceInr)}</b><span className="text-mute"> / {UNITS[p.unit]}</span></div>
                    </div>
                    <Qty qty={mine[p.id] ?? 0} max={p.stock} onChange={(q) => setQty(v.id, p.id, q)} />
                  </div>
                </li>
              ))}
            </ul>
            <Rails v={v} />
          </div>
        )}

        {tab === 'posts' && (
          <div className="grid grid-cols-3 gap-1 pt-1 md:gap-2 md:pt-4">
            {grid.map((m) => <button key={m} onClick={() => setZoom(m)} className="group aspect-square overflow-hidden md:rounded-xl"><Pic media={m} className="h-full w-full transition duration-500 group-hover:scale-105" /></button>)}
          </div>
        )}

        {tab === 'videos' && (
          <div className="flex flex-col gap-4 pt-5">
            {!v.youtube.length && <p className="py-10 text-center text-mute">{v.name} hasn't linked any videos yet.</p>}
            {v.youtube.map((y) => (
              <div key={y} className="overflow-hidden rounded-[22px] border border-line bg-panel">
                {__SINGLE__ ? (
                  <a href={`https://www.youtube.com/watch?v=${y}`} target="_blank" rel="noreferrer" className="relative block aspect-video"><Pic media={v.cover} className="h-full w-full" /><span className="absolute inset-0 grid place-items-center bg-black/40"><span className="grid h-14 w-14 place-items-center rounded-full bg-z text-z-ink"><Play size={22} className="fill-current" /></span></span></a>
                ) : (
                  <iframe className="aspect-video w-full" src={`https://www.youtube-nocookie.com/embed/${y}`} title={`${v.name} video`} allow="encrypted-media; picture-in-picture" allowFullScreen loading="lazy" />
                )}
                <div className="flex items-center justify-between p-4 text-sm"><span className="inline-flex items-center gap-2 font-semibold"><Youtube size={16} className="text-bad" /> Linked by {v.owner.split(' ')[0]}</span><a href={`https://www.youtube.com/watch?v=${y}`} target="_blank" rel="noreferrer" className="text-z">Open on YouTube</a></div>
              </div>
            ))}
          </div>
        )}

        {tab === 'about' && (
          <dl className="grid gap-3 pt-5 sm:grid-cols-2">
            {([[Clock, 'Hours', v.hours.replace('-', ' – ')], [MapPin, 'Find us', `${v.landmark}, ${v.market}`], [Languages, 'Speaks', v.languages.join(', ')], [Star, 'Rating', `${v.rating.toFixed(1)} from regulars`]] as const).map(([I, t, d]) => (
              <div key={t} className="flex gap-3 rounded-2xl border border-line bg-panel p-4"><I size={18} className="text-z" /><div><dt className="text-xs text-mute">{t}</dt><dd className="mt-0.5 font-medium">{d}</dd></div></div>
            ))}
            <div className="rounded-2xl border border-line bg-panel p-4 sm:col-span-2"><div className="mb-2 text-xs text-mute">Pay with</div><Rails v={v} /></div>
          </dl>
        )}
      </div>

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 backdrop-blur-xl pb-safe">
          <div className="gutter mx-auto flex max-w-5xl items-center gap-3 py-3">
            <div className="min-w-0 flex-1"><div className="text-xs text-mute">{count} item{count > 1 ? 's' : ''} · pickup at {v.name}</div><div className="text-2xl font-extrabold nums">{inr(total)}</div></div>
            <Link to="/bag" className="btn-z">View bag</Link>
          </div>
        </div>
      )}
      {zoom && <button aria-label="Close photo" onClick={() => setZoom(null)} className="fixed inset-0 z-[80] grid place-items-center bg-black/95 p-4"><img src={img(zoom)} alt="" className="a-up max-h-full max-w-full rounded-2xl object-contain" /></button>}
      <Toast />
    </div>
  );
}

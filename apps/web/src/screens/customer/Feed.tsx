import { BadgeCheck, Bookmark, Heart, MessageCircle, Send } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { POSTS, ago, inr, type Post } from '@zeeto/core';
import { Face, Header, Pic } from '../../components/kit';
import { StoryRail } from '../../components/Stories';
import { findVendor, useApp } from '../../store';

/** Instagram for the lane: stalls you follow first, every post shoppable. */
export default function Feed() {
  const follows = useApp((s) => s.follows);
  const alerts = useApp((s) => s.alerts);
  const [only, setOnly] = useState(false);
  const posts = [...POSTS]
    .filter((p) => !only || follows.includes(p.vendorId))
    .sort((a, b) => Number(follows.includes(b.vendorId)) - Number(follows.includes(a.vendorId)));

  return (
    <div>
      <Header title="Feed" sub="What the lane is up to today" right={
        <div className="flex rounded-full border border-line bg-panel p-1 text-sm">
          <button onClick={() => setOnly(false)} className={`rounded-full px-3 py-1.5 ${!only ? 'bg-chalk font-semibold text-bg' : 'text-mute'}`}>All</button>
          <button onClick={() => setOnly(true)} className={`rounded-full px-3 py-1.5 ${only ? 'bg-chalk font-semibold text-bg' : 'text-mute'}`}>Following</button>
        </div>
      } />
      <div className="gutter mx-auto flex max-w-xl flex-col gap-6 py-5">
        <StoryRail />
        {alerts.slice(0, 2).map((a) => {
          const v = findVendor(a.vendorId)!;
          return (
            <Link key={a.id} to={`/s/${v.id}`} className="flex items-center gap-3 rounded-[22px] border border-z/30 bg-gradient-to-r from-z/15 to-transparent p-3">
              <Face media={v.avatar} size={44} ring />
              <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{a.title}</div><div className="truncate text-xs text-mute">{v.name} · {ago(a.at)}</div></div>
              <span className="text-sm font-semibold text-z">Shop</span>
            </Link>
          );
        })}
        {posts.map((p) => <PostCard key={p.id} p={p} />)}
      </div>
    </div>
  );
}

function PostCard({ p }: { p: Post }) {
  const v = findVendor(p.vendorId)!;
  const liked = useApp((s) => s.liked.includes(p.id));
  const saved = useApp((s) => s.saved.includes(p.id));
  const like = useApp((s) => s.like);
  const save = useApp((s) => s.save);
  const say = useApp((s) => s.say);
  const products = useApp((s) => s.products.filter((x) => p.productIds.includes(x.id)));
  const [i, setI] = useState(0);
  const [burst, setBurst] = useState(0);
  const last = useRef(0);

  const tap = () => {
    const now = Date.now();
    if (now - last.current < 300) { if (!liked) like(p.id); setBurst((b) => b + 1); }
    last.current = now;
  };

  return (
    <article className="overflow-hidden rounded-[26px] border border-line bg-panel">
      <header className="flex items-center gap-3 p-3">
        <Link to={`/s/${v.id}`}><Face media={v.avatar} size={40} ring={v.fresh} /></Link>
        <div className="min-w-0 flex-1">
          <Link to={`/s/${v.id}`} className="flex items-center gap-1 font-semibold">{v.name}{v.verified && <BadgeCheck size={14} className="text-z" />}</Link>
          <div className="text-xs text-dim">{v.landmark}</div>
        </div>
        {p.tag && <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${p.tag === 'fresh' ? 'bg-good-soft text-good' : 'bg-z-soft text-z'}`}>{p.tag === 'fresh' ? 'Fresh' : 'Offer'}</span>}
      </header>
      <div className="relative select-none" onClick={tap}>
        <Pic media={p.media[i]} alt={p.caption} className="aspect-square w-full" />
        {burst > 0 && <Heart key={burst} size={96} className="pointer-events-none absolute left-1/2 top-1/2 -ml-12 -mt-12 fill-chalk text-chalk" style={{ animation: 'heart .8s ease-out both' }} />}
        {p.media.length > 1 && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {p.media.map((_, j) => <button key={j} aria-label={`Photo ${j + 1}`} onClick={(e) => { e.stopPropagation(); setI(j); }} className={`h-2 w-2 rounded-full ${j === i ? 'bg-z' : 'bg-white/50'}`} />)}
          </div>
        )}
      </div>
      <div className="flex items-center gap-4 px-4 pt-3">
        <button aria-label="Like" aria-pressed={liked} onClick={() => like(p.id)}><Heart size={24} className={liked ? 'fill-z-hot text-z-hot' : ''} /></button>
        <MessageCircle size={23} />
        <button aria-label="Share" onClick={() => { navigator.clipboard?.writeText(`${location.origin}/s/${v.id}`).then(() => say('Link copied'), () => undefined); }}><Send size={22} /></button>
        <span className="flex-1" />
        <button aria-label="Save" aria-pressed={saved} onClick={() => save(p.id)}><Bookmark size={23} className={saved ? 'fill-chalk' : ''} /></button>
      </div>
      <div className="flex flex-col gap-1 px-4 pb-4 pt-2 text-sm">
        <b className="nums">{(p.likes + (liked ? 1 : 0)).toLocaleString('en-IN')} likes</b>
        <p><b>{v.name.split(' ')[0]}</b> {p.caption}</p>
        <span className="text-xs text-dim">{p.comments} comments · {ago(p.at)}</span>
        {products.length > 0 && (
          <div className="no-bar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4">
            {products.map((x) => (
              <Link key={x.id} to={`/s/${v.id}`} className="flex shrink-0 items-center gap-2 rounded-2xl border border-line bg-raised p-1.5 pr-3 hover:border-z/50">
                <Pic media={x.image} className="h-9 w-9 rounded-xl" />
                <span className="text-xs"><span className="block font-semibold">{x.name}</span><span className="font-bold text-z">{inr(x.priceInr)} · Shop</span></span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

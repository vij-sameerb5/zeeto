import { ArrowRight, ArrowUpRight, Coins, Heart, MapPin, Play, QrCode, ShieldCheck, ShoppingBag, Store } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useApp } from '../store';
import { CATEGORIES, MARKET_VIDEOS, POSTS, STORIES, VENDORS, ago, type Category } from '@zeeto/core';
import { Face, Icon, Pic, Wordmark } from '../components/kit';
import { img, vid } from '../lib/media';

const count = (c: Category) => VENDORS.filter((v) => v.category === c).length;
const TILES: Category[] = ['vegetables', 'street-food', 'pharmacy', 'electrical', 'chai', 'sweets', 'hardware', 'flowers'];

/** Opened as the installed app (home-screen icon): skip the marketing page. */
const standalone = () => { try { return matchMedia('(display-mode: standalone)').matches; } catch { return false; } };

export default function Landing() {
  const startAs = useApp((x) => x.startAs);
  if (standalone()) return <Navigate to={startAs === 'merchant' ? '/sell' : startAs === 'customer' ? '/explore' : '/start'} replace />;
  const cats = Object.keys(CATEGORIES) as Category[];
  const ravi = VENDORS[0];
  return (
    <main>
      {/* Hero: full-bleed market video */}
      <section className="h-[100dvh] min-h-[620px] p-2 sm:p-3">
        <div className="relative h-full overflow-hidden rounded-[26px] md:rounded-[36px]">
          <video className="absolute inset-0 hidden h-full w-full object-cover md:block" src={vid('hero-wide')} poster={img('hero-wide')} autoPlay muted loop playsInline aria-hidden />
          <video className="absolute inset-0 h-full w-full object-cover md:hidden" src={vid('hero-tall')} poster={img('hero-tall')} autoPlay muted loop playsInline aria-hidden />
          <div className="noise pointer-events-none absolute inset-0" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/65 via-black/10 to-black/90" />

          <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4 md:p-7">
            <Wordmark />
            <nav className="frost hidden gap-1 rounded-full p-1 text-sm font-medium md:flex">
              {[['#shops', 'Shops'], ['#feed', 'Feed'], ['#pay', 'Pay'], ['#vendors', 'For vendors']].map(([h, l]) => (
                <a key={h} href={h} className="rounded-full px-4 py-2 text-chalk/80 hover:bg-white/10 hover:text-chalk">{l}</a>
              ))}
            </nav>
            <Link to="/start" className="btn-chalk px-4 py-2.5 text-sm">Sign in</Link>
          </header>

          <div className="absolute inset-x-0 bottom-0 z-10 grid gap-6 p-4 md:grid-cols-12 md:items-end md:p-8">
            <div className="md:col-span-7">
              <p className="label text-z">Kalbadevi · Mumbai · live pilot</p>
              <h1 className="a-rise mega mt-3 text-[30vw] text-chalk md:text-[17vw]">zeeto<span className="text-z">.</span></h1>
            </div>
            <div className="flex flex-col gap-5 md:col-span-5">
              <p className="text-[26px] font-semibold leading-[1.08] tracking-[-0.02em] md:text-[34px]">Every stall on your street, in your pocket. Order ahead. Pay in stablecoins.</p>
              <div className="flex flex-wrap gap-2">
                {[`${VENDORS.length} stalls`, `${cats.length} kinds of shop`, 'USDT · ETH'].map((t) => <span key={t} className="frost rounded-full px-3 py-1.5 font-mono text-[11px] tracking-wider">{t}</span>)}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link to="/start?as=customer" className="group inline-flex items-center gap-3 rounded-full bg-chalk py-1 pl-6 pr-1 text-[15px] font-semibold text-bg">
                  Explore the market
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-z text-z-ink transition group-hover:scale-110"><ArrowRight size={18} /></span>
                </Link>
                <Link to="/start?as=merchant" className="frost rounded-full px-5 py-3.5 text-[15px] font-semibold">I sell here</Link>
              </div>
              <div className="frost hidden items-center gap-3 rounded-2xl p-3 md:flex">
                <Face media={ravi.avatar} size={42} ring />
                <p className="min-w-0 text-sm"><b>{ravi.name}</b> <span className="text-mute">· {ago(STORIES[0].at)}</span><br /><span className="text-chalk/75">Nashik tomatoes just landed.</span></p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Category ticker */}
      <div className="overflow-hidden border-y border-line py-5" aria-hidden>
        <div className="a-slide flex w-max gap-12 whitespace-nowrap">
          {[...cats, ...cats].map((c, i) => (
            <span key={i} className="inline-flex items-center gap-3 text-2xl font-bold tracking-tight text-chalk/80"><Icon name={CATEGORIES[c].icon} size={22} className="text-z" />{CATEGORIES[c].label}</span>
          ))}
        </div>
      </div>

      {/* Every shop */}
      <section id="shops" className="gutter mx-auto max-w-[1400px] py-20 md:py-28">
        <div className="mb-10 grid gap-6 md:grid-cols-2 md:items-end">
          <h2 className="mega text-[clamp(52px,8vw,112px)]">Not just<br /><span className="text-z">sabzi.</span></h2>
          <p className="max-w-md text-lg text-mute md:justify-self-end">The chaiwala and the vada pav cart, and also the chemist, the electrician, the tailor and the kirana store your family uses every week.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:grid-rows-2 md:gap-4">
          {TILES.map((c, i) => (
            <Link key={c} to="/explore" className={`group relative overflow-hidden rounded-[24px] border border-line ${i === 0 ? 'col-span-2 aspect-[16/10] md:row-span-2 md:aspect-auto' : 'aspect-[4/5]'}`}>
              <Pic media={CATEGORIES[c].cover} className="absolute inset-0 h-full w-full transition duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
              <span className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-chalk text-bg transition group-hover:bg-z"><ArrowUpRight size={16} /></span>
              <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
                <p className="font-mono text-[10px] tracking-[.2em] text-z">{count(c)} {count(c) === 1 ? 'STALL' : 'STALLS'}</p>
                <h3 className={`font-extrabold tracking-tight ${i === 0 ? 'text-4xl md:text-6xl' : 'text-2xl'}`}>{CATEGORIES[c].label}</h3>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Stories */}
      <section className="mx-auto max-w-[1400px] pb-20">
        <div className="gutter mb-6 flex items-end justify-between">
          <div><p className="label">Live from the stalls</p><h2 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">Fresh around you</h2></div>
          <Link to="/feed" className="text-sm font-semibold text-z">Open the feed →</Link>
        </div>
        <div className="no-bar gutter flex gap-3 overflow-x-auto pb-2">
          {STORIES.map((s) => {
            const v = VENDORS.find((x) => x.id === s.vendorId)!;
            return (
              <Link key={s.id} to={`/s/${v.id}`} className="group relative aspect-[9/16] w-[176px] shrink-0 overflow-hidden rounded-[22px] border border-line md:w-[216px]">
                <Pic media={s.media} className="absolute inset-0 h-full w-full transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/90" />
                <div className="absolute left-3 right-3 top-3 flex items-center gap-2"><Face media={v.avatar} size={34} ring /><span className="truncate text-xs font-semibold">{v.name}</span></div>
                <p className="absolute inset-x-3 bottom-3 text-[15px] font-bold leading-tight">{s.text}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Feed pitch */}
      <section id="feed" className="gutter mx-auto grid max-w-[1400px] items-center gap-14 py-20 lg:grid-cols-2">
        <PhonePreview />
        <div>
          <p className="label">Swiggy meets Instagram</p>
          <h2 className="mega mt-3 text-[clamp(44px,6vw,88px)]">Follow the stall.<br /><span className="text-z">Shop the post.</span></h2>
          <ul className="mt-9 flex flex-col gap-6">
            {[
              [Store, 'Stalls post like creators', 'Photos, stories and YouTube videos on every stall profile. Fresh stock shows up the moment it lands.'],
              [Heart, 'Follow your regulars', 'Your chaiwala, your chemist, your sabziwala. Hear first when what you buy is back.'],
              [ShoppingBag, 'Buy from the post', 'Tap the product in a post, add it, pick it up on your way home.'],
            ].map(([I, t, b]) => {
              const C = I as typeof Store;
              return (
                <li key={t as string} className="flex gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-z-soft text-z"><C size={20} /></span>
                  <div><h3 className="text-lg font-bold">{t as string}</h3><p className="mt-1 text-mute">{b as string}</p></div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section className="gutter mx-auto max-w-[1400px] py-16">
        <p className="label">How it works</p>
        <h2 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">Map to bag in four taps.</h2>
        <ol className="mt-10 grid gap-3 md:grid-cols-4">
          {[
            [MapPin, 'Find', 'See who is selling what within 500 m, right now.'],
            [Store, 'Order', 'Add from the stall’s shop. One stall per bag, picked up in person.'],
            [Coins, 'Pay onchain', 'USDT on Whitechain, or ETH swapped to USDC by Uniswap.'],
            [QrCode, 'Pick up', 'Show your code. The vendor checks it and hands over. You earn points.'],
          ].map(([I, t, b], i) => {
            const C = I as typeof MapPin;
            return (
              <li key={t as string} className="panel flex flex-col gap-4 p-6">
                <div className="flex items-center justify-between"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-raised text-z"><C size={22} /></span><span className="font-mono text-xs text-dim">0{i + 1}</span></div>
                <h3 className="text-xl font-bold">{t as string}</h3>
                <p className="text-mute">{b as string}</p>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Pay + points */}
      <section id="pay" className="gutter mx-auto grid max-w-[1400px] gap-4 py-12 lg:grid-cols-2">
        <div className="panel flex flex-col gap-6 p-7 md:p-10">
          <p className="label">Payments</p>
          <h2 className="text-4xl font-extrabold tracking-tight">Pay the chaiwala in crypto.</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {[['StreetPay USDT', 'Whitechain · 1874', 'No gas, onchain receipt, one-tap refunds.'], ['Pay with ETH', 'Unichain · 1301', 'Uniswap swaps your ETH to exact USDC for the vendor.']].map(([t, n, b]) => (
              <div key={t} className="rounded-2xl border border-line bg-raised p-5"><div className="font-mono text-[10px] tracking-widest text-z">{n}</div><div className="mt-2 text-lg font-bold">{t}</div><p className="mt-1 text-sm text-mute">{b}</p></div>
            ))}
          </div>
          <p className="flex items-center gap-2 text-sm text-mute"><ShieldCheck size={16} className="text-good" /> The vendor sees an order only after the payment is verified onchain.</p>
        </div>
        <div className="relative overflow-hidden rounded-[22px] border border-z/25 bg-[radial-gradient(110%_75%_at_50%_0%,rgba(255,122,26,.4),rgba(10,10,10,0)_65%)] p-7 text-center md:p-10">
          <p className="label text-z/80">Zeeto points</p>
          <div className="mt-6 text-[96px] font-black leading-none tracking-[-0.06em] text-[#FFD6AE] [text-shadow:0_0_26px_rgba(255,122,26,.9),0_0_70px_rgba(255,90,0,.55)] md:text-[128px]">412</div>
          <p className="mt-2 text-sm text-z">earned at 6 stalls this month</p>
          <div className="mx-auto mt-8 max-w-md rounded-2xl border border-z/25 bg-black/45 p-5 text-left">
            <div className="flex justify-between text-sm"><span><b>289</b><span className="text-mute">/350</span> to Local</span><span className="text-z">2× points</span></div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[82%] rounded-full bg-gradient-to-r from-[#FFE2C4] via-z to-z-hot shadow-glow" /></div>
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="gutter mx-auto max-w-[1400px] py-20">
        <div className="mb-8 flex items-end justify-between"><h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">This week at the stalls</h2><Link to="/feed" className="text-sm font-semibold text-z">Feed →</Link></div>
        <div className="grid grid-cols-3 gap-1 md:grid-cols-6 md:gap-2">
          {POSTS.slice(0, 12).map((p) => (
            <Link key={p.id} to={`/s/${p.vendorId}`} className="group relative aspect-square overflow-hidden rounded-md md:rounded-xl">
              <Pic media={p.media[0]} className="h-full w-full transition duration-500 group-hover:scale-110" />
              <span className="absolute inset-0 flex items-center justify-center gap-1 bg-black/50 text-sm font-semibold opacity-0 transition group-hover:opacity-100"><Heart size={16} className="fill-chalk" />{p.likes}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* YouTube */}
      <section className="gutter mx-auto max-w-[1400px] py-10">
        <p className="label">On YouTube</p>
        <h2 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">The market, on video</h2>
        <p className="mt-2 max-w-xl text-mute">Vendors link their own videos to their profile. A few that creators made about this market:</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MARKET_VIDEOS.map((v, i) => (
            <a key={v.id} href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer" className="group panel overflow-hidden">
              <div className="relative aspect-video">
                {__SINGLE__ ? <Pic media={['food-2', 'pani-2', 'spice-5', 'food-3'][i]} className="h-full w-full" /> : <img src={`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`} alt="" loading="lazy" className="h-full w-full object-cover" />}
                <span className="absolute inset-0 grid place-items-center bg-black/30"><span className="grid h-12 w-12 place-items-center rounded-full bg-z text-z-ink transition group-hover:scale-110"><Play size={18} className="fill-current" /></span></span>
              </div>
              <div className="p-4 text-sm font-semibold">{v.title}</div>
            </a>
          ))}
        </div>
      </section>

      {/* Vendors */}
      <section id="vendors" className="gutter mx-auto max-w-[1400px] pb-24 pt-12">
        <div className="relative overflow-hidden rounded-[36px] bg-z px-7 py-16 text-z-ink md:px-16 md:py-24">
          <div aria-hidden className="absolute -right-28 -top-28 h-[440px] w-[440px] rounded-full border-[64px] border-black/10" />
          <p className="font-mono text-[12px] font-medium tracking-[.2em]">FOR VENDORS · FREE TO JOIN</p>
          <h2 className="mega mt-4 max-w-3xl text-[clamp(48px,8vw,120px)]">Put your stall on the map.</h2>
          <p className="mt-6 max-w-xl text-lg font-medium">Snap today's stock. AI writes the listing and tells your followers in Hindi, Marathi and English. Get paid in stablecoins, with receipts and refunds built in.</p>
          <Link to="/join" className="btn mt-10 bg-z-ink text-z">Open my stall <ArrowRight size={18} /></Link>
        </div>
      </section>

      <footer className="gutter mx-auto flex max-w-[1400px] flex-col gap-4 border-t border-line py-10 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4"><Wordmark /><span className="text-sm text-mute">ETHGlobal Mumbai 2026</span></div>
        <p className="text-xs text-dim">Testnet demo. Stalls shown are fictional. Photos: Unsplash. Video: Pexels.</p>
      </footer>
    </main>
  );
}

function PhonePreview() {
  const p = POSTS.find((x) => x.vendorId === 'mithai') ?? POSTS[0];
  const v = VENDORS.find((x) => x.id === p.vendorId)!;
  return (
    <div className="relative mx-auto w-full max-w-[380px]">
      <div aria-hidden className="absolute -inset-10 rounded-full bg-z/20 blur-3xl" />
      <div className="relative rounded-[46px] border border-line-2 bg-black p-3 shadow-lift">
        <div className="overflow-hidden rounded-[36px] bg-bg">
          <div className="flex gap-3 overflow-hidden px-4 pb-3 pt-5">
            {VENDORS.slice(0, 5).map((x, i) => (
              <div key={x.id} className="flex w-14 shrink-0 flex-col items-center gap-1"><Face media={x.avatar} size={56} ring={i < 3 ? true : 'seen'} /><span className="w-full truncate text-center text-[10px] text-mute">{x.name.split(' ')[0]}</span></div>
            ))}
          </div>
          <div className="flex items-center gap-2 px-4 py-2"><Face media={v.avatar} size={32} /><div className="text-xs"><div className="font-semibold">{v.name}</div><div className="text-mute">{v.market}</div></div></div>
          <img src={img(p.media[0])} alt="" className="aspect-square w-full object-cover" />
          <div className="flex items-center justify-between px-4 py-3"><Heart size={22} className="fill-z text-z" /><span className="rounded-full bg-z px-3 py-1 text-xs font-bold text-z-ink">Shop · ₹80</span></div>
          <p className="px-4 pb-5 text-sm"><b>{p.likes} likes</b> · {p.caption}</p>
        </div>
      </div>
    </div>
  );
}

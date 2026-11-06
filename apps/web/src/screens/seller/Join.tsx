import { ArrowLeft, Check, KeyRound, Loader2, LocateFixed, MapPin, PartyPopper, Phone, Store as StoreIcon } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CATEGORIES, CENTER, short, type Category, type Vendor } from '@zeeto/core';
import { api, serverOn } from '../../lib/api';
import { loadStalls } from '../../lib/sync';
import { Mark, Sim } from '../../components/kit';
import { useSession } from '../../lib/auth';
import { indianMobile } from '../../lib/upload';
import { useMyStallId, useApp, useVendor } from '../../store';

const STEPS = ['Phone', 'Shop', 'Location', 'Wallet', 'Live'] as const;

/** Vendor onboarding: phone → shop → location → wallet → live with a QR. No crypto words until the wallet step. */
export default function Join() {
  const MY = useMyStallId();
  const nav = useNavigate();
  const demo = useVendor(MY)!;
  const goLive = useApp((s) => s.goLive);
  const createStall = useApp((s) => s.createStall);
  const [liveId, setLiveId] = useState<string | null>(null);
  const session = useSession();
  const privy = session.mode === 'privy';
  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [cat, setCat] = useState<Category>('vegetables');
  const [tagline, setTagline] = useState('');
  const [landmark, setLandmark] = useState('');
  const [from, setFrom] = useState('07:00');
  const [to, setTo] = useState('21:00');
  const [pos, setPos] = useState<{ lat: number; lng: number; src: 'gps' | 'demo' } | null>(null);
  const [locating, setLocating] = useState(false);
  const [wallet, setWallet] = useState<string | null>(null);
  const num = indianMobile(phone);
  const owned = useApp((s) => s.myStalls.find((x) => !!s.me && x.ownerId === s.me));

  useEffect(() => {
    if (step !== 3 || wallet) return;
    // With Privy the embedded wallet already exists after sign-in; the demo fakes the wait.
    if (privy && session.address) { setWallet(session.address); return; }
    const t = setTimeout(() => setWallet(demo.wallet), 1400);
    return () => clearTimeout(t);
  }, [step, wallet, demo.wallet, privy, session.address]);

  const locate = () => {
    setLocating(true);
    if (!navigator.geolocation) { setPos({ ...CENTER, src: 'demo' }); setLocating(false); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude, src: 'gps' }); setLocating(false); },
      () => { setPos({ ...CENTER, src: 'demo' }); setLocating(false); },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const [saving, setSaving] = useState(false);
  const finish = async () => {
    // With the Zeeto server: the stall is saved there (everyone can see it), payouts to your own Privy wallet, set by the server.
    if (privy && session.authed && serverOn()) {
      setSaving(true);
      try {
        const cover = CATEGORIES[cat].cover;
        const r = await api<{ vendor: Vendor }>('/api/stalls', { body: {
          stall: { name: name.trim(), owner: session.label ?? 'Owner', category: cat, tagline: tagline.trim(), bio: tagline.trim(), location: { lat: pos!.lat, lng: pos!.lng }, landmark: landmark.trim(), market: 'Kalbadevi', hours: `${from}-${to}`, languages: ['Hindi', 'English'], fresh: true, avatar: cover, cover, photos: [cover] },
          waPhone: num ?? undefined,
        } });
        createStall(r.vendor);
        await loadStalls().catch(() => undefined); // so product edits start syncing straight away
        setLiveId(r.vendor.id);
        setStep(4);
      } catch (e) {
        useApp.getState().say((e as Error).message);
      } finally { setSaving(false); }
      return;
    }
    // Signed in with Privy: create a real stall whose payouts go to this account's own wallet.
    if (privy && session.userId && session.address) {
      const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28) || 'stall';
      const id = `${base}-${session.userId.slice(-4).toLowerCase()}`;
      const cover = CATEGORIES[cat].cover;
      createStall({
        id, name: name.trim(), owner: session.label ?? 'Owner', ownerId: session.userId, category: cat,
        tagline: tagline.trim(), bio: tagline.trim(), location: { lat: pos!.lat, lng: pos!.lng }, landmark: landmark.trim(), market: 'Kalbadevi',
        hours: `${from}-${to}`, rating: 5, followers: 0, verified: false, rails: ['streetpay-usdt', 'uniswap-usdc'],
        wallet: session.address, payoutReal: true, languages: ['Hindi', 'English'], fresh: true,
        avatar: cover, cover, photos: [cover], youtube: [],
      });
      useApp.getState().editProfile(id, { waPhone: num ?? undefined, open: true });
      setLiveId(id);
      setStep(4);
      return;
    }
    setLiveId(MY);
    goLive(MY, { name: name.trim(), tagline: tagline.trim(), landmark: landmark.trim(), hours: `${from}-${to}`, waPhone: num ?? undefined });
    setStep(4);
  };

  const can = [
    privy ? session.authed : otpSent && /^\d{6}$/.test(otp),
    name.trim().length >= 2 && tagline.trim().length >= 4,
    !!pos && landmark.trim().length >= 3,
    !!wallet,
  ][step];


  // One stall per account: a second sign-up would split payouts and confuse customers.
  if (privy && owned && !liveId) return (
    <div className="gutter mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-4 py-10 text-center">
      <StoreIcon size={36} className="mx-auto text-z" />
      <h1 className="text-2xl font-extrabold">You already have a stall</h1>
      <p className="text-mute">{owned.name} is linked to this account. Payouts go to {short(owned.wallet)}.</p>
      <Link to="/sell" className="btn-z">Open my dashboard</Link>
    </div>
  );
  return (
    <div className="min-h-[100dvh]">
      <header className="gutter mx-auto flex h-16 max-w-xl items-center justify-between pt-safe">
        {step > 0 && step < 4 ? <button aria-label="Back" onClick={() => setStep(step - 1)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/5"><ArrowLeft size={20} /></button> : <Link to="/" aria-label="Zeeto"><Mark size={34} /></Link>}
        {privy ? <span className="rounded-full bg-good-soft px-2.5 py-1 font-mono text-[10px] uppercase text-good">Privy</span> : <Sim label="Demo sign-up" />}
      </header>
      <div className="gutter mx-auto flex max-w-xl flex-col gap-6 pb-16 pt-4">
        <ol className="flex gap-1.5" aria-label="Progress">
          {STEPS.map((s, i) => <li key={s} className="flex-1"><span className={`block h-1.5 rounded-full ${i <= step ? 'bg-z' : 'bg-raised'}`} /><span className={`mt-1.5 block text-[11px] ${i === step ? 'text-chalk' : 'text-dim'}`}>{s}</span></li>)}
        </ol>

        {step === 0 && (
          <Step icon={<Phone />} title="Sell on Zeeto" sub="Your phone number is your login. No email, no app store, no crypto knowledge needed.">
            {privy ? (
              session.authed ? <div className="panel p-4 text-sm">Signed in as <b className="font-mono">{session.label}</b></div>
                : <button onClick={session.login} className="btn-z">Continue with phone</button>
            ) : <>
            <input value={phone} onChange={(e) => { setPhone(e.target.value); setOtpSent(false); }} inputMode="tel" autoComplete="tel" placeholder="+91 98xxxxxxxx" className="input h-14 text-lg" />
            {!otpSent ? (
              <button disabled={!num} onClick={() => setOtpSent(true)} className="btn-z">Send code</button>
            ) : (
              <>
                <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" aria-label="One-time code" className="input h-14 text-center font-mono text-2xl tracking-[0.4em]" />
                <p className="text-xs text-dim">Demo: any 6 digits work. Real SMS codes come from Privy.</p>
              </>
            )}
            </>}
          </Step>
        )}

        {step === 1 && (
          <Step icon={<StoreIcon />} title="Your shop" sub="This is what customers see first.">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Shop name, e.g. Ravi's Fresh Sabzi" className="input" />
            <input value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={80} placeholder="One line, e.g. Fresh from Nashik every morning" className="input" />
            <div className="flex flex-wrap gap-2">
              {(Object.keys(CATEGORIES) as Category[]).map((c) => <button key={c} onClick={() => setCat(c)} className={`pill ${cat === c ? 'pill-on' : ''}`}>{CATEGORIES[c].label}</button>)}
            </div>
          </Step>
        )}

        {step === 2 && (
          <Step icon={<MapPin />} title="Where’s your stall?" sub="Stand at your stall and tap the button. We only use it to put you on the map.">
            <button onClick={locate} disabled={locating} className="btn-line">{locating ? <Loader2 size={17} className="animate-spin" /> : <LocateFixed size={17} />} Use my location</button>
            {pos && <div className="rounded-2xl bg-raised p-3 font-mono text-sm">{pos.lat.toFixed(5)}, {pos.lng.toFixed(5)} <span className="text-dim">· {pos.src === 'gps' ? 'from your phone' : 'demo spot in Kalbadevi'}</span></div>}
            <input value={landmark} onChange={(e) => setLandmark(e.target.value)} maxLength={60} placeholder="Landmark, e.g. Outside Mumbadevi temple gate" className="input" />
            <div className="flex gap-2">
              <label className="flex flex-1 flex-col gap-1 text-xs text-mute">Opens<input type="time" value={from} onChange={(e) => setFrom(e.target.value)} className="input" /></label>
              <label className="flex flex-1 flex-col gap-1 text-xs text-mute">Closes<input type="time" value={to} onChange={(e) => setTo(e.target.value)} className="input" /></label>
            </div>
          </Step>
        )}

        {step === 3 && (
          <Step icon={<KeyRound />} title="Your payment wallet" sub="Zeeto makes a wallet tied to your phone number. Customers’ USDT lands here directly. No seed phrase, nothing to install.">
            <div className="panel flex items-center gap-3 p-4">
              {wallet ? <Check className="text-good" /> : <Loader2 className="animate-spin text-z" />}
              <div className="flex-1"><div className="font-semibold">{wallet ? 'Wallet ready' : 'Creating your wallet…'}</div><div className="font-mono text-sm text-mute">{wallet ? short(wallet) : '—'} · Whitechain</div></div>
            </div>
            <ul className="flex flex-col gap-2 text-sm text-mute">
              <li>• Only you can move money out. Zeeto can’t.</li>
              <li>• Refunds and withdrawals always ask you to confirm in the app.</li>
            </ul>
          </Step>
        )}

        {step === 4 && (
          <div className="a-up flex flex-col items-center gap-5 text-center">
            <PartyPopper size={40} className="text-z" />
            <h1 className="mega text-5xl">You’re live.</h1>
            <p className="text-mute">{name || demo.name} is on the Zeeto map. Print this QR for your stall.</p>
            <div className="rounded-3xl bg-chalk p-4"><QRCodeSVG value={`${location.origin}/p/${liveId ?? MY}`} size={180} bgColor="#FAF8F3" fgColor="#0A0A0A" /></div>
            {privy ? <p className="text-xs text-dim">Payments to this stall go to your wallet {short(session.address ?? '')}. Add your products next.</p> : <p className="text-xs text-dim">Demo: your shop uses the sample stall account so it has orders to show.</p>}
            <button onClick={() => nav(privy ? '/sell/products' : '/sell')} className="btn-z w-full">{privy ? 'Add my products' : 'Open my dashboard'}</button>
          </div>
        )}

        {step < 4 && (
          <button disabled={!can || saving} onClick={() => (step === 3 ? void finish() : setStep(step + 1))} className="btn-z py-4 text-base">
            {step === 3 ? 'Go live' : 'Continue'}
          </button>
        )}
      </div>
    </div>
  );
}

const Step = ({ icon, title, sub, children }: { icon: ReactNode; title: string; sub: string; children: ReactNode }) => (
  <section className="a-up flex flex-col gap-4">
    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-z-soft text-z">{icon}</span>
    <div><h1 className="text-3xl font-extrabold tracking-tight">{title}</h1><p className="mt-1 text-mute">{sub}</p></div>
    {children}
  </section>
);

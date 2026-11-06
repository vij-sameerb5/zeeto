import { Check, Delete, Minus, Plus, QrCode, Volume2, VolumeX, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { UNITS, inr, short, toUsd, type OrderLine } from '@zeeto/core';
import { Header, Pic, Sim } from '../../components/kit';
import { COUNTER_MAX_INR, useMyStallId, useApp, useVendor, type PayRequest } from '../../store';
import { api } from '../../lib/api';
import { isServerStall } from '../../lib/sync';

type Mode = 'amount' | 'items';

/** Speaks the amount like a UPI soundbox, so the stall doesn't have to look at the phone. */
function announce(amount: number, usdt: string) {
  try {
    const u = new SpeechSynthesisUtterance(`Zeeto par ${amount} rupaye mile. ${usdt} USDT.`);
    u.lang = 'hi-IN';
    u.rate = 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch { /* speech not available */ }
}

/** Pay at the counter: the customer asks for things in person, the stall rings it up, the customer scans and pays. */
export default function Collect() {
  const MY = useMyStallId();
  const v = useVendor(MY)!;
  const products = useApp((s) => s.products.filter((p) => p.vendorId === MY && p.stock > 0));
  const openRequest = useApp((s) => s.openRequest);
  const cancelRequest = useApp((s) => s.cancelRequest);
  const [mode, setMode] = useState<Mode>('amount');
  const [digits, setDigits] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [rid, setRid] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [sound, setSound] = useState(() => { try { return localStorage.getItem('zeeto-sound') !== 'off'; } catch { return true; } });
  const localReq = useApp((s) => (rid ? s.requests[rid] : undefined));
  const [remote, setRemote] = useState<PayRequest | null>(null);
  const live = isServerStall(MY);
  const req = localReq ?? (remote && remote.id === rid ? remote : undefined);
  // Real stall: the bill lives on the server; poll it so the "Paid" sound plays the moment the payment is verified.
  useEffect(() => {
    if (!live || !rid) return;
    let on = true;
    const t = setInterval(async () => {
      try {
        const r = await api<{ request: PayRequest }>(`/api/requests?id=${encodeURIComponent(rid)}`, { auth: false });
        if (on) setRemote(r.request);
        if (r.request.status !== 'open') clearInterval(t);
      } catch { /* keep trying */ }
    }, 2000);
    return () => { on = false; clearInterval(t); };
  }, [live, rid]);
  const [now, setNow] = useState(Date.now());
  const spoke = useRef<string | null>(null);

  const lines: OrderLine[] = useMemo(() => Object.entries(cart).map(([id, qty]) => {
    const p = products.find((x) => x.id === id)!;
    return { productId: id, name: p.name, unit: p.unit, qty, priceInr: p.priceInr };
  }).filter((l) => l.qty > 0), [cart, products]);
  const amount = mode === 'amount' ? Number(digits || 0) : lines.reduce((s, l) => s + l.qty * l.priceInr, 0);

  useEffect(() => { if (!rid) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [rid]);
  useEffect(() => {
    if (req?.status === 'paid' && spoke.current !== req.id) {
      spoke.current = req.id;
      if (sound) announce(req.inr, toUsd(req.inr).toFixed(2));
    }
  }, [req, sound]);

  const press = (k: string) => {
    setErr('');
    if (k === 'del') return setDigits((d) => d.slice(0, -1));
    setDigits((d) => {
      const next = (d + k).replace(/^0+/, '');
      return Number(next) > COUNTER_MAX_INR ? d : next.slice(0, 5);
    });
  };
  const show = async () => {
    if (live) {
      try {
        const r = await api<{ request: PayRequest }>('/api/requests', { body: { action: 'open', inr: amount, lines: mode === 'items' ? lines.map((l) => ({ name: l.name, unit: l.unit, qty: l.qty, priceInr: l.priceInr })) : [] } });
        setRemote(r.request); setRid(r.request.id); setErr('');
      } catch (e) { setErr((e as Error).message); }
      return;
    }
    try { setRid(openRequest(MY, amount, mode === 'items' ? lines : [], 'stall')); setErr(''); } catch (e) { setErr((e as Error).message); }
  };
  const reset = () => {
    if (rid && req?.status === 'open') {
      if (live) void api('/api/requests', { body: { action: 'cancel', id: rid } }).catch(() => undefined);
      else cancelRequest(rid);
    }
    setRid(null); setRemote(null); setDigits(''); setCart({});
  };
  const toggleSound = () => { const n = !sound; setSound(n); try { localStorage.setItem('zeeto-sound', n ? 'on' : 'off'); } catch { /* ignore */ } };

  const url = rid ? `${location.origin}/pay/r/${rid}` : '';
  const left = req ? Math.max(0, Date.parse(req.expiresAt) - now) : 0;
  const expired = req?.status === 'open' && left === 0;

  return (
    <div>
      <Header title="Collect payment" sub="Customer at your stall? Ring it up, they scan, done." right={
        <button onClick={toggleSound} aria-label={sound ? 'Turn off payment sound' : 'Turn on payment sound'} className="btn-line px-3 py-2 text-sm">{sound ? <Volume2 size={16} /> : <VolumeX size={16} />} {sound ? 'Sound on' : 'Sound off'}</button>
      } />

      {!rid && (
        <div className="gutter mx-auto grid max-w-5xl gap-6 pb-28 pt-6 md:grid-cols-[1fr_360px] md:pb-6">
          <section className="flex flex-col gap-4">
            <div className="flex rounded-full border border-line bg-panel p-1">
              {(['amount', 'items'] as Mode[]).map((m) => <button key={m} onClick={() => setMode(m)} className={`flex-1 rounded-full py-2.5 text-sm font-semibold ${mode === m ? 'bg-chalk text-bg' : 'text-mute'}`}>{m === 'amount' ? 'Type amount' : 'Tap items'}</button>)}
            </div>

            {mode === 'amount' ? (
              <div className="panel flex flex-col gap-4 p-5">
                <div className="text-center"><div className="label">Amount</div><div className="mega mt-2 text-7xl nums">₹{digits || '0'}</div><div className="mt-2 text-sm text-mute nums">≈ {toUsd(amount).toFixed(2)} USDT</div></div>
                <div className="grid grid-cols-3 gap-2">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'del'].map((k) => (
                    <button key={k} onClick={() => press(k)} aria-label={k === 'del' ? 'Delete' : k} className="grid h-16 place-items-center rounded-2xl bg-raised text-2xl font-bold transition active:scale-95 active:bg-z active:text-z-ink">{k === 'del' ? <Delete size={22} /> : k}</button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">{[20, 50, 100, 200, 500].map((q) => <button key={q} onClick={() => setDigits(String(q))} className="pill">₹{q}</button>)}</div>
              </div>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {products.map((p) => {
                  const n = cart[p.id] ?? 0;
                  return (
                    <li key={p.id} className={`panel overflow-hidden ${n ? 'border-z/60' : ''}`}>
                      <button onClick={() => setCart({ ...cart, [p.id]: Math.min(p.stock, n + 1) })} className="block w-full text-left">
                        <Pic media={p.image} className="aspect-[4/3] w-full" />
                        <div className="p-3"><div className="truncate text-sm font-semibold">{p.name}</div><div className="text-sm text-z nums">{inr(p.priceInr)}<span className="text-mute"> /{UNITS[p.unit]}</span></div></div>
                      </button>
                      {n > 0 && (
                        <div className="flex items-center justify-between border-t border-line px-2 py-1.5">
                          <button aria-label="Less" onClick={() => setCart({ ...cart, [p.id]: n - 1 })} className="grid h-8 w-8 place-items-center rounded-full bg-raised"><Minus size={14} /></button>
                          <b className="nums">{n}</b>
                          <button aria-label="More" onClick={() => setCart({ ...cart, [p.id]: Math.min(p.stock, n + 1) })} className="grid h-8 w-8 place-items-center rounded-full bg-raised"><Plus size={14} /></button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <aside className="flex flex-col gap-3 md:sticky md:top-24 md:self-start">
            <div className="panel flex flex-col gap-2 p-5">
              <div className="label">Bill</div>
              {mode === 'items' && lines.map((l) => <div key={l.productId} className="flex justify-between text-sm"><span>{l.qty} {UNITS[l.unit]} {l.name}</span><span className="nums">{inr(l.qty * l.priceInr)}</span></div>)}
              <div className="flex items-baseline justify-between border-t border-line pt-3"><span className="font-bold">Total</span><span className="text-3xl font-extrabold nums">{inr(amount)}</span></div>
              <div className="text-right text-sm text-mute nums">{toUsd(amount).toFixed(2)} USDT</div>
            </div>
            {err && <p className="text-sm text-bad">{err}</p>}
            <div className="fixed inset-x-0 bottom-[68px] z-30 border-t border-line bg-bg/95 p-3 backdrop-blur-xl md:static md:border-0 md:bg-transparent md:p-0">
              <button disabled={amount < 1} onClick={show} className="btn-z w-full py-4 text-base shadow-glow"><QrCode size={18} /> Show QR · {inr(amount)}</button>
            </div>
            <p className="text-xs text-dim">The QR is for this amount only, works once, and expires in 5 minutes. Up to {inr(COUNTER_MAX_INR)} per payment.</p>
          </aside>
        </div>
      )}

      {rid && req && req.status !== 'paid' && (
        <div className="gutter mx-auto flex max-w-md flex-col items-center gap-5 py-8 text-center">
          <div className="label">Ask the customer to scan</div>
          <div className={`rounded-[28px] bg-chalk p-5 ${expired ? 'opacity-30' : ''}`}><QRCodeSVG value={url} size={248} bgColor="#FAF8F3" fgColor="#0A0A0A" level="M" /></div>
          <div><div className="mega text-6xl nums">{inr(req.inr)}</div><div className="mt-2 text-mute nums">{toUsd(req.inr).toFixed(2)} USDT · {v.name}</div></div>
          {!expired ? (
            <div className="flex items-center gap-2 text-sm text-mute"><span className="relative flex h-2.5 w-2.5"><span className="absolute inset-0 animate-ping rounded-full bg-z" /><span className="relative h-2.5 w-2.5 rounded-full bg-z" /></span>Waiting for payment · {Math.floor(left / 60000)}:{String(Math.floor(left / 1000) % 60).padStart(2, '0')}</div>
          ) : <div className="text-sm text-bad">Expired. Make a new QR.</div>}
          <div className="flex w-full gap-2">
            <button onClick={reset} className="btn-line flex-1"><X size={16} /> Cancel</button>
            {!live && <a href={url} target="_blank" rel="noreferrer" className="btn-line flex-1 text-sm">Open as customer (demo)</a>}
          </div>
          {live
            ? <p className="text-xs text-dim">The customer scans with any phone camera, signs in and confirms. This screen turns green once the payment is verified on Whitechain.</p>
            : <><p className="text-xs text-dim">Demo without the backend: open the customer link in another tab of this browser. This screen turns green when it’s paid.</p><Sim /></>}
        </div>
      )}

      {rid && req?.status === 'paid' && (
        <div className="gutter mx-auto flex max-w-md flex-col items-center gap-5 py-10 text-center">
          <div className="a-up grid h-28 w-28 place-items-center rounded-full bg-good text-bg shadow-[0_0_60px_rgba(61,214,140,.55)]"><Check size={60} strokeWidth={3} /></div>
          <div className="a-up"><div className="label text-good">Received</div><div className="mega mt-2 text-7xl nums">{inr(req.inr)}</div><div className="mt-2 font-mono text-mute">{toUsd(req.inr).toFixed(2)} USDT{req.payer ? ` · from ${req.payer}` : ''}</div></div>
          <p className="text-sm text-mute">Already in your wallet {short(v.wallet)}. Hand over the goods.</p>
          <button onClick={reset} className="btn-z w-full py-4 text-base">Next customer</button>
          {!live && <Sim />}
        </div>
      )}
    </div>
  );
}

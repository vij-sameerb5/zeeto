import { Camera, Loader2, Mic, Minus, Plus, Sparkles, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UNITS, inr, type AiDraft, type Unit } from '@zeeto/core';
import { Header, Modal, Pic, Sim } from '../../components/kit';
import { photoToDataUrl } from '../../lib/upload';
import { snapDraft, voiceDraft } from '../../lib/ai';
import { useMyStallId, useApp } from '../../store';

const clampPrice = (n: number) => Math.max(1, Math.min(100000, Math.round(n)));

export default function Products() {
  const MY = useMyStallId();
  const [q, setQ] = useSearchParams();
  const products = useApp((s) => s.products.filter((p) => p.vendorId === MY));
  const setPrice = useApp((s) => s.setPrice);
  const setStock = useApp((s) => s.setStock);
  const [snap, setSnap] = useState(q.get('snap') === '1');
  const [add, setAdd] = useState(false);

  return (
    <div>
      <Header title="Products" sub={`${products.length} listed · prices in ₹, paid in USDT`} right={
        <div className="flex gap-2">
          <button onClick={() => setAdd(true)} className="btn-line px-4 py-2 text-sm"><Plus size={16} /> Add</button>
          <button onClick={() => setSnap(true)} className="btn-z px-4 py-2 text-sm"><Camera size={16} /> Snap & Sell</button>
        </div>
      } />
      <div className="gutter mx-auto flex max-w-4xl flex-col gap-3 py-6">
        {products.map((p) => (
          <div key={p.id} className={`panel flex flex-wrap items-center gap-3 p-3 ${p.stock <= 0 ? 'opacity-70' : ''}`}>
            <Pic media={p.image} className="h-16 w-16 rounded-xl" />
            <div className="min-w-[140px] flex-1">
              <div className="flex items-center gap-2 font-semibold">{p.name}{p.byAi && <span className="rounded-full bg-z-soft px-2 py-0.5 text-[10px] font-bold text-z">AI</span>}</div>
              <div className="text-xs text-dim">{p.local ?? `per ${UNITS[p.unit]}`}</div>
            </div>
            <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
            <label className="flex items-center gap-1 rounded-xl border border-line bg-raised px-3 py-2 text-sm">
              ₹<input key={p.priceInr} defaultValue={p.priceInr} inputMode="numeric" aria-label={`${p.name} price`} onBlur={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n > 0) setPrice(p.id, clampPrice(n)); else e.target.value = String(p.priceInr); }} className="w-12 bg-transparent font-bold outline-none nums" />
              <span className="whitespace-nowrap text-dim">/{UNITS[p.unit]}</span>
            </label>
            <div className="flex items-center rounded-full border border-line bg-raised">
              <button aria-label="Less stock" onClick={() => setStock(p.id, p.stock - 1)} className="grid h-9 w-9 place-items-center"><Minus size={15} /></button>
              <span className="w-10 text-center text-sm font-bold nums">{p.stock}</span>
              <button aria-label="More stock" onClick={() => setStock(p.id, p.stock + 1)} className="grid h-9 w-9 place-items-center"><Plus size={15} /></button>
            </div>
            <button onClick={() => setStock(p.id, p.stock > 0 ? 0 : 10)} className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold ${p.stock > 0 ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad'}`}>{p.stock > 0 ? 'In stock' : 'Sold out'}</button>
            </div>
          </div>
        ))}
      </div>
      <SnapSell open={snap} onClose={() => { setSnap(false); if (q.get('snap')) setQ({}, { replace: true }); }} />
      <AddProduct open={add} onClose={() => setAdd(false)} />
    </div>
  );
}

/** Photo or a sentence → AI draft → seller edits → publish. AI never publishes on its own. */
function SnapSell({ open, onClose }: { open: boolean; onClose: () => void }) {
  const MY = useMyStallId();
  const publish = useApp((s) => s.publish);
  const say = useApp((s) => s.say);
  const file = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [d, setD] = useState<AiDraft | null>(null);
  useEffect(() => { if (!open) { setPhoto(null); setD(null); setText(''); setErr(''); } }, [open]);

  const fromPhoto = async (f?: File) => {
    if (!f) return;
    setErr('');
    try {
      const url = await photoToDataUrl(f);
      setPhoto(url);
      setBusy(true);
      setD(await snapDraft(url));
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const fromText = async () => {
    if (!text.trim()) return;
    setBusy(true); setErr('');
    try { setD(await voiceDraft(text.trim().slice(0, 200))); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const edit = (i: number, k: 'priceInr' | 'qty', v: string) => d && setD({ ...d, items: d.items.map((it, j) => (j === i ? { ...it, [k]: Math.max(0, Math.min(100000, Number(v.replace(/\D/g, '')) || 0)) } : it)) });
  const ok = d?.items.every((it) => it.priceInr > 0 && it.qty > 0);

  return (
    <Modal open={open} onClose={onClose} title="Snap & Sell">
      <div className="flex flex-col gap-4">
        {!d && !busy && (
          <>
            <p className="text-sm text-mute">Take a photo of your stock, or just say what came in. AI writes the listing and a note for followers. You check the price before it goes live.</p>
            <input ref={file} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => fromPhoto(e.target.files?.[0])} />
            <button onClick={() => file.current?.click()} className="flex h-40 flex-col items-center justify-center gap-2 rounded-[22px] border-2 border-dashed border-line-2 bg-raised hover:border-z/60">
              <Upload className="text-z" /><span className="font-semibold">Take or upload a photo</span><span className="text-xs text-dim">JPG / PNG, up to 12 MB</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-raised text-mute"><Mic size={18} /></span>
              <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fromText()} placeholder="“20 kilo tamatar, 30 rupaye”" className="h-11 flex-1 rounded-full border border-line bg-raised px-4 text-sm outline-none focus:border-z" maxLength={200} />
              <button onClick={fromText} disabled={!text.trim()} className="btn-z px-4 py-2.5 text-sm">Go</button>
            </div>
            {err && <p className="text-sm text-bad">{err}</p>}
          </>
        )}
        {photo && <img src={photo} alt="Your stock" className="aspect-[4/3] w-full rounded-2xl object-cover" />}
        {busy && <div className="flex items-center gap-3 rounded-2xl bg-raised p-4"><Loader2 className="animate-spin text-z" /> Reading it…</div>}
        {d && (
          <div className="flex flex-col gap-3 rounded-[22px] border border-z/40 p-4">
            <div className="flex items-center justify-between"><span className="label flex items-center gap-1.5 text-z"><Sparkles size={14} /> AI draft · check it</span>{d.run.simulated && <Sim label="AI mocked" />}</div>
            {d.items.map((it, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="font-bold">{it.name} {it.local && <span className="font-normal text-dim">{it.local}</span>} <span className="text-xs font-normal text-mute">· {Math.round(it.confidence * 100)}% sure</span></div>
                <div className="flex gap-2">
                  <label className="flex flex-1 items-center gap-1 rounded-xl border border-line bg-raised px-3 py-2 text-sm">₹<input value={it.priceInr} onChange={(e) => edit(i, 'priceInr', e.target.value)} inputMode="numeric" className="w-full bg-transparent font-bold outline-none" /><span className="text-dim">/{UNITS[it.unit]}</span></label>
                  <label className="flex flex-1 items-center gap-1 rounded-xl border border-line bg-raised px-3 py-2 text-sm">Qty<input value={it.qty} onChange={(e) => edit(i, 'qty', e.target.value)} inputMode="numeric" className="w-full bg-transparent text-right font-bold outline-none" /></label>
                </div>
              </div>
            ))}
            <div className="rounded-2xl bg-raised p-3 text-sm">
              <div className="label mb-1">Note to followers</div>
              <b>{d.alert.title}</b><p className="text-mute">{d.alert.body}</p>
              {Object.entries(d.alert.translations).map(([l, t]) => <p key={l} className="mt-1 text-xs text-mute"><span className="text-dim">{l}:</span> {t}</p>)}
            </div>
            <div className="font-mono text-[10px] text-dim">{d.run.model} · {d.run.requestId} · {d.run.ms} ms</div>
            <div className="flex gap-2">
              <button onClick={() => { setD(null); setPhoto(null); }} className="btn-line">Start over</button>
              <button disabled={!ok} onClick={() => { publish(MY, d, photo ?? undefined); say('Published. Followers will see it on your stall.'); onClose(); }} className="btn-z flex-1">Publish</button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function AddProduct({ open, onClose }: { open: boolean; onClose: () => void }) {
  const MY = useMyStallId();
  const addProduct = useApp((s) => s.addProduct);
  const say = useApp((s) => s.say);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<Unit>('kg');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('10');
  const [photo, setPhoto] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const valid = name.trim().length >= 2 && Number(price) > 0 && Number(price) <= 100000 && Number(stock) >= 0;

  const save = () => {
    if (!valid) return;
    addProduct({ vendorId: MY, name: name.trim().slice(0, 60), unit, priceInr: clampPrice(Number(price)), stock: Math.min(10000, Math.floor(Number(stock))), image: photo ?? 'veg-1' });
    say(`${name.trim()} added at ${inr(Number(price))}/${UNITS[unit]}`);
    setName(''); setPrice(''); setStock('10'); setPhoto(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Add a product">
      <div className="flex flex-col gap-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Tomatoes" maxLength={60} className="h-12 rounded-xl border border-line bg-raised px-4 outline-none focus:border-z" />
        <div className="flex gap-2">
          <input value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="Price ₹" className="h-12 w-1/3 rounded-xl border border-line bg-raised px-4 outline-none focus:border-z" />
          <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)} className="h-12 flex-1 rounded-xl border border-line bg-raised px-3 outline-none">
            {(Object.keys(UNITS) as Unit[]).map((u) => <option key={u} value={u}>per {UNITS[u]}</option>)}
          </select>
          <input value={stock} onChange={(e) => setStock(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="Stock" aria-label="Stock" className="h-12 w-1/4 rounded-xl border border-line bg-raised px-4 outline-none focus:border-z" />
        </div>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line-2 p-3 text-sm text-mute hover:border-z/60">
          {photo ? <img src={photo} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <Upload size={18} className="text-z" />}
          {photo ? 'Change photo' : 'Add a photo (optional)'}
          <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { setPhoto(await photoToDataUrl(f)); setErr(''); } catch (x) { setErr((x as Error).message); } }} />
        </label>
        {err && <p className="text-sm text-bad">{err}</p>}
        <button disabled={!valid} onClick={save} className="btn-z">Add to my stall</button>
      </div>
    </Modal>
  );
}

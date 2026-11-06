import { ArrowDownUp, Camera, Loader2, Mic, Minus, Pencil, Plus, Search, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UNITS, inr, type AiDraft, type Product, type Unit } from '@zeeto/core';
import { Header, Modal, Pic, Sim } from '../../components/kit';
import { photoToDataUrl } from '../../lib/upload';
import { AiOff, aiOn, snapDraft, voiceDraft } from '../../lib/ai';
import { isDemoStall, useMyStallId, useApp } from '../../store';

const clampPrice = (n: number) => Math.max(1, Math.min(100000, Math.round(n)));
const UNIT_LIST = Object.keys(UNITS) as Unit[];
type Sort = 'name' | 'price' | 'stock';

/** Your menu / stock list. Every field is editable; changes save to the server within a second. */
export default function Products() {
  const MY = useMyStallId();
  const [q, setQ] = useSearchParams();
  const all = useApp((s) => s.products);
  const products = useMemo(() => all.filter((p) => p.vendorId === MY), [all, MY]);
  const setStock = useApp((s) => s.setStock);
  const updateProduct = useApp((s) => s.updateProduct);
  const [snap, setSnap] = useState(q.get('snap') === '1');
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [find, setFind] = useState('');
  const [sort, setSort] = useState<Sort>('name');
  const [show, setShow] = useState<'all' | 'in' | 'out'>('all');

  const list = useMemo(() => {
    const f = find.trim().toLowerCase();
    return products
      .filter((p) => (!f || `${p.name} ${p.local ?? ''}`.toLowerCase().includes(f)) && (show === 'all' || (show === 'in' ? p.stock > 0 : p.stock <= 0)))
      .sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : sort === 'price' ? b.priceInr - a.priceInr : a.stock - b.stock));
  }, [products, find, sort, show]);
  const worth = products.reduce((s, p) => s + p.priceInr * p.stock, 0);

  return (
    <div>
      <Header title="Products" sub={`${products.length} listed · ${products.filter((p) => p.stock <= 0).length} sold out · stock worth ${inr(worth)}`} right={
        <div className="flex gap-2">
          <button onClick={() => setEditing('new')} className="btn-line px-4 py-2 text-sm"><Plus size={16} /> Add</button>
          <button onClick={() => setSnap(true)} className="btn-z px-4 py-2 text-sm"><Camera size={16} /> Snap & Sell</button>
        </div>
      } />
      <div className="gutter mx-auto flex max-w-4xl flex-col gap-3 py-6">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-11 min-w-[200px] flex-1 items-center gap-2 rounded-full border border-line bg-raised px-4 text-sm focus-within:border-z">
            <Search size={16} className="text-dim" /><input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a product" className="w-full bg-transparent outline-none" aria-label="Find a product" />
          </label>
          {(['all', 'in', 'out'] as const).map((k) => (
            <button key={k} onClick={() => setShow(k)} className={`pill ${show === k ? 'border-z bg-z-soft text-z' : ''}`}>{k === 'all' ? 'All' : k === 'in' ? 'In stock' : 'Sold out'}</button>
          ))}
          <button onClick={() => setSort(sort === 'name' ? 'price' : sort === 'price' ? 'stock' : 'name')} className="pill"><ArrowDownUp size={14} /> {sort === 'name' ? 'A–Z' : sort === 'price' ? 'Price' : 'Low stock'}</button>
        </div>

        {!products.length && (
          <div className="panel flex flex-col items-center gap-3 p-10 text-center">
            <Sparkles className="text-z" />
            <div className="text-lg font-bold">Add your first product</div>
            <p className="max-w-sm text-sm text-mute">Snap a photo of your stall or type “tacos 350 rupees, 20 plates”. You check every price before it goes live.</p>
            <div className="flex gap-2"><button onClick={() => setSnap(true)} className="btn-z px-4 py-2 text-sm"><Camera size={16} /> Snap & Sell</button><button onClick={() => setEditing('new')} className="btn-line px-4 py-2 text-sm">Add by hand</button></div>
          </div>
        )}

        {list.map((p) => (
          <div key={p.id} className={`panel group flex flex-wrap items-center gap-3 p-3 transition hover:border-line-2 ${p.stock <= 0 ? 'opacity-70' : ''}`}>
            <button onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`} className="relative"><Pic media={p.image} className="h-16 w-16 rounded-xl" /><span className="absolute inset-0 grid place-items-center rounded-xl bg-black/50 opacity-0 transition group-hover:opacity-100"><Pencil size={16} /></span></button>
            <button onClick={() => setEditing(p)} className="min-w-[140px] flex-1 text-left">
              <div className="flex items-center gap-2 font-semibold">{p.name}{p.byAi && <span className="rounded-full bg-z-soft px-2 py-0.5 text-[10px] font-bold text-z">AI</span>}</div>
              <div className="text-xs text-dim">{p.local ? `${p.local} · ` : ''}per {UNITS[p.unit]} · tap to edit</div>
            </button>
            <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
              <label className="flex items-center gap-1 rounded-xl border border-line bg-raised px-3 py-2 text-sm focus-within:border-z">
                ₹<input key={p.priceInr} defaultValue={p.priceInr} inputMode="numeric" aria-label={`${p.name} price`} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} onBlur={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n > 0) updateProduct(p.id, { priceInr: clampPrice(n) }); else e.target.value = String(p.priceInr); }} className="w-14 bg-transparent font-bold outline-none nums" />
                <span className="whitespace-nowrap text-dim">/{UNITS[p.unit]}</span>
              </label>
              <div className="flex items-center rounded-full border border-line bg-raised">
                <button aria-label="Less stock" onClick={() => setStock(p.id, p.stock - 1)} className="grid h-9 w-9 place-items-center"><Minus size={15} /></button>
                <input key={p.stock} defaultValue={p.stock} inputMode="numeric" aria-label={`${p.name} stock`} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} onBlur={(e) => { const n = Math.floor(Number(e.target.value)); if (Number.isFinite(n) && n >= 0) setStock(p.id, n); else e.target.value = String(p.stock); }} className="w-12 bg-transparent text-center text-sm font-bold outline-none nums" />
                <button aria-label="More stock" onClick={() => setStock(p.id, p.stock + 1)} className="grid h-9 w-9 place-items-center"><Plus size={15} /></button>
              </div>
              <button onClick={() => setStock(p.id, p.stock > 0 ? 0 : 10)} className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold ${p.stock > 0 ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad'}`}>{p.stock > 0 ? 'In stock' : 'Sold out'}</button>
            </div>
          </div>
        ))}
        {!!products.length && !list.length && <p className="py-8 text-center text-mute">Nothing matches “{find}”.</p>}
      </div>
      <SnapSell open={snap} onClose={() => { setSnap(false); if (q.get('snap')) setQ({}, { replace: true }); }} />
      <ProductForm product={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

/** Add or edit one product: name, local name, unit, price, stock, photo. Delete asks once, on the page. */
function ProductForm({ product, onClose }: { product: Product | 'new' | null; onClose: () => void }) {
  const MY = useMyStallId();
  const addProduct = useApp((s) => s.addProduct);
  const updateProduct = useApp((s) => s.updateProduct);
  const removeProduct = useApp((s) => s.removeProduct);
  const say = useApp((s) => s.say);
  const editing = product && product !== 'new' ? product : null;
  const [name, setName] = useState('');
  const [local, setLocal] = useState('');
  const [unit, setUnit] = useState<Unit>('piece');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('10');
  const [photo, setPhoto] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (!product) return;
    setName(editing?.name ?? ''); setLocal(editing?.local ?? ''); setUnit(editing?.unit ?? 'piece');
    setPrice(editing ? String(editing.priceInr) : ''); setStock(editing ? String(editing.stock) : '10'); setPhoto(editing?.image ?? null); setErr(''); setConfirm(false);
  }, [product]); // eslint-disable-line react-hooks/exhaustive-deps

  const valid = name.trim().length >= 2 && Number(price) > 0 && Number(price) <= 100000 && Number(stock) >= 0 && Number(stock) <= 10000;
  const save = () => {
    if (!valid) return;
    const fields = { name: name.trim().slice(0, 60), local: local.trim().slice(0, 40) || undefined, unit, priceInr: clampPrice(Number(price)), stock: Math.floor(Number(stock)), image: photo ?? 'veg-1' };
    if (editing) { updateProduct(editing.id, fields); say(`${fields.name} saved`); }
    else { addProduct({ vendorId: MY, ...fields }); say(`${fields.name} added at ${inr(fields.priceInr)}/${UNITS[unit]}`); }
    onClose();
  };

  return (
    <Modal open={!!product} onClose={onClose} title={editing ? 'Edit product' : 'Add a product'}>
      <div className="flex flex-col gap-3">
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-line-2 p-3 text-sm text-mute hover:border-z/60">
          {photo ? <Pic media={photo} className="h-16 w-16 rounded-xl" /> : <span className="grid h-16 w-16 place-items-center rounded-xl bg-raised"><Upload size={18} className="text-z" /></span>}
          <span>{photo ? 'Change photo' : 'Add a photo'}<br /><span className="text-xs text-dim">JPG or PNG. We shrink it for you.</span></span>
          <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { setPhoto(await photoToDataUrl(f)); setErr(''); } catch (x) { setErr((x as Error).message); } }} />
        </label>
        <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chicken tacos" maxLength={60} className="input" /></Field>
        <Field label="Local name (optional)"><input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="e.g. टमाटर" maxLength={40} className="input" /></Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Price ₹"><input value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="input" /></Field>
          <Field label="Per"><select value={unit} onChange={(e) => setUnit(e.target.value as Unit)} className="input">{UNIT_LIST.map((u) => <option key={u} value={u}>{UNITS[u]}</option>)}</select></Field>
          <Field label="In stock"><input value={stock} onChange={(e) => setStock(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="input" /></Field>
        </div>
        {err && <p className="text-sm text-bad">{err}</p>}
        <button disabled={!valid} onClick={save} className="btn-z">{editing ? 'Save changes' : 'Add to my stall'}</button>
        {editing && (confirm ? (
          <div className="flex items-center gap-2 rounded-2xl bg-bad-soft p-3 text-sm">
            <span className="flex-1">Remove {editing.name} from your stall? Past orders keep it.</span>
            <button onClick={() => setConfirm(false)} className="btn-line px-3 py-1.5 text-xs">Keep</button>
            <button onClick={() => { removeProduct(editing.id); say(`${editing.name} removed`); onClose(); }} className="rounded-full bg-bad px-3 py-1.5 text-xs font-bold text-bg">Remove</button>
          </div>
        ) : <button onClick={() => setConfirm(true)} className="flex items-center justify-center gap-2 py-2 text-sm text-bad"><Trash2 size={15} /> Remove product</button>)}
      </div>
    </Modal>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="flex flex-col gap-1 text-xs text-mute">{label}{children}</label>
);

type Item = AiDraft['items'][number];

/** Photo or a sentence → draft → the stall edits every line (or adds/removes lines) → publish. AI never publishes on its own. */
function SnapSell({ open, onClose }: { open: boolean; onClose: () => void }) {
  const MY = useMyStallId();
  const sample = isDemoStall(MY);
  const publish = useApp((s) => s.publish);
  const say = useApp((s) => s.say);
  const file = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [d, setD] = useState<AiDraft | null>(null);
  useEffect(() => { if (!open) { setPhoto(null); setD(null); setText(''); setErr(''); } }, [open]);

  const run = async (f: () => Promise<AiDraft>) => {
    setBusy(true); setErr('');
    try {
      const r = await f();
      setD(r.items.length ? r : { ...r, items: [{ name: '', unit: 'piece', priceInr: 0, qty: 10, confidence: 1 }] });
      if (!r.items.length) setErr('I couldn’t find items in that. Fill the line below, or try again.');
    } catch (e) { setErr((e as Error).message); if (!(e instanceof AiOff)) setPhoto(null); } finally { setBusy(false); }
  };
  const fromPhoto = async (f?: File) => {
    if (!f) return;
    try { const url = await photoToDataUrl(f); setPhoto(url); await run(() => snapDraft(url, sample)); } catch (e) { setErr((e as Error).message); }
  };
  const fromText = () => text.trim() && run(() => voiceDraft(text.trim().slice(0, 300), sample));

  const set = (i: number, patch: Partial<Item>) => d && setD({ ...d, items: d.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  const num = (v: string) => Math.max(0, Math.min(100000, Number(v.replace(/\D/g, '')) || 0));
  const ok = !!d && d.items.length > 0 && d.items.every((it) => it.name.trim().length >= 2 && it.priceInr > 0 && it.qty > 0);

  return (
    <Modal open={open} onClose={onClose} title="Snap & Sell">
      <div className="flex flex-col gap-4">
        {!d && !busy && (
          <>
            <p className="text-sm text-mute">Take a photo of your stock, or type what you have. {aiOn() ? 'Gemini writes the listing and a note for followers.' : ''} You check and edit everything before it goes live.</p>
            <input ref={file} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => fromPhoto(e.target.files?.[0])} />
            <button onClick={() => file.current?.click()} className="flex h-36 flex-col items-center justify-center gap-2 rounded-[22px] border-2 border-dashed border-line-2 bg-raised hover:border-z/60">
              <Upload className="text-z" /><span className="font-semibold">Take or upload a photo</span><span className="text-xs text-dim">{aiOn() ? 'JPG / PNG, up to 12 MB' : sample ? 'Sample stall: shows an example draft' : 'Needs the AI key on the server'}</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-raised text-mute"><Mic size={18} /></span>
              <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fromText()} placeholder="“tacos 350 rupees, 20 plates; chai 15”" className="h-11 flex-1 rounded-full border border-line bg-raised px-4 text-sm outline-none focus:border-z" maxLength={300} />
              <button onClick={fromText} disabled={!text.trim()} className="btn-z px-4 py-2.5 text-sm">Go</button>
            </div>
            {err && <p className="rounded-2xl bg-bad-soft p-3 text-sm text-bad">{err}</p>}
          </>
        )}
        {photo && <img src={photo} alt="Your stock" className="aspect-[16/9] w-full rounded-2xl object-cover" />}
        {busy && <div className="flex items-center gap-3 rounded-2xl bg-raised p-4"><Loader2 className="animate-spin text-z" /> Reading it…</div>}
        {d && (
          <div className="flex flex-col gap-3 rounded-[22px] border border-z/40 p-4">
            <div className="flex items-center justify-between"><span className="label flex items-center gap-1.5 text-z"><Sparkles size={14} /> Draft · edit anything</span>{d.run.simulated && <Sim label="Sample AI" />}</div>
            {err && <p className="text-sm text-warn">{err}</p>}
            {d.items.map((it, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-2xl bg-raised/60 p-3">
                <div className="flex items-center gap-2">
                  <input value={it.name} onChange={(e) => set(i, { name: e.target.value.slice(0, 60) })} placeholder="Item name" aria-label="Item name" className="h-10 flex-1 rounded-xl border border-line bg-raised px-3 font-bold outline-none focus:border-z" />
                  <button onClick={() => setD({ ...d, items: d.items.filter((_, j) => j !== i) })} aria-label="Remove line" className="grid h-10 w-10 place-items-center rounded-xl text-dim hover:text-bad"><X size={16} /></button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <label className="flex items-center gap-1 rounded-xl border border-line bg-raised px-3 py-2 text-sm focus-within:border-z">₹<input value={it.priceInr || ''} onChange={(e) => set(i, { priceInr: num(e.target.value) })} inputMode="numeric" aria-label="Price" className="w-full bg-transparent font-bold outline-none" /></label>
                  <select value={it.unit} onChange={(e) => set(i, { unit: e.target.value as Unit })} aria-label="Unit" className="rounded-xl border border-line bg-raised px-2 text-sm outline-none">{UNIT_LIST.map((u) => <option key={u} value={u}>per {UNITS[u]}</option>)}</select>
                  <label className="flex items-center gap-1 rounded-xl border border-line bg-raised px-3 py-2 text-sm focus-within:border-z">Qty<input value={it.qty || ''} onChange={(e) => set(i, { qty: Math.min(10000, num(e.target.value)) })} inputMode="numeric" aria-label="Quantity" className="w-full bg-transparent text-right font-bold outline-none" /></label>
                </div>
              </div>
            ))}
            <button onClick={() => setD({ ...d, items: [...d.items, { name: '', unit: 'piece', priceInr: 0, qty: 10, confidence: 1 }] })} className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-line-2 py-2.5 text-sm text-mute hover:border-z/60"><Plus size={15} /> Add a line</button>
            <div className="flex flex-col gap-2 rounded-2xl bg-raised p-3 text-sm">
              <div className="label">Note to followers (optional)</div>
              <input value={d.alert.title} onChange={(e) => setD({ ...d, alert: { ...d.alert, title: e.target.value.slice(0, 60) } })} placeholder="Title" className="h-10 rounded-xl border border-line bg-panel px-3 font-bold outline-none focus:border-z" />
              <textarea value={d.alert.body} onChange={(e) => setD({ ...d, alert: { ...d.alert, body: e.target.value.slice(0, 200) } })} rows={2} placeholder="What’s fresh today" className="rounded-xl border border-line bg-panel px-3 py-2 outline-none focus:border-z" />
              {Object.entries(d.alert.translations).filter(([, t]) => t).map(([l, t]) => <p key={l} className="text-xs text-mute"><span className="text-dim">{l}:</span> {t}</p>)}
            </div>
            <div className="font-mono text-[10px] text-dim">{d.run.model} · {d.run.ms} ms</div>
            <div className="flex gap-2">
              <button onClick={() => { setD(null); setPhoto(null); setErr(''); }} className="btn-line">Start over</button>
              <button disabled={!ok} onClick={() => { publish(MY, { ...d, items: d.items.map((it) => ({ ...it, name: it.name.trim() })) }, photo ?? undefined); say(`Published ${d.items.length} item${d.items.length > 1 ? 's' : ''}.`); onClose(); }} className="btn-z flex-1">Publish {d.items.length} item{d.items.length === 1 ? '' : 's'}</button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

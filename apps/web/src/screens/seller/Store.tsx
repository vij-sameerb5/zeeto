import { Clock, Download, ImagePlus, MapPin, MessageCircle, Power, Trash2, Wallet, Youtube } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CATEGORIES, short } from '@zeeto/core';
import { Face, Header, Pic, Sim } from '../../components/kit';
import { indianMobile, photoToDataUrl, youtubeId } from '../../lib/upload';
import { useMyStallId, useApp, useVendor } from '../../store';

export default function Store() {
  const MY = useMyStallId();
  const v = useVendor(MY)!;
  const e = useApp((s) => s.edits[MY] ?? {});
  const edit = useApp((s) => s.editProfile);
  const say = useApp((s) => s.say);
  const qr = useRef<HTMLDivElement>(null);
  const [yt, setYt] = useState('');
  const [wa, setWa] = useState(e.waPhone ?? '');
  const [err, setErr] = useState('');
  const open = e.open ?? true;
  const [from, to] = v.hours.split('-');
  // Printed QR = pay this stall: customer types the amount at the counter, or taps "order ahead".
  const url = `${location.origin}/p/${v.id}`;

  const pick = async (f: File | undefined, then: (d: string) => void) => {
    if (!f) return;
    try { then(await photoToDataUrl(f)); setErr(''); } catch (x) { setErr((x as Error).message); }
  };
  const downloadQr = () => {
    const c = qr.current?.querySelector('canvas');
    if (!c) return;
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = `zeeto-${v.id}-qr.png`;
    a.click();
  };

  return (
    <div>
      <Header title="Store" sub="How customers see you" right={<Link to={`/s/${v.id}`} className="btn-line px-4 py-2 text-sm">View my stall</Link>} />
      <div className="gutter mx-auto grid max-w-5xl gap-6 py-6 md:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-5">
          <button onClick={() => { edit(MY, { open: !open }); say(open ? 'Closed. You’re hidden from the map until you open again.' : 'Open. You’re back on the map.'); }} className={`flex items-center gap-4 rounded-[22px] border p-4 text-left ${open ? 'border-good/40 bg-good-soft' : 'border-line bg-panel'}`}>
            <Power className={open ? 'text-good' : 'text-dim'} />
            <div className="flex-1"><div className="font-bold">{open ? 'Open now' : 'Closed'}</div><div className="text-sm text-mute">{open ? 'Customers can order for pickup.' : 'Orders are paused.'}</div></div>
            <span className={`h-7 w-12 rounded-full p-1 transition ${open ? 'bg-good' : 'bg-raised'}`}><span className={`block h-5 w-5 rounded-full bg-chalk transition ${open ? 'translate-x-5' : ''}`} /></span>
          </button>

          <Card title="Photos" icon={<ImagePlus size={16} />}>
            <div className="relative overflow-hidden rounded-2xl">
              <Pic media={v.cover} className="h-36 w-full" />
              <label className="frost absolute right-2 top-2 cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold">Change cover<input type="file" accept="image/*" className="hidden" onChange={(x) => pick(x.target.files?.[0], (d) => edit(MY, { cover: d }))} /></label>
              <label className="absolute -bottom-0 left-3 cursor-pointer"><Face media={v.avatar} size={72} ring /><input type="file" accept="image/*" className="hidden" onChange={(x) => pick(x.target.files?.[0], (d) => edit(MY, { avatar: d }))} /></label>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border border-dashed border-line-2 text-z hover:border-z/60"><ImagePlus size={20} /><input type="file" accept="image/*" className="hidden" onChange={(x) => pick(x.target.files?.[0], (d) => edit(MY, { photos: [d, ...(e.photos ?? [])].slice(0, 8) }))} /></label>
              {(e.photos ?? []).map((p, i) => (
                <div key={i} className="relative"><Pic media={p} className="aspect-square w-full rounded-xl" /><button aria-label="Remove photo" onClick={() => edit(MY, { photos: (e.photos ?? []).filter((_, j) => j !== i) })} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/70"><Trash2 size={12} /></button></div>
              ))}
              {v.photos.slice((e.photos ?? []).length, (e.photos ?? []).length + 3).map((p, i) => <Pic key={i} media={p} className="aspect-square w-full rounded-xl opacity-70" />)}
            </div>
            {err && <p className="text-sm text-bad">{err}</p>}
          </Card>

          <Card title="About your stall">
            <Field label="Stall name"><input defaultValue={v.name} maxLength={40} onBlur={(x) => x.target.value.trim().length >= 2 && edit(MY, { name: x.target.value.trim() })} className="input" /></Field>
            <Field label="One line"><input defaultValue={v.tagline} maxLength={80} onBlur={(x) => edit(MY, { tagline: x.target.value.trim() })} className="input" /></Field>
            <Field label="Your story"><textarea defaultValue={v.bio} maxLength={400} rows={3} onBlur={(x) => edit(MY, { bio: x.target.value.trim() })} className="input py-3" /></Field>
            <div className="text-xs text-dim">{CATEGORIES[v.category].label} · saved when you click away</div>
          </Card>

          <Card title="Hours & location" icon={<Clock size={16} />}>
            <div className="flex gap-2">
              <Field label="Opens"><input type="time" defaultValue={from} onBlur={(x) => edit(MY, { hours: `${x.target.value}-${to}` })} className="input" /></Field>
              <Field label="Closes"><input type="time" defaultValue={to} onBlur={(x) => edit(MY, { hours: `${from}-${x.target.value}` })} className="input" /></Field>
            </div>
            <Field label="Landmark"><input defaultValue={v.landmark} maxLength={60} onBlur={(x) => edit(MY, { landmark: x.target.value.trim() })} className="input" /></Field>
            <div className="flex items-center gap-2 text-sm text-mute"><MapPin size={15} className="text-z" /> {v.location.lat.toFixed(5)}, {v.location.lng.toFixed(5)} · pin moves with Mapbox onboarding</div>
          </Card>

          <Card title="Videos" icon={<Youtube size={16} />}>
            <div className="flex gap-2">
              <input value={yt} onChange={(x) => setYt(x.target.value)} placeholder="Paste a YouTube link" className="input flex-1" />
              <button onClick={() => { const id = youtubeId(yt); if (!id) return say('That isn’t a YouTube link'); edit(MY, { youtube: [id, ...(e.youtube ?? [])].slice(0, 6) }); setYt(''); say('Video added to your stall'); }} className="btn-z px-4 text-sm">Add</button>
            </div>
            <div className="text-xs text-dim">{v.youtube.length} linked. Only youtube.com / youtu.be links are accepted.</div>
          </Card>

          <Card title="WhatsApp assistant" icon={<MessageCircle size={16} />}>
            <p className="text-sm text-mute">Get order alerts and update stock by message: “20 kg tomatoes at 30”.</p>
            <div className="flex gap-2">
              <input value={wa} onChange={(x) => setWa(x.target.value)} inputMode="tel" placeholder="+91 98xxxxxxxx" className="input flex-1" />
              <button onClick={() => { const n = indianMobile(wa); if (!n) return say('Enter a 10-digit Indian mobile number'); edit(MY, { waPhone: n }); setWa(n); say('Saved. Connects when the WhatsApp line goes live.'); }} className="btn-line px-4 text-sm">Save</button>
            </div>
            <Sim label="Not connected yet" />
          </Card>
        </div>

        <aside className="flex flex-col gap-4 md:sticky md:top-24 md:self-start">
          <div className="panel flex flex-col items-center gap-4 p-6 text-center">
            <div className="label">Your shop QR</div>
            <div ref={qr} className="rounded-2xl bg-chalk p-4"><QRCodeCanvas value={url} size={200} bgColor="#FAF8F3" fgColor="#0A0A0A" level="M" marginSize={0} /></div>
            <div className="text-lg font-extrabold">{v.name}</div>
            <p className="text-sm text-mute">Print it and stick it on your stall. Customers scan to pay at the counter, or to order ahead. For an exact bill, use Collect.</p>
            <button onClick={downloadQr} className="btn-z w-full"><Download size={16} /> Download PNG</button>
          </div>
          <div className="panel flex flex-col gap-2 p-5 text-sm">
            <div className="label flex items-center gap-1.5"><Wallet size={13} /> Payout wallet</div>
            <div className="font-mono">{short(v.wallet)}</div>
            <div className="text-xs text-dim">Embedded wallet made at sign-up. Payments arrive here directly.</div>
          </div>
        </aside>
      </div>
    </div>
  );
}

const Card = ({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) => (
  <section className="panel flex flex-col gap-3 p-5"><h2 className="flex items-center gap-2 font-bold"><span className="text-z">{icon}</span>{title}</h2>{children}</section>
);
const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="flex flex-1 flex-col gap-1.5 text-xs text-mute">{label}{children}</label>
);

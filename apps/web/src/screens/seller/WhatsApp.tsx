import { CheckCheck, ExternalLink, Lock, MessageCircle, Mic, Smile, Sparkles } from 'lucide-react';
import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../../components/kit';
import { useServer, waMe } from '../../lib/api';
import { isDemoStall, useApp, useMyStallId, useVendor } from '../../store';

type Bubble =
  | { me: true; text: string; at: string }
  | { me: false; text: string; at: string; head?: string; rows?: [string, string][]; buttons?: string[]; link?: string; list?: string };

/** What the stall's chat looks like (the real messages the server sends; see api/whatsapp.ts). */
const STALL: Bubble[] = [
  { me: true, text: '📷 photo of today’s stock', at: '09:41' },
  { me: false, head: '✨ AI DRAFT · CHECK IT', text: '1. Tomato (टमाटर) · ₹40/kg · 20 in stock\n2. Onion (प्याज) · ₹30/kg · 15 in stock\n\nCheck the prices. Change anything by typing it.', buttons: ['✅ Publish', '✕ Cancel'], at: '09:41' },
  { me: true, text: '✅ Publish', at: '09:42' },
  { me: false, text: 'Live ✅ 2 items now on your stall: zeeto.vercel.app/s/your-stall', at: '09:42' },
  { me: false, head: '🔔 NEW ORDER #NT-576', text: '₹120 · 1.43 USDT received from +91 98•••• 4210\n2 kg Tomato\nPickup code: NT-576\n✓ Already in your wallet. Gas paid by Zeeto.', buttons: ['✅ Accept NT-576', '📋 Open orders'], at: '14:15' },
  { me: true, text: '✅ Accept NT-576', at: '14:15' },
  { me: false, text: 'NT-576 → accepted, customer told ✅', buttons: ['📦 Ready NT-576'], at: '14:15' },
  { me: true, text: '250 ka bill bana do', at: '14:30' },
  { me: false, text: 'Bill for ₹250. Forward this to the customer, or open it and show the QR. Valid 5 minutes.', link: 'Open bill', at: '14:30' },
  { me: true, text: 'refund NT-576', at: '17:40' },
  { me: false, text: '🔒 Refunds move money, so your wallet confirms them in Zeeto. It takes 10 seconds and there’s no gas fee.', link: 'Open refunds', at: '17:40' },
  { me: false, head: '📊 TODAY AT YOUR STALL', text: '', rows: [['Orders', '14'], ['Sales', '₹3,860'], ['Received', '45.95 USDT'], ['Running low', 'Tomato (3)']], buttons: ['📋 Open orders', '✨ AI tips'], at: '21:30' },
];

const CUSTOMER: Bubble[] = [
  { me: true, text: 'chai kahan milegi?', at: '18:02' },
  { me: false, text: 'Yeh stalls abhi chai de rahe hain:', list: 'See stalls', at: '18:02' },
  { me: true, text: 'Anna Chai Point', at: '18:02' },
  { me: false, head: 'Anna Chai Point', text: '• Cutting chai · ₹15/cup\n• Bun maska · ₹30/pc\n\nOrder for pickup on Zeeto, or reply "pay anna 45" to pay at the counter. No gas fee.', link: 'Order on Zeeto', at: '18:03' },
  { me: true, text: 'pay anna 45', at: '18:05' },
  { me: false, text: 'Pay ₹45 to Anna Chai Point. Tap the button, sign in with this phone number and confirm. No gas fee. Link works for 5 minutes.', link: '🔒 Pay ₹45', at: '18:05' },
  { me: false, head: '✅ PAID · CONFIRMED ON WHITECHAIN', text: 'Paid ₹45 to Anna Chai Point ✅\nYour pickup code is AC-214. Say it at the stall.', link: 'View order', at: '18:06' },
  { me: false, text: 'Your order is ready at Anna Chai Point 🎉 Say your name and code AC-214 at the stall.', at: '18:09' },
];

const STALL_CMDS: [string, string][] = [
  ['📷 a photo', 'AI writes the listing, tap Publish'], ['orders', 'open orders with one-tap Accept / Ready / Done'], ['today', 'sales, USDT received, running low'],
  ['tips', 'Gemini tips from your own numbers'], ['bill 250', 'a pay link for a customer'], ['open / close', 'take orders or pause'], ['refund', 'secure link: your wallet confirms it'],
  ['any language', '“aaj 20 kilo tamatar 40”, “NT-576 ready hai”'],
];

export default function WhatsApp() {
  const MY = useMyStallId();
  const v = useVendor(MY)!;
  const sample = isDemoStall(MY);
  const on = useServer((s) => !!s.features.whatsapp);
  const number = useServer((s) => s.waNumber);
  const waPhone = useApp((s) => s.edits[MY]?.waPhone) ?? (v as { waPhone?: string }).waPhone;
  const [tab, setTab] = useState<'stall' | 'customer'>('stall');
  const [copied, setCopied] = useState('');
  const open = waMe('today');
  const copy = (t: string) => navigator.clipboard?.writeText(t).then(() => { setCopied(t); setTimeout(() => setCopied(''), 1500); }, () => undefined);

  return (
    <div>
      <Header title="WhatsApp" sub="Run your stall from the chat app you already use" />
      <div className="gutter mx-auto grid max-w-6xl gap-8 py-6 lg:grid-cols-[1fr_400px]">
        <section className="flex flex-col gap-5">
          <div className={`panel flex flex-wrap items-center gap-4 p-5 ${on ? 'border-good/40' : ''}`}>
            <span className={`grid h-12 w-12 place-items-center rounded-2xl ${on ? 'bg-good-soft text-good' : 'bg-raised text-mute'}`}><MessageCircle /></span>
            <div className="min-w-0 flex-1">
              <div className="font-bold">{on ? 'Zeeto on WhatsApp is live' : 'WhatsApp line not connected yet'}</div>
              <div className="text-sm text-mute">{on ? `Message ${number ?? 'the Zeeto number'} from your stall’s phone.` : 'The Zeeto team adds the Meta keys once; then every stall can use it.'}</div>
            </div>
            {on && open && <a href={open} target="_blank" rel="noreferrer" className="btn-z px-4 py-2 text-sm">Open WhatsApp <ExternalLink size={14} /></a>}
          </div>

          <div className="panel flex flex-col gap-3 p-5">
            <div className="label">1 · Your stall’s WhatsApp number</div>
            {waPhone ? <p className="text-sm">Zeeto will answer <b className="font-mono">{waPhone}</b> as <b>{v.name}</b>. Order alerts go there too.</p>
              : <p className="text-sm text-mute">Add the number you use on WhatsApp, so Zeeto knows it’s you and sends order alerts there.</p>}
            <Link to="/sell/store" className="btn-line self-start px-4 py-2 text-sm">{waPhone ? 'Change number' : 'Add my number'}</Link>
            {sample && <p className="text-xs text-dim">This is the sample stall. Open your own stall to connect yours.</p>}
          </div>

          <div className="panel flex flex-col gap-3 p-5">
            <div className="label">2 · Say hi once</div>
            <p className="text-sm text-mute">WhatsApp only lets businesses reply to people who messaged in the last 24 hours. Send “hi” to {number ?? 'the Zeeto number'} from your phone, and keep the chat.</p>
          </div>

          <div className="panel flex flex-col gap-3 p-5">
            <div className="label">3 · What you can send</div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {STALL_CMDS.map(([c, d]) => (
                <li key={c}><button onClick={() => copy(c)} className="flex w-full items-start gap-3 rounded-2xl border border-line bg-raised/60 p-3 text-left text-sm transition hover:border-z/50">
                  <code className="shrink-0 rounded-lg bg-z-soft px-2 py-0.5 font-mono text-xs text-z">{c}</code><span className="text-mute">{copied === c ? 'Copied' : d}</span>
                </button></li>
              ))}
            </ul>
          </div>

          <div className="panel flex items-start gap-3 p-5 text-sm">
            <Lock size={18} className="mt-0.5 shrink-0 text-z" />
            <p className="text-mute"><b className="text-chalk">Money never moves inside WhatsApp.</b> Payments and refunds open a Zeeto link where the wallet signs once (no gas). A forwarded or fake message can’t pay anyone except the stall on the checkout page, for the amount shown. Every message from Meta is checked against its signature.</p>
          </div>

          <div className="panel flex flex-col gap-2 p-5 text-sm">
            <div className="label">Customers can order on WhatsApp too</div>
            <p className="text-mute">Put this on your counter: customers message it to see your menu and pay.</p>
            <code className="break-all rounded-xl bg-raised p-3 font-mono text-xs">{waMe(`stall ${MY}`) ?? `wa.me/<zeeto-number>?text=stall ${MY}`}</code>
          </div>
        </section>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="mb-3 flex rounded-full border border-line p-1 text-sm">
            {(['stall', 'customer'] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-full py-2 ${tab === t ? 'bg-chalk font-bold text-bg' : 'text-mute'}`}>{t === 'stall' ? 'Your chat (stall)' : 'Customer’s chat'}</button>)}
          </div>
          <Phone title={tab === 'stall' ? 'Zeeto for Stalls' : 'Zeeto'} msgs={tab === 'stall' ? STALL : CUSTOMER} />
          <p className="mt-3 flex items-center gap-1.5 text-xs text-dim"><Sparkles size={13} className="text-z" /> Real message formats. Buttons are WhatsApp reply buttons; links open Zeeto.</p>
        </aside>
      </div>
    </div>
  );
}

/** A WhatsApp-style chat, drawn with our own styles (no WhatsApp branding or assets). */
function Phone({ title, msgs }: { title: string; msgs: Bubble[] }) {
  return (
    <div className="overflow-hidden rounded-[36px] border-[6px] border-[#1c1c1c] bg-[#0b141a] shadow-lift">
      <div className="flex items-center gap-3 bg-[#1f2c34] px-4 py-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-z font-black text-z-ink">Z</span>
        <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold text-white">{title} <span className="text-[#25d366]">✓</span></div><div className="text-[11px] text-white/60">Business account</div></div>
      </div>
      <div className="flex max-h-[600px] flex-col gap-2 overflow-y-auto px-3 py-4" style={{ background: 'radial-gradient(circle at 20% 10%, rgba(255,255,255,0.03), transparent 40%), #0b141a' }}>
        <div className="mx-auto rounded-lg bg-[#1f2c34] px-2 py-0.5 text-[10px] uppercase text-white/60">Today</div>
        {msgs.map((m, i) => (
          <div key={i} className={`max-w-[85%] ${m.me ? 'self-end' : 'self-start'}`}>
            <div className={`rounded-xl px-3 py-2 text-[13px] leading-snug text-white ${m.me ? 'rounded-tr-sm bg-[#005c4b]' : 'rounded-tl-sm bg-[#1f2c34]'}`}>
              {!m.me && m.head && <div className="mb-1 text-[11px] font-bold tracking-wide text-z">{m.head}</div>}
              {m.text && <p className="whitespace-pre-line">{m.text}</p>}
              {!m.me && m.rows && <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12px]">{m.rows.map(([k, v]) => <Fragment key={k}><dt className="text-white/60">{k}</dt><dd className="text-right font-semibold">{v}</dd></Fragment>)}</dl>}
              <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-white/50">{m.at}{m.me && <CheckCheck size={12} className="text-[#53bdeb]" />}</div>
            </div>
            {!m.me && m.link && <div className="mt-0.5 flex items-center justify-center gap-1.5 rounded-xl bg-[#1f2c34] py-2 text-[13px] font-semibold text-[#53bdeb]"><ExternalLink size={13} /> {m.link}</div>}
            {!m.me && m.list && <div className="mt-0.5 rounded-xl bg-[#1f2c34] py-2 text-center text-[13px] font-semibold text-[#53bdeb]">☰ {m.list}</div>}
            {!m.me && m.buttons?.map((b) => <div key={b} className="mt-0.5 rounded-xl bg-[#1f2c34] py-2 text-center text-[13px] font-semibold text-[#53bdeb]">{b}</div>)}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 bg-[#1f2c34] px-3 py-2.5 text-white/50"><Smile size={18} /><span className="flex-1 rounded-full bg-[#2a3942] px-3 py-1.5 text-[13px]">Message</span><Mic size={18} /></div>
    </div>
  );
}


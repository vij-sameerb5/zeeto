import { Check, PackageCheck, ShieldCheck, X } from 'lucide-react';
import { useState } from 'react';
import { RAILS, UNITS, ago, inr, mockPayments, short, type Order, type OrderStatus } from '@zeeto/core';
import { Empty, Header, Modal, Sim, Status } from '../../components/kit';
import { MY_STALL, useApp } from '../../store';

const TABS: [string, OrderStatus[]][] = [['New', ['paid']], ['Packing', ['accepted', 'ready']], ['Done', ['done', 'refunded', 'part-refunded']]];
const REASONS = ['Sold out', 'Closing early', 'Can’t fill the quantity'];

export default function SellOrders() {
  const orders = useApp((s) => s.stallOrders.filter((o) => o.vendorId === MY_STALL));
  const accept = useApp((s) => s.accept);
  const packed = useApp((s) => s.packed);
  const handedOver = useApp((s) => s.handedOver);
  const refunded = useApp((s) => s.refunded);
  const say = useApp((s) => s.say);
  const [tab, setTab] = useState(0);
  const [hand, setHand] = useState<Order | null>(null);
  const [reject, setReject] = useState<Order | null>(null);
  const [code, setCode] = useState('');
  const [tries, setTries] = useState(0);
  const [busy, setBusy] = useState(false);
  const shown = orders.filter((o) => TABS[tab][1].includes(o.status));

  const norm = (s: string) => s.replace(/[^a-z0-9]/gi, '').toUpperCase();
  const confirm = () => {
    if (!hand) return;
    if (norm(code) === norm(hand.code)) {
      handedOver(hand.id);
      say(`Handed over ${hand.code}. Order complete.`);
      setHand(null);
    } else {
      setTries((t) => t + 1);
    }
  };

  const doReject = async (why: string) => {
    if (!reject) return;
    setBusy(true);
    const r = await mockPayments.refund(reject, reject.usd, why);
    refunded(reject.id, r, true);
    setBusy(false);
    setReject(null);
    say(`Rejected. ${r.amount.toFixed(2)} ${r.token} refunded to ${reject.customer}.`);
  };

  return (
    <div>
      <Header title="Orders" sub="Every order here is already paid" right={<Sim />} />
      <div className="gutter mx-auto flex max-w-3xl flex-col gap-5 py-6">
        <div className="flex rounded-full border border-line bg-panel p-1">
          {TABS.map(([l, s], i) => {
            const n = orders.filter((o) => s.includes(o.status)).length;
            return <button key={l} onClick={() => setTab(i)} className={`flex-1 rounded-full py-2.5 text-sm font-semibold ${tab === i ? 'bg-chalk text-bg' : 'text-mute'}`}>{l} {n > 0 && <span className="nums">({n})</span>}</button>;
          })}
        </div>

        {!shown.length && <Empty icon="Receipt" title="Nothing here" body={tab === 0 ? 'New paid orders land here. You’ll get a WhatsApp ping too once it’s connected.' : 'All clear.'} />}

        <ul className="flex flex-col gap-3">
          {shown.map((o) => (
            <li key={o.id} className={`panel flex flex-col gap-3 p-5 ${o.status === 'paid' ? 'border-z/50' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div><div className="font-bold">{o.customer} · <span className="font-mono">{o.id.toUpperCase()}</span></div><div className="text-sm text-mute">{ago(o.at)}</div></div>
                <div className="text-right"><div className="text-xl font-extrabold nums">{inr(o.inr)}</div><Status s={o.status} /></div>
              </div>
              <ul className="rounded-2xl bg-raised p-3 text-sm">
                {o.lines.map((l) => <li key={l.productId} className="flex justify-between py-0.5"><span><b>{l.qty} {UNITS[l.unit]}</b> {l.name}</span><span className="text-mute nums">{inr(l.qty * l.priceInr)}</span></li>)}
              </ul>
              {o.payment && (
                <div className="flex items-center gap-2 text-xs text-mute">
                  <ShieldCheck size={14} className="text-good" />
                  {o.payment.settled.toFixed(2)} {o.payment.settledToken} received on {RAILS[o.payment.rail].network}
                  <span className="font-mono text-dim">tx {short(o.payment.tx)}</span>
                </div>
              )}
              {o.refunds.map((r, i) => <div key={i} className="text-sm text-warn">Refunded {r.amount.toFixed(2)} {r.token} · {r.reason}</div>)}

              {o.status === 'paid' && (
                <div className="flex gap-2">
                  <button onClick={() => { accept(o.id); say(`Accepted ${o.id.toUpperCase()}. Start packing.`); }} className="btn-z flex-1"><Check size={17} /> Accept</button>
                  <button onClick={() => setReject(o)} className="btn-line"><X size={17} /> Reject</button>
                </div>
              )}
              {o.status === 'accepted' && <button onClick={() => { packed(o.id); say(`${o.customer} has been told it’s ready.`); }} className="btn-z"><PackageCheck size={17} /> Packed · ready for pickup</button>}
              {o.status === 'ready' && <button onClick={() => { setHand(o); setCode(''); setTries(0); }} className="btn-chalk">Customer is here · check code</button>}
            </li>
          ))}
        </ul>
      </div>

      <Modal open={!!hand} onClose={() => setHand(null)} title="Ask for the pickup code">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-mute">{hand?.customer} shows a code like <b className="font-mono text-chalk">AB-123</b> on their phone. Type it to hand over.</p>
          <input autoFocus value={code} onChange={(e) => { setCode(e.target.value.toUpperCase().slice(0, 8)); }} onKeyDown={(e) => e.key === 'Enter' && tries < 5 && confirm()} placeholder="AB-123" aria-label="Pickup code" className={`h-16 rounded-2xl border bg-raised text-center font-mono text-3xl tracking-[0.2em] outline-none ${tries ? 'border-bad' : 'border-line-2 focus:border-z'}`} />
          {tries > 0 && tries < 5 && <p className="text-sm text-bad">That code doesn’t match. {5 - tries} tries left.</p>}
          {tries >= 5 && <p className="text-sm text-bad">Too many wrong codes. Ask the customer to open the order on their phone.</p>}
          <button disabled={code.length < 4 || tries >= 5} onClick={confirm} className="btn-z">Hand over</button>
          <p className="text-center text-xs text-dim">Demo: the code is {hand?.code}</p>
        </div>
      </Modal>

      <Modal open={!!reject} onClose={() => !busy && setReject(null)} title="Reject and refund?">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-mute">{reject?.customer} gets {reject?.usd.toFixed(2)} USDT back from your wallet right away. Pick a reason they’ll see:</p>
          {REASONS.map((r) => <button key={r} disabled={busy} onClick={() => doReject(r)} className="btn-line justify-start">{r}</button>)}
        </div>
      </Modal>
    </div>
  );
}

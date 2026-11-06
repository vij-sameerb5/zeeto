import { BellRing, Check, ExternalLink, PackageCheck, ShieldCheck, Undo2, X } from 'lucide-react';
import { useState } from 'react';
import { RAILS, UNITS, ago, customerVisits, inr, short, tierFor, type Order, type OrderStatus } from '@zeeto/core';
import { useSession } from '../../lib/auth';
import { PayError, orderAction, refundOnServer, refundOrder, txLink } from '../../lib/pay';
import { Empty, Header, Modal, Sim, Status } from '../../components/kit';
import { useMyStallId, useApp } from '../../store';

const TABS: [string, OrderStatus[]][] = [['New', ['paid']], ['Packing', ['accepted', 'ready']], ['Done', ['done', 'refunded', 'part-refunded']]];
const REASONS = ['Sold out', 'Closing early', 'Can’t fill the quantity'];

/**
 * Business rules for the stall side:
 * - Every order here is already paid onchain (or simulated for demo stalls).
 * - New → Accept or Reject. Reject always refunds in full.
 * - If the customer asks to cancel before you accept, you can only refund (Accept is blocked).
 * - Accepted → Packed. Ready → Hand over after the customer says their name and the 4-character code.
 * - Refunds of real payments are sent from this stall’s wallet back to the wallet that paid.
 */

export default function SellOrders() {
  const MY = useMyStallId();
  const orders = useApp((s) => s.stallOrders.filter((o) => o.vendorId === MY));
  const accept = useApp((s) => s.accept);
  const packed = useApp((s) => s.packed);
  const handedOver = useApp((s) => s.handedOver);
  const refunded = useApp((s) => s.refunded);
  const say = useApp((s) => s.say);
  const [tab, setTab] = useState(0);
  const [hand, setHand] = useState<Order | null>(null);
  const [reject, setReject] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const session = useSession();
  const shown = orders.filter((o) => TABS[tab][1].includes(o.status));

  /** Server orders go through the API (it checks you own the stall and the order is at the right step). Demo orders stay local. */
  const step = async (o: Order, a: 'accept' | 'packed' | 'handover', local: () => void, msg: string) => {
    if (!o.server) { local(); say(msg); return true; }
    try { useApp.getState().upsertOrder(await orderAction(o, a)); say(msg); return true; }
    catch (e) { say((e as Error).message); return false; }
  };
  const confirm = async () => {
    if (!hand) return;
    if (await step(hand, 'handover', () => handedOver(hand.id), `Handed over to ${hand.customer}. Order complete.`)) setHand(null);
  };

  const doReject = async (why: string) => {
    if (!reject) return;
    setBusy(true); setErr('');
    try {
      if (reject.server) {
        useApp.getState().upsertOrder(await refundOnServer(reject, undefined, why, session));
        say(`Refunded ${reject.usd.toFixed(2)} USDT to ${reject.customer}.`);
      } else {
        const r = await refundOrder(reject, reject.usd, why, session);
        refunded(reject.id, r, true);
        say(`Refunded ${r.amount.toFixed(2)} ${r.token} to ${reject.customer}.`);
      }
      setReject(null);
    } catch (e) {
      setErr(e instanceof PayError ? e.message : 'Refund didn’t go through. Nothing was sent. Try again.');
    } finally { setBusy(false); }
  };

  return (
    <div>
      <Header title="Orders" sub="Every order here is already paid" right={MY === 'ravi' ? <Sim /> : undefined} />
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
                <div><div className="font-bold">{o.customer} · <span className="font-mono">{o.id.toUpperCase()}</span></div><div className="flex flex-wrap items-center gap-2 text-sm text-mute">{ago(o.at)}<VisitBadge n={customerVisits(orders, o)} /></div></div>
                <div className="text-right"><div className="text-xl font-extrabold nums">{inr(o.inr)}</div><Status s={o.status} /></div>
              </div>
              <ul className="rounded-2xl bg-raised p-3 text-sm">
                {o.lines.map((l) => <li key={l.productId} className="flex justify-between py-0.5"><span><b>{l.qty} {UNITS[l.unit]}</b> {l.name}</span><span className="text-mute nums">{inr(l.qty * l.priceInr)}</span></li>)}
              </ul>
              {o.payment && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-mute">
                  <ShieldCheck size={14} className="text-good" />
                  {o.payment.settled.toFixed(2)} {o.payment.settledToken} received on {RAILS[o.payment.rail].network}
                  {o.payment.simulated
                    ? <span className="font-mono text-dim">tx {short(o.payment.tx)} · simulated</span>
                    : <a href={txLink(o.payment)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-z">tx {short(o.payment.tx)} <ExternalLink size={11} /></a>}
                </div>
              )}
              {o.cancelAsked && o.status === 'paid' && <div className="flex items-center gap-2 rounded-2xl border border-warn/40 bg-warn/10 p-3 text-sm text-warn"><Undo2 size={15} /> {o.customer} asked to cancel. Please refund.</div>}
              {o.arrivedAt && ['paid', 'accepted', 'ready'].includes(o.status) && <div className="flex items-center gap-2 rounded-2xl border border-z/40 bg-z-soft p-3 text-sm font-semibold text-z"><BellRing size={15} /> {o.customer} is at the stall · {ago(o.arrivedAt)}</div>}
              {o.refunds.map((r, i) => <div key={i} className="text-sm text-warn">Refunded {r.amount.toFixed(2)} {r.token} · {r.reason}</div>)}

              {o.status === 'paid' && o.cancelAsked && <button onClick={() => { setReject(o); setErr(''); }} className="btn-z"><Undo2 size={17} /> Refund {o.usd.toFixed(2)} USDT</button>}
              {o.status === 'paid' && !o.cancelAsked && (
                <div className="flex gap-2">
                  <button onClick={() => step(o, 'accept', () => accept(o.id), `Accepted ${o.id.toUpperCase()}. Start packing.`)} className="btn-z flex-1"><Check size={17} /> Accept</button>
                  <button onClick={() => { setReject(o); setErr(''); }} className="btn-line"><X size={17} /> Reject</button>
                </div>
              )}
              {o.status === 'accepted' && <button onClick={() => step(o, 'packed', () => packed(o.id), `${o.customer} has been told it’s ready.`)} className="btn-z"><PackageCheck size={17} /> Packed · ready for pickup</button>}
              {o.status === 'ready' && <button onClick={() => setHand(o)} className="btn-chalk">Hand over</button>}
            </li>
          ))}
        </ul>
      </div>

      <Modal open={!!hand} onClose={() => setHand(null)} title="Hand over this order?">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-mute">Ask the customer for their name and code. If both match, hand over the bag.</p>
          <div className="rounded-2xl border border-line-2 bg-raised p-4 text-center">
            <div className="text-lg font-bold">{hand?.customer}</div>
            <div className="mt-1 font-mono text-4xl font-bold tracking-[0.18em] text-z">{hand?.code}</div>
            <div className="mt-2 text-xs text-dim">Order {hand?.id.toUpperCase()} · {hand?.lines.length} {hand?.lines.length === 1 ? 'item' : 'items'}</div>
          </div>
          <button onClick={confirm} className="btn-z"><Check size={17} /> It matches · handed over</button>
          <button onClick={() => setHand(null)} className="btn-line">Not yet</button>
        </div>
      </Modal>

      <Modal open={!!reject} onClose={() => !busy && setReject(null)} title={reject?.cancelAsked ? 'Refund this order?' : 'Reject and refund?'}>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-mute">{reject?.customer} gets {reject?.usd.toFixed(2)} USDT back from your wallet. {reject?.payment && !reject.payment.simulated ? 'Your wallet will ask you to confirm the transfer.' : ''} Pick a reason they’ll see:</p>
          {reject?.cancelAsked && <button disabled={busy} onClick={() => doReject('Cancelled by customer')} className="btn-z">{busy ? 'Refunding…' : 'Customer cancelled'}</button>}
          {err && <p className="text-sm text-bad">{err}</p>}
          {!reject?.cancelAsked && REASONS.map((r) => <button key={r} disabled={busy} onClick={() => doReject(r)} className="btn-line justify-start">{r}</button>)}
        </div>
      </Modal>
    </div>
  );
}

/** How well the stall knows this customer: first visit, or their nth visit and tier at this stall. */
function VisitBadge({ n }: { n: number }) {
  if (n <= 1) return <span className="rounded-full bg-z-soft px-2 py-0.5 text-[11px] font-semibold text-z">First visit</span>;
  return <span className="rounded-full bg-good-soft px-2 py-0.5 text-[11px] font-semibold text-good">Visit {n} · {tierFor(n).name}</span>;
}

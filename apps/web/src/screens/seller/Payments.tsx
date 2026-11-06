import { Code2, Download, ExternalLink, Info, Undo2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { RAILS, ago, inr, short, type Order } from '@zeeto/core';
import { useSession } from '../../lib/auth';
import { PayError, refundOnServer, refundOrder } from '../../lib/pay';
import { Header, Metric, Modal, Sim } from '../../components/kit';
import { useMyStallId, useApp, useVendor } from '../../store';

/** Spreadsheet-safe cell: quotes everything and defuses formulas (=, +, -, @) so a CSV can't run code in Excel. */
const cell = (v: string | number) => {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export default function Payments() {
  const MY = useMyStallId();
  const v = useVendor(MY)!;
  const orders = useApp((s) => s.stallOrders.filter((o) => o.vendorId === MY && o.payment));
  const refunded = useApp((s) => s.refunded);
  const say = useApp((s) => s.say);
  const [ref, setRef] = useState<Order | null>(null);
  const [amt, setAmt] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const session = useSession();

  const gross = orders.reduce((s, o) => s + (o.payment?.settled ?? 0), 0);
  const back = orders.reduce((s, o) => s + o.refunds.reduce((a, r) => a + r.amount, 0), 0);
  const net = gross - back;

  const csv = () => {
    // For the accountant: one row per order, with the onchain receipt link, refunds and the gas the business covered.
    const head = ['order', 'customer', 'time', 'inr', 'paid', 'token', 'network', 'tx', 'receipt_url', 'refunded', 'refund_txs', 'status', 'gasless', 'gas_wbt', 'order_ref', 'simulated'];
    const rows = orders.map((o) => {
      const p = o.payment! as typeof o.payment & { gasWei?: string };
      return [o.id, o.customer, o.at, o.inr, p.settled.toFixed(2), p.settledToken, RAILS[p.rail].network, p.tx, p.simulated ? '' : RAILS[p.rail].txUrl(p.tx),
        o.refunds.reduce((a, r) => a + r.amount, 0).toFixed(2), o.refunds.map((r) => r.tx).join(' '), o.status, String(!!p.gasless),
        p.gasWei ? (Number(p.gasWei) / 1e18).toFixed(8) : '', o.orderRef ?? p.memo ?? '', String(p.simulated)];
    });
    const blob = new Blob([[head, ...rows].map((r) => r.map(cell).join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `zeeto-${v.id}-payments.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const left = ref ? ref.payment!.settled - ref.refunds.reduce((a, r) => a + r.amount, 0) : 0;
  const n = Number(amt);
  const okAmt = Number.isFinite(n) && n > 0 && n <= left + 1e-9;
  const doRefund = async () => {
    if (!ref || !okAmt) return;
    setBusy(true); setErr('');
    try {
      const usd = Math.round(n * 100) / 100;
      if (ref.server) useApp.getState().upsertOrder(await refundOnServer(ref, usd, 'Refund from stall', session));
      else refunded(ref.id, await refundOrder(ref, usd, 'Refund from stall', session), n >= left - 1e-9);
      setRef(null);
      say(`Refunded ${usd.toFixed(2)} USDT to ${ref.customer}`);
    } catch (e) {
      setErr(e instanceof PayError ? e.message : 'Refund didn’t go through. Nothing was sent.');
    } finally { setBusy(false); }
  };

  return (
    <div>
      <Header title="Payments" sub="Every rupee, every transaction" right={<div className="flex gap-2"><Link to="/sell/developers" className="btn-line px-3 py-2 text-sm"><Code2 size={16} /> <span className="hidden sm:inline">Developers</span></Link><button onClick={csv} className="btn-line px-4 py-2 text-sm"><Download size={16} /> CSV</button></div>} />
      <div className="gutter mx-auto flex max-w-4xl flex-col gap-6 py-6">
        <div className="grid grid-cols-3 gap-3">
          <Metric label="Received" value={gross.toFixed(2)} hint="USDT + USDC" hot />
          <Metric label="Refunded" value={back.toFixed(2)} hint="sent back" />
          <Metric label="Net" value={net.toFixed(2)} hint={`wallet ${short(v.wallet)}`} />
        </div>
        <p className="flex items-start gap-2 rounded-2xl bg-raised p-4 text-sm text-mute"><Info size={16} className="mt-0.5 shrink-0 text-z" /> Money lands in your Zeeto wallet the moment the customer pays. Zeeto never holds it. Turning USDT into rupees in your bank needs a licensed partner and is not part of this demo.</p>

        <ul className="flex flex-col gap-3">
          {orders.map((o) => {
            const p = o.payment!;
            const rail = RAILS[p.rail];
            const back = o.refunds.reduce((a, r) => a + r.amount, 0);
            return (
              <li key={o.id} className="panel flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{o.customer} · <span className="font-mono">{o.id.toUpperCase()}</span> <span className="text-sm font-normal text-mute">· {inr(o.inr)}</span></div>
                    <div className="truncate text-xs text-mute">{rail.label} · {rail.network} · {ago(p.at)}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="whitespace-nowrap font-mono text-lg font-bold text-good nums">+{p.settled.toFixed(2)} {p.settledToken}</div>
                    {back > 0 && <div className="font-mono text-xs text-warn">−{back.toFixed(2)} refunded</div>}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2 font-mono text-[11px] text-dim">
                    {p.simulated ? <><span className="truncate">tx {short(p.tx)}</span> <Sim /></> : <a href={rail.txUrl(p.tx)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-z">tx {short(p.tx)} <ExternalLink size={11} /></a>}
                  </div>
                  {o.status !== 'refunded' && <button onClick={() => { setRef(o); setAmt(String((p.settled - back).toFixed(2))); }} className="btn-line shrink-0 px-3 py-1.5 text-xs"><Undo2 size={14} /> Refund</button>}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <Modal open={!!ref} onClose={() => !busy && setRef(null)} title="Refund">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-mute">Sends USDT from your wallet back to {ref?.customer}. Up to <b className="text-chalk">{left.toFixed(2)}</b> is left on this order.</p>
          <input value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" aria-label="Refund amount" className="h-14 rounded-2xl border border-line-2 bg-raised px-4 text-center font-mono text-2xl outline-none focus:border-z" />
          {!okAmt && amt && <p className="text-sm text-bad">Enter an amount between 0 and {left.toFixed(2)}.</p>}
          {err && <p className="text-sm text-bad">{err}</p>}
          <button disabled={!okAmt || busy} onClick={doRefund} className="btn-z">{busy ? 'Sending…' : `Refund ${okAmt ? n.toFixed(2) : ''} ${ref?.payment?.settledToken ?? ''}`}</button>
          <p className="text-xs text-dim">Refunds are final and sign with your wallet, never from WhatsApp.</p>
        </div>
      </Modal>
    </div>
  );
}

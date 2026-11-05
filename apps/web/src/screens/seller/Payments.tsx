import { Download, ExternalLink, Info, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { RAILS, ago, inr, mockPayments, short, type Order } from '@zeeto/core';
import { Header, Metric, Modal, Sim } from '../../components/kit';
import { MY_STALL, useApp, useVendor } from '../../store';

/** Spreadsheet-safe cell: quotes everything and defuses formulas (=, +, -, @) so a CSV can't run code in Excel. */
const cell = (v: string | number) => {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export default function Payments() {
  const v = useVendor(MY_STALL)!;
  const orders = useApp((s) => s.stallOrders.filter((o) => o.vendorId === MY_STALL && o.payment));
  const refunded = useApp((s) => s.refunded);
  const say = useApp((s) => s.say);
  const [ref, setRef] = useState<Order | null>(null);
  const [amt, setAmt] = useState('');
  const [busy, setBusy] = useState(false);

  const gross = orders.reduce((s, o) => s + (o.payment?.settled ?? 0), 0);
  const back = orders.reduce((s, o) => s + o.refunds.reduce((a, r) => a + r.amount, 0), 0);
  const net = gross - back;

  const csv = () => {
    const head = ['order', 'customer', 'time', 'inr', 'paid', 'token', 'network', 'tx', 'refunded', 'status', 'simulated'];
    const rows = orders.map((o) => [o.id, o.customer, o.at, o.inr, o.payment!.settled.toFixed(2), o.payment!.settledToken, RAILS[o.payment!.rail].network, o.payment!.tx, o.refunds.reduce((a, r) => a + r.amount, 0).toFixed(2), o.status, String(o.payment!.simulated)]);
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
    setBusy(true);
    const r = await mockPayments.refund(ref, Math.round(n * 100) / 100, 'Refund from stall');
    refunded(ref.id, r, n >= left - 1e-9);
    setBusy(false);
    setRef(null);
    say(`Refunded ${r.amount.toFixed(2)} ${r.token} to ${ref.customer}`);
  };

  return (
    <div>
      <Header title="Payments" sub="Every rupee, every transaction" right={<button onClick={csv} className="btn-line px-4 py-2 text-sm"><Download size={16} /> CSV</button>} />
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
              <li key={o.id} className="panel flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{o.customer} · <span className="font-mono">{o.id.toUpperCase()}</span> <span className="text-sm font-normal text-mute">· {inr(o.inr)}</span></div>
                  <div className="text-xs text-mute">{rail.label} · {rail.network} · {ago(p.at)}</div>
                  <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-dim">
                    {p.simulated ? <>tx {short(p.tx)} <Sim /></> : <a href={rail.txUrl(p.tx)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-z">tx {short(p.tx)} <ExternalLink size={11} /></a>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-lg font-bold text-good nums">+{p.settled.toFixed(2)} {p.settledToken}</div>
                  {back > 0 && <div className="font-mono text-xs text-warn">−{back.toFixed(2)} refunded</div>}
                </div>
                {o.status !== 'refunded' && <button onClick={() => { setRef(o); setAmt(String((p.settled - back).toFixed(2))); }} className="btn-line px-3 py-2 text-xs"><Undo2 size={14} /> Refund</button>}
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
          <button disabled={!okAmt || busy} onClick={doRefund} className="btn-z">{busy ? 'Sending…' : `Refund ${okAmt ? n.toFixed(2) : ''} ${ref?.payment?.settledToken ?? ''}`}</button>
          <p className="text-xs text-dim">Refunds are final and sign with your wallet, never from WhatsApp.</p>
        </div>
      </Modal>
    </div>
  );
}

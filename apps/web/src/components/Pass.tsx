import { Nfc, WalletCards } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { inr, type Order, type Vendor } from '@zeeto/core';
import { Mark } from './kit';

/**
 * A wallet-style ticket for a paid order: stall, amount, pickup code and a QR that opens the public receipt.
 * Shown in the app today; "Add to Apple Wallet" (a signed .pkpass) is coming soon.
 */
export function PassTicket({ o, v, receipt }: { o: Order; v: Vendor; receipt?: string | null }) {
  const live = ['paid', 'accepted', 'ready'].includes(o.status);
  return (
    <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#1b1b1b] to-[#0d0d0d] p-5 text-chalk shadow-[0_20px_60px_-25px_rgba(255,122,26,.6)] ring-1 ring-z/30">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-z/25 blur-3xl" />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2"><Mark size={26} /><span className="font-extrabold tracking-tight">Zeeto</span></div>
        <span className="font-mono text-[10px] uppercase tracking-[.2em] text-mute">{live ? 'Pickup pass' : 'Receipt'}</span>
      </div>
      <div className="relative mt-5 grid grid-cols-2 gap-3 text-sm">
        <div><div className="label">Stall</div><div className="truncate font-bold">{v.name}</div></div>
        <div className="text-right"><div className="label">Paid</div><div className="font-bold nums">{inr(o.inr)}</div></div>
        <div><div className="label">Name</div><div className="truncate font-bold">{o.customer}</div></div>
        <div className="text-right"><div className="label">Order</div><div className="font-mono font-bold">{o.id.toUpperCase()}</div></div>
      </div>
      <div className="relative mt-4 flex items-end justify-between gap-4 border-t border-dashed border-white/15 pt-4">
        <div><div className="label">Say this code</div><div className="font-mono text-3xl font-bold tracking-[0.15em] text-z">{o.code}</div></div>
        {receipt && <div className="rounded-xl bg-chalk p-1.5"><QRCodeSVG value={receipt} size={64} bgColor="#FAF8F3" fgColor="#0A0A0A" /></div>}
      </div>
    </div>
  );
}

/** "Add to Apple Wallet": shown, honestly marked coming soon (needs Apple pass signing certificates). */
export function WalletPassButton({ kind }: { kind: 'ticket' | 'loyalty' }) {
  return (
    <button disabled title="Coming soon" className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-black py-3 text-sm font-semibold text-chalk opacity-90">
      <WalletCards size={18} /> Add {kind === 'ticket' ? 'pass' : 'card'} to Apple Wallet
      <span className="rounded-full bg-z-soft px-2 py-0.5 font-mono text-[10px] uppercase text-z">Coming soon</span>
    </button>
  );
}

/** Tap to pay with an iPhone at the stall: on the roadmap. */
export function TapToPaySoon() {
  return (
    <div className="panel flex items-center gap-4 p-5">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-z-soft text-z"><Nfc size={24} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 font-bold">Tap to pay <span className="rounded-full bg-z-soft px-2 py-0.5 font-mono text-[10px] uppercase text-z">Coming soon</span></div>
        <p className="text-sm text-mute">Hold your iPhone near the stall’s phone to pay. No scanning.</p>
      </div>
    </div>
  );
}

import { Check, ExternalLink, Loader2, ShieldCheck } from 'lucide-react';
import { short, type PaymentIntent } from '@zeeto/core';
import type { PayError, PayStep } from '../lib/pay';

const STEPS: { id: PayStep; label: string; hint: (real: boolean) => string }[] = [
  { id: 'check', label: 'Check your balance', hint: (r) => (r ? 'Enough test USDT, and a little WBT for the network fee' : 'Demo stall: no real money moves') },
  { id: 'sign', label: 'Confirm in your wallet', hint: (r) => (r ? 'Your Privy wallet asks you to approve the exact amount' : 'Simulated') },
  { id: 'send', label: 'Send to the stall', hint: () => 'USDT goes straight to the stall’s wallet on Whitechain' },
  { id: 'verify', label: 'Check the receipt', hint: () => 'Zeeto reads the transfer before the stall is told it’s paid' },
];

/** Words a shopper understands. Real stalls use these: no wallet, token, gas or chain anywhere. */
const PLAIN: Record<string, string> = { check: 'Checking your balance', sign: 'Confirming', send: 'Paying the stall', verify: 'Getting your receipt' };

export function PaySteps({ step, intent, error, plain }: { step: PayStep; intent: PaymentIntent | null; error?: PayError | null; plain?: boolean }) {
  const at = STEPS.findIndex((s) => s.id === step);
  if (plain) {
    return (
      <div className="panel flex flex-col gap-2 p-4" aria-live="polite">
        {step !== 'failed' && step !== 'idle' && (
          <div className="flex items-center gap-3 text-sm font-semibold">
            {step === 'done' ? <Check size={18} className="text-good" /> : <Loader2 size={18} className="animate-spin text-z" />}
            {step === 'done' ? 'Paid' : PLAIN[step] ?? 'Paying'}…
            <span className="ml-auto flex gap-1">{STEPS.map((x, i) => <span key={x.id} className={`h-1.5 w-6 rounded-full ${i <= at || step === 'done' ? 'bg-z' : 'bg-raised'}`} />)}</span>
          </div>
        )}
        {error && (
          <div className="rounded-xl bg-bad-soft p-3 text-sm text-bad">
            {error.message}
            {error.fix && <a href={error.fix.href} className="ml-2 inline-flex items-center gap-1 font-semibold underline">{error.fix.label}</a>}
          </div>
        )}
      </div>
    );
  }
  const real = intent ? !intent.simulated : false;
  return (
    <ol className="panel flex flex-col gap-3 p-5" aria-live="polite">
      {STEPS.map((s, i) => {
        const done = step === 'done' || (at >= 0 && i < at);
        const now = i === at && step !== 'failed';
        const bad = step === 'failed' && i === Math.max(0, at);
        return (
          <li key={s.id} className="flex gap-3">
            <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${done ? 'bg-good text-bg' : now ? 'bg-z text-z-ink' : bad ? 'bg-bad text-bg' : 'bg-raised text-dim'}`}>
              {done ? <Check size={14} /> : now ? <Loader2 size={14} className="animate-spin" /> : i + 1}
            </span>
            <div className="min-w-0">
              <div className={`text-sm font-semibold ${done || now ? '' : 'text-dim'}`}>{s.label}</div>
              <div className="text-xs text-mute">{s.hint(real)}</div>
              {s.id === 'send' && intent && <div className="mt-1 truncate font-mono text-[10px] text-dim">to {short(intent.merchant)} · ref {short(intent.orderRef)} · {(Number(intent.amount) / 1e6).toFixed(2)} USDT</div>}
            </div>
          </li>
        );
      })}
      {error && (
        <li className="rounded-xl bg-bad-soft p-3 text-sm text-bad">
          {error.message}
          {error.fix && <a href={error.fix.href} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 font-semibold underline">{error.fix.label} <ExternalLink size={12} /></a>}
        </li>
      )}
    </ol>
  );
}

/** One line under the pay button: real or demo, said plainly. */
export function PayMode({ real, stall }: { real: boolean; stall: string }) {
  return real ? (
    <p className="flex items-start gap-2 text-xs text-good"><ShieldCheck size={14} className="mt-0.5 shrink-0" /> Goes straight to {stall}. No fees, nothing to set up.</p>
  ) : (
    <p className="flex items-start gap-2 text-xs text-warn"><ShieldCheck size={14} className="mt-0.5 shrink-0" /> {stall} is a demo stall, so this payment is simulated. Stalls created with a signed-in account get real payments.</p>
  );
}

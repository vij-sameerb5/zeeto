import { Check, Loader2 } from 'lucide-react';
import { mockPayments, short, type Hex, type Order, type Payment, type PaymentIntent } from '@zeeto/core';

/** Each step mirrors the real StreetPay flow in docs/ARCHITECTURE.md §5. Today they run against the mock. */
export const STEPS = [
  { id: 'intent', label: 'Lock the price', hint: 'Zeeto fixes the USDT amount and signs it for this stall' },
  { id: 'approve', label: 'Approve USDT', hint: 'Your wallet lets the checkout take exactly this amount' },
  { id: 'pay', label: 'Pay the stall', hint: 'USDT goes straight to the stall’s wallet on Whitechain' },
  { id: 'verify', label: 'Confirm onchain', hint: 'Zeeto reads the receipt before anyone is told it’s paid' },
] as const;
export type PayStep = (typeof STEPS)[number]['id'] | 'idle' | 'done' | 'failed';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Runs the four steps for one order and reports progress. Throws if any step fails. */
export async function runPay(order: Order, merchant: Hex, onStep: (s: PayStep) => void, onIntent?: (i: PaymentIntent) => void): Promise<Payment> {
  onStep('intent');
  const it = await mockPayments.intent(order, merchant);
  onIntent?.(it);
  onStep('approve');
  await wait(600);
  onStep('pay');
  const p = await mockPayments.payStreetPay(order);
  onStep('verify');
  await wait(700);
  return p;
}

export function PaySteps({ step, intent }: { step: PayStep; intent: PaymentIntent | null }) {
  const at = STEPS.findIndex((s) => s.id === step);
  return (
    <ol className="panel flex flex-col gap-3 p-5" aria-live="polite">
      {STEPS.map((s, i) => {
        const done = step === 'done' || i < at;
        const now = i === at;
        return (
          <li key={s.id} className="flex gap-3">
            <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${done ? 'bg-good text-bg' : now ? 'bg-z text-z-ink' : 'bg-raised text-dim'}`}>
              {done ? <Check size={14} /> : now ? <Loader2 size={14} className="animate-spin" /> : i + 1}
            </span>
            <div>
              <div className={`text-sm font-semibold ${done || now ? '' : 'text-dim'}`}>{s.label}</div>
              <div className="text-xs text-mute">{s.hint}</div>
              {s.id === 'intent' && intent && <div className="mt-1 font-mono text-[10px] text-dim">ref {short(intent.orderRef)} · {(Number(intent.amount) / 1e6).toFixed(2)} USDT · expires 15 min</div>}
            </div>
          </li>
        );
      })}
      {step === 'failed' && <li className="text-sm text-bad">Payment didn’t go through. Nothing was charged. Try again.</li>}
    </ol>
  );
}

import {
  Apple, BookOpen, Cake, Carrot, ChevronLeft, Coffee, Croissant, Fish, Flame, FlaskConical, Flower2, Lightbulb, Milk, Minus, PenLine,
  Pill, Plus, Receipt, Sandwich, Scissors, ShoppingBasket, Smartphone, Sparkles, Store, UtensilsCrossed, Wrench, X, type LucideIcon,
} from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { OrderStatus } from '@zeeto/core';
import { img } from '../lib/media';
import { useApp } from '../store';

const ICONS: Record<string, LucideIcon> = { Apple, BookOpen, Cake, Carrot, Coffee, Croissant, Fish, Flame, Flower2, Lightbulb, Milk, PenLine, Pill, Receipt, Sandwich, Scissors, ShoppingBasket, Smartphone, Sparkles, Store, UtensilsCrossed, Wrench };
export const Icon = ({ name, size = 18, className }: { name: string; size?: number; className?: string }) => {
  const C = ICONS[name] ?? Store;
  return <C size={size} className={className} />;
};

export function Mark({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
      <rect width="64" height="64" rx="16" fill="#FF7A1A" />
      <path d="M18 18h28v6L27 40h19v6H18v-6l19-16H18z" fill="#1A0B00" />
    </svg>
  );
}

export const Wordmark = () => (
  <span className="inline-flex items-center gap-2 text-lg font-extrabold tracking-[-0.04em]"><Mark size={30} /> zeeto</span>
);

export function Header({ title, back, right, sub }: { title: ReactNode; back?: boolean | string; right?: ReactNode; sub?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-xl pt-safe">
      <div className="gutter mx-auto flex h-16 max-w-6xl items-center gap-3">
        {back && (
          <button aria-label="Back" onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))} className="-ml-2 grid h-10 w-10 place-items-center rounded-full hover:bg-white/5"><ChevronLeft size={22} /></button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[19px] font-bold tracking-tight">{title}</h1>
          {sub && <div className="truncate text-xs text-mute">{sub}</div>}
        </div>
        {right}
      </div>
    </header>
  );
}

/** Marks every value that comes from a mock service. Removed per integration. */
export const Sim = ({ label = 'Simulated' }: { label?: string }) => (
  <span className="inline-flex items-center gap-1 rounded-full border border-warn/30 bg-warn-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-warn"><FlaskConical size={11} /> {label}</span>
);

const STATUS: Record<OrderStatus, [string, string]> = {
  paying: ['Paying…', 'bg-z-soft text-z'],
  paid: ['Paid · waiting for stall', 'bg-good-soft text-good'],
  accepted: ['Accepted · packing', 'bg-z-soft text-z'],
  ready: ['Ready for pickup', 'bg-z-soft text-z'],
  done: ['Picked up', 'bg-white/5 text-mute'],
  refunded: ['Refunded', 'bg-bad-soft text-bad'],
  'part-refunded': ['Part refunded', 'bg-warn-soft text-warn'],
};
export const Status = ({ s }: { s: OrderStatus }) => <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS[s][1]}`}>{STATUS[s][0]}</span>;

export function Qty({ qty, max, onChange }: { qty: number; max?: number; onChange: (n: number) => void }) {
  if (!qty)
    return (
      <button aria-label="Add" disabled={max === 0} onClick={(e) => { e.stopPropagation(); onChange(1); }} className="grid h-9 w-9 place-items-center rounded-full bg-z text-z-ink transition active:scale-90 disabled:bg-raised disabled:text-dim">
        <Plus size={18} />
      </button>
    );
  return (
    <div className="flex items-center rounded-full bg-z text-z-ink">
      <button aria-label="Less" onClick={() => onChange(qty - 1)} className="grid h-9 w-9 place-items-center"><Minus size={16} /></button>
      <span className="w-5 text-center text-sm font-bold nums">{qty}</span>
      <button aria-label="More" disabled={max !== undefined && qty >= max} onClick={() => onChange(qty + 1)} className="grid h-9 w-9 place-items-center disabled:opacity-40"><Plus size={16} /></button>
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Close" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="a-up relative max-h-[90%] w-full max-w-lg overflow-y-auto rounded-t-[28px] border border-line bg-panel pb-safe md:rounded-[28px]">
        <div className="gutter flex items-center justify-between pb-2 pt-5">
          <h2 className="text-lg font-bold">{title}</h2>
          <button aria-label="Close" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/5"><X size={18} /></button>
        </div>
        <div className="gutter pb-6">{children}</div>
      </div>
    </div>
  );
}

export function Toast() {
  const t = useApp((s) => s.toast);
  if (!t) return null;
  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex justify-center gutter md:bottom-8">
      <div className="a-up max-w-sm rounded-2xl border border-z/30 bg-raised px-4 py-3 text-sm font-medium shadow-lift">{t}</div>
    </div>
  );
}

export function Empty({ title, body, action, icon = 'Sparkles' }: { title: string; body: string; action?: ReactNode; icon?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-z-soft text-z"><Icon name={icon} size={24} /></span>
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="max-w-xs text-sm text-mute">{body}</p>
      {action}
    </div>
  );
}

export const Block = ({ title, label, action, children }: { title: string; label?: string; action?: ReactNode; children: ReactNode }) => (
  <section className="flex flex-col gap-4">
    <div className="flex items-end justify-between gap-3">
      <div>{label && <div className="label mb-1">{label}</div>}<h2 className="text-xl font-bold tracking-tight">{title}</h2></div>
      {action}
    </div>
    {children}
  </section>
);

export const Metric = ({ label, value, hint, hot }: { label: string; value: ReactNode; hint?: ReactNode; hot?: boolean }) => (
  <div className={`flex min-w-0 flex-col gap-1.5 rounded-[22px] border p-4 ${hot ? 'border-z/30 bg-gradient-to-br from-z/20 to-transparent' : 'border-line bg-panel'}`}>
    <span className="label">{label}</span>
    <span className="text-[28px] font-extrabold tracking-tight nums">{value}</span>
    {hint && <span className="text-xs text-mute">{hint}</span>}
  </div>
);

export function Face({ media, size = 56, ring, alt = '' }: { media: string; size?: number; ring?: boolean | 'seen'; alt?: string }) {
  return (
    <span className={`inline-grid shrink-0 place-items-center rounded-full p-[2.5px] ${ring === true ? 'ring-z' : ring === 'seen' ? 'bg-line-2' : ''}`} style={{ width: size, height: size }}>
      <span className="block h-full w-full overflow-hidden rounded-full border-2 border-bg bg-raised"><img src={img(media)} alt={alt} loading="lazy" className="h-full w-full object-cover" /></span>
    </span>
  );
}

export const Pic = ({ media, alt = '', className = '' }: { media: string; alt?: string; className?: string }) => (
  <img src={img(media)} alt={alt} loading="lazy" className={`bg-raised object-cover ${className}`} />
);

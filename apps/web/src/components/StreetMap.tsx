import { LocateFixed, Minus, Plus } from 'lucide-react';
import { useMemo, useRef, useState, type PointerEvent } from 'react';
import { CATEGORIES, type LatLng, type Vendor } from '@zeeto/core';
import { img } from '../lib/media';

/**
 * Offline street map of Kalbadevi drawn in SVG (no tiles, no key).
 * Same props as the Mapbox version planned in docs/spec/INTEGRATIONS.md, so swapping is one import.
 */
export interface MapProps { vendors: Vendor[]; me: LatLng; selected: string | null; onSelect: (id: string | null) => void; hidden?: Set<string> }

const STREETS: { name?: string; big?: boolean; pts: [number, number][] }[] = [
  { name: 'Kalbadevi Rd', big: true, pts: [[18.9462, 72.8285], [18.949, 72.8303], [18.9515, 72.8318], [18.954, 72.833]] },
  { name: 'Bhuleshwar Rd', big: true, pts: [[18.9535, 72.8288], [18.9526, 72.8316], [18.952, 72.8352]] },
  { name: 'Princess St', big: true, pts: [[18.947, 72.827], [18.9478, 72.832], [18.9483, 72.836]] },
  { name: 'Mumbadevi Rd', pts: [[18.9505, 72.8282], [18.951, 72.831], [18.9513, 72.835]] },
  { name: 'Sheikh Memon St', pts: [[18.9468, 72.8338], [18.949, 72.8333], [18.9516, 72.8329], [18.954, 72.8322]] },
  { name: 'Zaveri Bazaar', pts: [[18.9478, 72.835], [18.95, 72.834], [18.9506, 72.8325]] },
  { pts: [[18.9495, 72.8282], [18.95, 72.835]] },
  { pts: [[18.9522, 72.8282], [18.9526, 72.8352]] },
  { pts: [[18.9462, 72.831], [18.954, 72.8303]] },
];

export default function StreetMap({ vendors, me, selected, onSelect, hidden }: MapProps) {
  const box = useMemo(() => {
    const la = [...vendors.map((v) => v.location.lat), me.lat];
    const ln = [...vendors.map((v) => v.location.lng), me.lng];
    const p = 0.0012;
    return { a: Math.min(...la) - p, b: Math.max(...la) + p, c: Math.min(...ln) - p, d: Math.max(...ln) + p };
  }, [vendors, me]);
  const xy = (lat: number, lng: number) => ({ x: ((lng - box.c) / (box.d - box.c)) * 100, y: (1 - (lat - box.a) / (box.b - box.a)) * 100 });

  const [view, setView] = useState({ s: 1, x: 0, y: 0 });
  const drag = useRef<{ px: number; py: number; x: number; y: number; moved: boolean } | null>(null);
  const down = (e: PointerEvent) => { drag.current = { px: e.clientX, py: e.clientY, x: view.x, y: view.y, moved: false }; };
  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.px, dy = e.clientY - d.py;
    if (Math.abs(dx) + Math.abs(dy) > 4) { d.moved = true; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); }
    if (d.moved) setView((v) => ({ ...v, x: d.x + dx, y: d.y + dy }));
  };
  const up = () => { const d = drag.current; drag.current = null; if (d && !d.moved) onSelect(null); };
  const zoom = (f: number) => setView((v) => ({ ...v, s: Math.min(3, Math.max(1, v.s * f)) }));
  const u = xy(me.lat, me.lng);
  const k = 1 / view.s;

  return (
    <div className="relative h-full w-full touch-none select-none overflow-hidden bg-[#0E0F0E]">
      <div className="absolute inset-0 cursor-grab active:cursor-grabbing" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => (drag.current = null)}>
        <div className="absolute inset-0 transition-transform duration-150" style={{ transform: `translate(${view.x}px,${view.y}px) scale(${view.s})` }}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
            {Array.from({ length: 42 }).map((_, i) => <rect key={i} x={3 + (i % 7) * 14} y={3 + Math.floor(i / 7) * 16.5} width={11} height={13} rx={1.2} fill="#151715" />)}
            {STREETS.map((s, i) => (
              <polyline key={i} points={s.pts.map(([a, b]) => { const p = xy(a, b); return `${p.x},${p.y}`; }).join(' ')} fill="none" stroke={s.big ? '#2B2E2B' : '#1E211E'} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{ strokeWidth: s.big ? 10 : 5 }} />
            ))}
          </svg>
          {STREETS.filter((s) => s.name).map((s) => {
            const m = s.pts[Math.floor(s.pts.length / 2)];
            const p = xy(m[0], m[1]);
            return <span key={s.name} className="pointer-events-none absolute whitespace-nowrap font-mono text-[9px] uppercase tracking-wider text-dim" style={{ left: `${p.x}%`, top: `${p.y}%`, transform: `translate(-50%,-50%) scale(${k})` }}>{s.name}</span>;
          })}
          <div className="pointer-events-none absolute" style={{ left: `${u.x}%`, top: `${u.y}%`, transform: `translate(-50%,-50%) scale(${k})` }}>
            <span className="absolute inset-0 rounded-full bg-[#4F8CFF]" style={{ animation: 'ping-ring 2s ease-out infinite' }} />
            <span className="relative block h-4 w-4 rounded-full border-[3px] border-white bg-[#4F8CFF]" />
          </div>
          {vendors.map((v) => {
            const p = xy(v.location.lat, v.location.lng);
            const on = v.id === selected;
            return (
              <button
                key={v.id}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onSelect(v.id)}
                aria-label={`${v.name}, ${CATEGORIES[v.category].label}${v.fresh ? ', fresh today' : ''}`}
                className={`absolute flex flex-col items-center transition-opacity ${hidden?.has(v.id) ? 'opacity-20' : ''}`}
                style={{ left: `${p.x}%`, top: `${p.y}%`, transform: `translate(-50%,-100%) scale(${(on ? 1.2 : 1) * k})`, transformOrigin: '50% 100%', zIndex: on ? 20 : 10 }}
              >
                {on && <span className="mb-1.5 whitespace-nowrap rounded-full bg-z px-2.5 py-1 text-[11px] font-bold text-z-ink shadow-glow">{v.name}</span>}
                <span className={`relative block h-11 w-11 rounded-full p-[2px] shadow-lift ${on ? 'bg-z' : 'bg-[#3A3D3A]'}`}>
                  <img src={img(v.avatar)} alt="" className="h-full w-full rounded-full border-2 border-bg object-cover" />
                  {v.fresh && <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-bg bg-good" />}
                </span>
                <span className={`-mt-1 h-2.5 w-2.5 rotate-45 ${on ? 'bg-z' : 'bg-[#3A3D3A]'}`} />
              </button>
            );
          })}
        </div>
      </div>
      <div className="absolute right-3 top-1/2 flex -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-line bg-panel/90 backdrop-blur">
        <button aria-label="Zoom in" onClick={() => zoom(1.4)} className="grid h-10 w-10 place-items-center border-b border-line"><Plus size={18} /></button>
        <button aria-label="Zoom out" onClick={() => zoom(1 / 1.4)} className="grid h-10 w-10 place-items-center border-b border-line"><Minus size={18} /></button>
        <button aria-label="Recenter" onClick={() => setView({ s: 1, x: 0, y: 0 })} className="grid h-10 w-10 place-items-center"><LocateFixed size={18} /></button>
      </div>
    </div>
  );
}

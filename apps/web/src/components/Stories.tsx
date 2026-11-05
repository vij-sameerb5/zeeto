import { ChevronRight, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { STORIES, VENDORS, ago, type Story } from '@zeeto/core';
import { img } from '../lib/media';
import { useApp } from '../store';
import { Face } from './kit';

const MS = 5000;

/** Story rail: stalls you follow first; a seen story loses its orange ring. */
export function StoryRail() {
  const follows = useApp((s) => s.follows);
  const [open, setOpen] = useState<number | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const list = [...STORIES].sort((a, b) => Number(follows.includes(b.vendorId)) - Number(follows.includes(a.vendorId)));
  const mark = (id: string) => setSeen((s) => (s.includes(id) ? s : [...s, id]));
  return (
    <>
      <div className="no-bar -mx-4 flex gap-3.5 overflow-x-auto px-4 py-1">
        {list.map((s, i) => {
          const v = VENDORS.find((x) => x.id === s.vendorId)!;
          return (
            <button key={s.id} onClick={() => { setOpen(i); mark(s.id); }} aria-label={`${v.name} story`} className="flex w-[68px] shrink-0 flex-col items-center gap-1.5">
              <Face media={v.avatar} size={66} ring={seen.includes(s.id) ? 'seen' : true} />
              <span className="w-full truncate text-center text-[11px] text-mute">{v.name.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>
      {open !== null && <Viewer list={list} start={open} onClose={() => setOpen(null)} onSeen={mark} />}
    </>
  );
}

function Viewer({ list, start, onClose, onSeen }: { list: Story[]; start: number; onClose: () => void; onSeen: (id: string) => void }) {
  const [i, setI] = useState(start);
  const nav = useNavigate();
  const s = list[i];
  const v = VENDORS.find((x) => x.id === s.vendorId)!;
  const next = () => (i < list.length - 1 ? setI(i + 1) : onClose());

  useEffect(() => {
    onSeen(s.id);
    const t = window.setTimeout(next, MS);
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener('keydown', k);
    return () => { window.clearTimeout(t); window.removeEventListener('keydown', k); };
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div role="dialog" aria-modal="true" aria-label={`${v.name} story`} className="fixed inset-0 z-[80] grid place-items-center bg-black/95">
      <div className="relative h-full w-full max-w-[440px] overflow-hidden md:h-[86vh] md:rounded-[28px]">
        <img key={s.id} src={img(s.media)} alt="" className="a-up absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/85" />
        <div className="absolute inset-x-3 top-3 flex gap-1 pt-safe">
          {list.map((x, j) => (
            <span key={x.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
              <span key={`${x.id}-${i}`} className="block h-full bg-white" style={j < i ? { width: '100%' } : j === i ? { animation: `bar ${MS}ms linear forwards` } : { width: 0 }} />
            </span>
          ))}
        </div>
        <div className="absolute inset-x-4 top-8 flex items-center gap-2.5 pt-safe">
          <Face media={v.avatar} size={36} />
          <div className="min-w-0 flex-1 text-sm"><b>{v.name}</b> <span className="text-white/60">{ago(s.at)}</span></div>
          <button aria-label="Close" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-black/30"><X size={20} /></button>
        </div>
        <button aria-label="Previous" className="absolute inset-y-0 left-0 w-1/3" onClick={() => setI(Math.max(0, i - 1))} />
        <button aria-label="Next" className="absolute inset-y-0 right-0 w-2/3" onClick={next} />
        <div className="absolute inset-x-4 bottom-6 flex flex-col gap-4 pb-safe">
          <p className="text-3xl font-extrabold leading-tight tracking-tight">{s.text}</p>
          <button onClick={() => { onClose(); nav(`/s/${v.id}`); }} className="btn-z w-full justify-between">Shop {v.name} <ChevronRight size={18} /></button>
        </div>
      </div>
    </div>
  );
}

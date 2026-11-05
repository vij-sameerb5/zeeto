import 'mapbox-gl/dist/mapbox-gl.css';
import mapboxgl from 'mapbox-gl';
import { useEffect, useRef } from 'react';
import { CATEGORIES } from '@zeeto/core';
import { img } from '../lib/media';
import type { MapProps } from './StreetMap';

/** Real Mapbox map with the same props as the offline StreetMap, so Explore swaps one for the other. */
export default function MapboxMap({ vendors, me, selected, onSelect, hidden }: MapProps) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const pins = useRef(new Map<string, { m: mapboxgl.Marker; el: HTMLButtonElement }>());
  const pick = useRef(onSelect);
  pick.current = onSelect;

  useEffect(() => {
    if (!box.current) return;
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN!;
    const m = new mapboxgl.Map({
      container: box.current,
      style: import.meta.env.VITE_MAPBOX_STYLE || 'mapbox://styles/mapbox/dark-v11',
      center: [me.lng, me.lat],
      zoom: 15.5,
      attributionControl: true,
    });
    map.current = m;
    m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'right');
    m.on('click', () => pick.current(null));

    const you = document.createElement('div');
    you.className = 'h-4 w-4 rounded-full border-[3px] border-white bg-[#4F8CFF] shadow-lift';
    new mapboxgl.Marker({ element: you }).setLngLat([me.lng, me.lat]).addTo(m);

    vendors.forEach((v) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.setAttribute('aria-label', `${v.name}, ${CATEGORIES[v.category].label}`);
      el.className = 'relative block h-11 w-11 rounded-full bg-[#3A3D3A] p-[2px] shadow-lift transition-transform';
      const pic = document.createElement('img');
      pic.src = img(v.avatar);
      pic.alt = '';
      pic.className = 'h-full w-full rounded-full border-2 border-[#0A0A0A] object-cover';
      el.appendChild(pic);
      if (v.fresh) {
        const dot = document.createElement('span');
        dot.className = 'absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#0A0A0A] bg-[#3DD68C]';
        el.appendChild(dot);
      }
      el.addEventListener('click', (e) => { e.stopPropagation(); pick.current(v.id); });
      pins.current.set(v.id, { m: new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat([v.location.lng, v.location.lat]).addTo(m), el });
    });

    const b = new mapboxgl.LngLatBounds();
    vendors.forEach((v) => b.extend([v.location.lng, v.location.lat]));
    b.extend([me.lng, me.lat]);
    m.fitBounds(b, { padding: { top: 170, bottom: 220, left: 40, right: 40 }, maxZoom: 16.5, duration: 0 });

    return () => { pins.current.clear(); m.remove(); map.current = null; };
  }, [vendors, me]);

  useEffect(() => {
    pins.current.forEach(({ el }, id) => {
      const on = id === selected;
      el.style.opacity = hidden?.has(id) ? '0.2' : '1';
      el.style.transform = on ? 'scale(1.2)' : '';
      el.style.background = on ? '#FF7A1A' : '#3A3D3A';
      el.style.zIndex = on ? '20' : '';
    });
    const v = vendors.find((x) => x.id === selected);
    if (v && map.current) map.current.easeTo({ center: [v.location.lng, v.location.lat], duration: 400 });
  }, [selected, hidden, vendors]);

  return <div ref={box} className="h-full w-full" />;
}

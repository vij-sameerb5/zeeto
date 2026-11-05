import { FX } from './chain';
import type { LatLng, Unit } from './types';

export const toUsd = (inr: number) => Math.round((inr / FX.inrPerUsd) * 100) / 100;
export const toEth = (usd: number) => usd / FX.usdPerEth;
export const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
export const usd = (n: number, token: string) => `${n.toFixed(2)} ${token}`;
export const eth = (n: number) => `${n.toFixed(5)} ETH`;
export const short = (h: string) => (h.length > 12 ? `${h.slice(0, 6)}…${h.slice(-4)}` : h);

/** 1 point for every ₹10. */
export const pointsFor = (amountInr: number) => Math.floor(amountInr / 10);

export const UNITS: Record<Unit, string> = { kg: 'kg', piece: 'pc', bunch: 'bunch', cup: 'cup', plate: 'plate', dozen: 'dozen', '250g': '250 g', service: 'job' };

export function km(a: LatLng, b: LatLng) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
export const distance = (k: number) => (k < 1 ? `${Math.round(k * 1000)} m` : `${k.toFixed(1)} km`);

export function ago(iso: string) {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

export const hex = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
export const fakeTx = () => `0x${hex(64)}` as `0x${string}`;
export function pickupCode() {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const c = () => L[Math.floor(Math.random() * L.length)];
  return `${c()}${c()}-${100 + Math.floor(Math.random() * 900)}`;
}

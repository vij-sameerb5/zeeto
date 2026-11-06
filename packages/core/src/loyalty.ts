import type { Order, PointsEntry } from './types';

/**
 * Loyalty is per stall, like a paper stamp card at each shop:
 *  - Points: ₹10 spent = 1 point, earned at a stall and spent ONLY at that same stall, on that stall's own rewards.
 *    A stall pays for its rewards, so another stall's points can never be used there.
 *  - Visits: every paid order (not refunded) at that stall counts as one visit. Both the customer and the stall see it.
 *  - Tier comes from visits at that stall: New → Regular (3) → Favourite (8) → Family (20).
 * Zeeto runs the cards for every stall; each stall's card is separate.
 */
export const VISIT_TIERS = [
  { name: 'New', at: 0 },
  { name: 'Regular', at: 3 },
  { name: 'Favourite', at: 8 },
  { name: 'Family', at: 20 },
] as const;

const COUNTED: Order['status'][] = ['paid', 'accepted', 'ready', 'done', 'part-refunded'];

export const tierFor = (visits: number) => [...VISIT_TIERS].reverse().find((t) => visits >= t.at)!;
export const nextTier = (visits: number) => VISIT_TIERS.find((t) => t.at > visits);

/** Points balance at one stall. */
export const stallPoints = (entries: PointsEntry[], vendorId: string) =>
  entries.filter((e) => e.vendorId === vendorId).reduce((s, e) => s + e.points, 0);

/** Visits by one customer at one stall, from their orders. */
export const visitsAt = (orders: Order[], vendorId: string) => orders.filter((o) => o.vendorId === vendorId && COUNTED.includes(o.status)).length;

/** For the stall: how many times this customer has paid here (including this order). */
export const customerVisits = (stallOrders: Order[], o: Order) =>
  o.visits ?? stallOrders.filter((x) => x.vendorId === o.vendorId && x.customer === o.customer && COUNTED.includes(x.status) && x.at <= o.at).length;

export interface StallCard { vendorId: string; points: number; visits: number; tier: string; next?: { name: string; at: number } }

/** One loyalty card per stall the customer has a history with, most points first. */
export function loyaltyCards(entries: PointsEntry[], orders: Order[]): StallCard[] {
  const ids = [...new Set([...entries.map((e) => e.vendorId), ...orders.filter((o) => COUNTED.includes(o.status)).map((o) => o.vendorId)].filter((x): x is string => !!x))];
  return ids.map((id) => {
    const visits = Math.max(visitsAt(orders, id), entries.some((e) => e.vendorId === id) ? 1 : 0);
    const t = tierFor(visits);
    const n = nextTier(visits);
    return { vendorId: id, points: stallPoints(entries, id), visits, tier: t.name, next: n ? { name: n.name, at: n.at } : undefined };
  }).sort((a, b) => b.points - a.points);
}

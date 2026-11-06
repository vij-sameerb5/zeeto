import { randomBytes, randomInt } from 'node:crypto';
import { keccak256, toHex, type Hex } from 'viem';

/** Same constants as packages/core (kept here so the server bundle stays inside apps/web). */
export const WHITECHAIN = { id: 1874, explorer: 'https://explorer.testnet.whitechain.io' } as const;
export const USDT = '0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7' as const;
export const INR_PER_USD = 84;
export const MAX_ORDER_INR = 20000;
export const REQUEST_TTL_MS = 5 * 60_000;
/** A signed payment authorization is valid for this long. */
export const AUTH_TTL_S = 10 * 60;

export const toUsd = (inr: number) => Math.round((inr / INR_PER_USD) * 100) / 100;
/** USDT base units, rounded to the cent like the app shows. */
export const units = (usd: number) => BigInt(Math.round(usd * 100)) * 10_000n;
/** Same formula as apps/web/src/lib/pay.ts so the client and server agree on the reference. */
export const orderRef = (orderId: string, vendorId: string): Hex => keccak256(toHex(`zeeto:${orderId}:${vendorId}:${WHITECHAIN.id}`));
export const refundRef = (orderId: string, vendorId: string, n: number): Hex => keccak256(toHex(`zeeto:${orderId}:${vendorId}:${WHITECHAIN.id}:refund:${n}`));

const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const pickupCode = () => `${L[randomInt(L.length)]}${L[randomInt(L.length)]}-${randomInt(100, 1000)}`;
export const newId = (prefix: string, bytes = 6) => `${prefix}${randomBytes(bytes).toString('hex')}`;
export const pointsFor = (inr: number) => Math.floor(inr / 10);

export const UNITS = ['kg', 'piece', 'bunch', 'cup', 'plate', 'dozen', '250g', 'service'] as const;
export const CATEGORIES = ['vegetables', 'fruits', 'kirana', 'dairy', 'bakery', 'spices', 'fish', 'chai', 'street-food', 'sweets', 'south-indian', 'pharmacy', 'electrical', 'hardware', 'mobile', 'stationery', 'books', 'flowers', 'tailor', 'salon'] as const;

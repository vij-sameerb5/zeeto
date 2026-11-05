// Zeeto domain model, shared by apps/web, apps/mobile and (later) apps/api.

export type ID = string;
export type ISODate = string;
export type Hex = `0x${string}`;

export type Category =
  | 'vegetables' | 'fruits' | 'kirana' | 'dairy' | 'bakery' | 'spices' | 'fish'
  | 'chai' | 'street-food' | 'sweets' | 'south-indian'
  | 'pharmacy' | 'electrical' | 'hardware' | 'mobile' | 'stationery' | 'books'
  | 'flowers' | 'tailor' | 'salon';

export type CategoryGroup = 'food' | 'groceries' | 'health' | 'home' | 'services' | 'shopping';

export interface LatLng { lat: number; lng: number }

/** Two settlement rails. No bridge between them. */
export type RailId = 'uniswap-usdc' | 'streetpay-usdt';

export interface Rail {
  id: RailId;
  label: string;
  blurb: string;
  token: 'USDC' | 'USDT';
  network: string;
  chainId: number;
  txUrl: (hash: string) => string;
}

export interface Vendor {
  id: ID;
  name: string;
  owner: string;
  category: Category;
  tagline: string;
  bio: string;
  location: LatLng;
  landmark: string;
  market: string;
  hours: string; // "07:00-21:00"
  rating: number;
  followers: number;
  verified: boolean;
  rails: RailId[];
  wallet: Hex;
  languages: string[];
  fresh: boolean;
  offer?: string;
  /** Media keys. Each app maps a key to its own bundled file. */
  avatar: string;
  cover: string;
  photos: string[];
  youtube: string[];
}

export type Unit = 'kg' | 'piece' | 'bunch' | 'cup' | 'plate' | 'dozen' | '250g' | 'service';

export interface Product {
  id: ID;
  vendorId: ID;
  name: string;
  local?: string;
  unit: Unit;
  priceInr: number;
  stock: number;
  image: string;
  freshUntil?: ISODate;
  byAi?: boolean;
}

export interface Post {
  id: ID;
  vendorId: ID;
  media: string[];
  caption: string;
  likes: number;
  comments: number;
  at: ISODate;
  tag?: 'fresh' | 'offer';
  productIds: ID[];
}

export interface Story { id: ID; vendorId: ID; media: string; text: string; at: ISODate }

export type OrderStatus = 'paying' | 'paid' | 'ready' | 'done' | 'refunded' | 'part-refunded';

export interface OrderLine { productId: ID; name: string; unit: Unit; qty: number; priceInr: number }

export interface Payment {
  rail: RailId;
  paidToken: 'ETH' | 'USDT';
  paidAmount: number;
  settled: number;
  settledToken: 'USDC' | 'USDT';
  chainId: number;
  tx: Hex;
  quoteId?: string;
  at: ISODate;
  simulated: boolean;
}

export interface Refund { amount: number; token: 'USDC' | 'USDT'; reason: string; tx: Hex; at: ISODate; simulated: boolean }

export interface Order {
  id: ID;
  code: string; // pickup code, e.g. "KM-412"
  customer: string;
  vendorId: ID;
  lines: OrderLine[];
  inr: number;
  usd: number;
  status: OrderStatus;
  at: ISODate;
  payment?: Payment;
  refunds: Refund[];
  points: number;
}

export interface Alert {
  id: ID;
  vendorId: ID;
  title: string;
  body: string;
  translations: Record<string, string>;
  productIds: ID[];
  at: ISODate;
  aiRequestId?: string;
}

export interface PointsEntry { id: ID; points: number; label: string; at: ISODate; vendorId?: ID }

export interface Quote {
  id: string;
  ethIn: number;
  usdcOut: number;
  impactPct: number;
  gasUsd: number;
  route: string;
  simulated: boolean;
}

export interface AiRun { requestId: string; model: string; ms: number; at: ISODate; simulated: boolean }

export interface AiDraft {
  run: AiRun;
  items: { name: string; local?: string; unit: Unit; priceInr: number; qty: number; confidence: number }[];
  alert: { title: string; body: string; translations: Record<string, string> };
}

export interface Balance { token: 'ETH' | 'USDC' | 'USDT' | 'WBT'; amount: number; network: string }

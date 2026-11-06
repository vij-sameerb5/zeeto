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
  /** Where customers' payments go. */
  wallet: Hex;
  /** True only when `wallet` is a real wallet the owner controls (a stall created with Privy). Demo stalls are false, so real money is never sent to them. */
  payoutReal?: boolean;
  /** Privy user id of the owner, for stalls created in the app. */
  ownerId?: string;
  /** Live stall that is closed for orders right now. */
  closed?: boolean;
  /** Arkiv entity for the stall's public record. */
  arkivKey?: string | null;
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

/**
 * paying → paid (verified onchain) → accepted → ready → done.
 * A stall can reject a paid order, which refunds it.
 */
export type OrderStatus = 'paying' | 'paid' | 'accepted' | 'ready' | 'done' | 'refunded' | 'part-refunded' | 'expired';

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
  /** Real payments: payer and stall wallets, block, and the order reference written into the transfer. */
  from?: Hex;
  to?: Hex;
  block?: number;
  memo?: Hex;
  /** Customer signed only; Zeeto's relayer paid the network fee (EIP-3009). */
  gasless?: boolean;
  /** Arkiv receipt entity key. */
  arkiv?: string | null;
}

export interface Refund { amount: number; token: 'USDC' | 'USDT'; reason: string; tx: Hex; at: ISODate; simulated: boolean; units?: string; arkiv?: string | null }

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
  /** Wallet that paid, so a refund can go back to it. */
  payer?: Hex;
  /** Counter sale (scan & pay at the stall): done the moment it's paid. */
  counter?: boolean;
  /** Customer tapped "I'm at the stall". */
  arrivedAt?: ISODate;
  /** Customer asked to cancel before the stall accepted. The stall refunds it. */
  cancelAsked?: boolean;
  /** Lives on the Zeeto server (a real stall); every change goes through the API. */
  server?: boolean;
  /** For the stall: how many paid visits this customer has made here (server orders). */
  visits?: number;
  /** USDT base units and the onchain order reference (server orders). */
  amount?: string;
  orderRef?: Hex;
  arkivKey?: string;
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

/** What the API hands the customer's wallet before it signs (docs/ARCHITECTURE.md §5). */
export interface PaymentIntent {
  orderId: ID;
  /** keccak256(orderId, vendorId, chainId) in the real API; random in the mock. */
  orderRef: Hex;
  contract: Hex | '';
  token: Hex;
  merchant: Hex;
  /** USDT base units (6 decimals) as a string, so no float rounding. */
  amount: string;
  chainId: number;
  expiresAt: ISODate;
  /** EIP-712 signature by the API's signer over (orderRef, payer, merchant, amount, expiresAt). See contracts/README.md. */
  signature?: Hex;
  simulated: boolean;
}

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

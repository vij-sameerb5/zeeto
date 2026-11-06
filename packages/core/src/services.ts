import { ADDRESSES, RAILS } from './chain';
import type { AiDraft, Balance, Hex, Order, Payment, PaymentIntent, Quote, Refund } from './types';
import { fakeTx, hex, toEth } from './utils';

/**
 * The only door between the UI and the outside world.
 * `mock*` run offline today. Each gets a real twin as its integration lands:
 *   payments.quote/payEth  → Uniswap API on Unichain Sepolia
 *   payments.payStreetPay  → StreetPayCheckout on Whitechain Testnet
 *   ai.snap / ai.voice     → 0G Private Computer
 */
export interface Payments {
  /** Step 1: the API prices the order in USDT and fixes an order reference. */
  intent(order: Order, merchant: Hex): Promise<PaymentIntent>;
  quote(usdcOut: number): Promise<Quote>;
  payEth(order: Order, q: Quote): Promise<Payment>;
  payStreetPay(order: Order): Promise<Payment>;
  refund(order: Order, amount: number, reason: string): Promise<Refund>;
  balances(): Promise<Balance[]>;
}

export interface Ai {
  snap(photo: Blob | null): Promise<AiDraft>;
  voice(audio: Blob | null, transcript?: string): Promise<AiDraft>;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const mockPayments: Payments = {
  async intent(order, merchant) {
    await wait(350);
    return {
      orderId: order.id,
      orderRef: `0x${hex(64)}`,
      contract: ADDRESSES.streetPay as Hex | '',
      token: ADDRESSES.usdtWhitechain as Hex,
      merchant,
      amount: String(Math.round(order.usd * 1_000_000)),
      chainId: RAILS['streetpay-usdt'].chainId,
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      simulated: true,
    };
  },
  async quote(usdcOut) {
    await wait(600);
    return { id: `q_${hex(8)}`, ethIn: toEth(usdcOut) * 1.003, usdcOut, impactPct: 0.04, gasUsd: 0.02, route: 'ETH → USDC · v4 · 0.30%', simulated: true };
  },
  async payEth(order, q) {
    await wait(1500);
    return { rail: 'uniswap-usdc', paidToken: 'ETH', paidAmount: q.ethIn, settled: order.usd, settledToken: 'USDC', chainId: RAILS['uniswap-usdc'].chainId, tx: fakeTx(), quoteId: q.id, at: new Date().toISOString(), simulated: true };
  },
  async payStreetPay(order) {
    await wait(1300);
    return { rail: 'streetpay-usdt', paidToken: 'USDT', paidAmount: order.usd, settled: order.usd, settledToken: 'USDT', chainId: RAILS['streetpay-usdt'].chainId, tx: fakeTx(), at: new Date().toISOString(), simulated: true };
  },
  async refund(order, amount, reason) {
    await wait(900);
    return { amount, token: order.payment?.settledToken ?? 'USDT', reason, tx: fakeTx(), at: new Date().toISOString(), simulated: true };
  },
  async balances() {
    await wait(150);
    return [
      { token: 'USDT', amount: 25, network: 'Whitechain Testnet' },
      { token: 'WBT', amount: 0.8, network: 'Whitechain Testnet' },
      { token: 'ETH', amount: 0.0421, network: 'Unichain Sepolia' },
      { token: 'USDC', amount: 12.5, network: 'Unichain Sepolia' },
    ];
  },
};

const SAMPLES: Omit<AiDraft, 'run'>[] = [
  {
    items: [{ name: 'Alphonso mangoes', local: 'हापूस आंबा', unit: 'dozen', priceInr: 480, qty: 6, confidence: 0.91 }],
    alert: { title: 'Alphonso mangoes just arrived', body: 'Fresh Ratnagiri Alphonso, only 6 dozen. Reserve yours.', translations: { Hindi: 'ताज़े रत्नागिरी हापुस आम आए हैं, सिर्फ़ 6 दर्जन।', Marathi: 'ताजे रत्नागिरी हापूस आले आहेत, फक्त ६ डझन.' } },
  },
  {
    items: [
      { name: 'Cauliflower', local: 'फूलगोभी', unit: 'piece', priceInr: 35, qty: 15, confidence: 0.88 },
      { name: 'Green peas', local: 'मटार', unit: 'kg', priceInr: 80, qty: 10, confidence: 0.84 },
    ],
    alert: { title: 'Winter vegetables are in', body: 'Fresh cauliflower and green peas today. Good for pav bhaji.', translations: { Hindi: 'आज ताज़ी फूलगोभी और मटर आई है।', Marathi: 'आज ताजी फ्लॉवर आणि मटार आली आहे.' } },
  },
];
let n = 0;
const run = (model: string, t0: number) => ({ requestId: `mock-${hex(10)}`, model, ms: Date.now() - t0, at: new Date().toISOString(), simulated: true });

export const mockAi: Ai = {
  async snap() {
    const t0 = Date.now();
    await wait(1700);
    return { ...SAMPLES[n++ % SAMPLES.length], run: run('sample photo (AI off)', t0) };
  },
  async voice(_a, transcript) {
    const t0 = Date.now();
    await wait(1400);
    return {
      items: [{ name: 'Tomatoes', local: 'टोमॅटो', unit: 'kg', priceInr: 30, qty: 20, confidence: 0.93 }],
      alert: { title: 'Tomatoes restocked', body: `${transcript ? `"${transcript}" · ` : ''}20 kg tomatoes tomorrow morning.`, translations: { Hindi: 'कल सुबह 20 किलो टमाटर मिलेंगे।', Marathi: 'उद्या सकाळी २० किलो टोमॅटो मिळतील.' } },
      run: run('sample (AI off)', t0),
    };
  },
};

import type { EIP1193Provider } from '@privy-io/react-auth';
import { concatHex, createWalletClient, custom, decodeEventLog, encodeFunctionData, erc20Abi, keccak256, toHex, type Address, type Hex } from 'viem';
import { ADDRESSES, CHAINS, RAILS, mockPayments, type Order, type Payment, type PaymentIntent, type Refund, type Vendor } from '@zeeto/core';
import { publicClient, whitechain } from './chain';
import { api } from './api';

const USDT = ADDRESSES.usdtWhitechain as Address;
const DECIMALS = 6;

export type PayStep = 'check' | 'sign' | 'send' | 'verify' | 'idle' | 'done' | 'failed';

/** Thrown with a message a customer can act on. */
export class PayError extends Error {
  constructor(message: string, public fix?: { label: string; href: string }) { super(message); }
}

/** USDT base units, rounded to the cent so the stall gets exactly what the screen showed. */
export const usdtUnits = (usd: number) => BigInt(Math.round(usd * 100)) * 10n ** BigInt(DECIMALS - 2);

/** The order reference written into the transfer, so anyone can match the payment to the order onchain. */
export const orderRef = (orderId: string, vendorId: string): Hex => keccak256(toHex(`zeeto:${orderId}:${vendorId}:${CHAINS.whitechain.id}`));

/** Can this payment be real? Only when the payer has a wallet and the stall has a wallet its owner controls. */
export const canPayReal = (v: Vendor, payer: Hex | null) => !!payer && !!v.payoutReal && v.wallet.toLowerCase() !== payer.toLowerCase();

/**
 * Real payment: a USDT transfer on Whitechain straight to the stall's wallet, like paying a merchant's UPI id.
 * The order reference rides along after the transfer arguments (ERC-20 ignores extra calldata), then we read the
 * receipt and only accept it if the Transfer event shows this payer, this stall and exactly this amount.
 * Demo-only path for stalls made without the server. Real stalls pay through ZeetoCheckout (signAndSettle below).
 */
export async function transferUsdt(opts: { provider: EIP1193Provider; from: Hex; to: Hex; usd: number; ref: Hex; onStep: (s: PayStep) => void }): Promise<{ hash: Hex; block: number; amount: bigint }> {
  const { provider, from, to, usd, ref, onStep } = opts;
  const amount = usdtUnits(usd);
  if (amount <= 0n) throw new PayError('Amount is zero.');

  onStep('check');
  const [bal, gas] = await Promise.all([
    publicClient.readContract({ address: USDT, abi: erc20Abi, functionName: 'balanceOf', args: [from] }),
    publicClient.getBalance({ address: from }),
  ]);
  if (bal < amount) throw new PayError(`You have ${(Number(bal) / 1e6).toFixed(2)} test USDT. This needs ${(Number(amount) / 1e6).toFixed(2)}. Ask the Whitechain team for test USDT.`);
  if (gas === 0n) throw new PayError('You need a little test WBT for the network fee.', { label: 'Get test WBT', href: CHAINS.whitechain.faucet });

  onStep('sign');
  const wallet = createWalletClient({ account: from, chain: whitechain, transport: custom(provider) });
  const data = concatHex([encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [to, amount] }), ref]);
  let hash: Hex;
  try {
    hash = await wallet.sendTransaction({ account: from, chain: whitechain, to: USDT, data });
  } catch (e) {
    const m = (e as Error).message ?? '';
    throw new PayError(/reject|denied|cancel/i.test(m) ? 'You cancelled the payment. Nothing was sent.' : 'Your wallet couldn’t send the payment. Nothing was charged.');
  }

  onStep('send');
  const r = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 120_000 });
  onStep('verify');
  if (r.status !== 'success') throw new PayError('The payment failed on the network. Nothing was charged except the network fee.');
  const ok = r.logs.some((l) => {
    if (l.address.toLowerCase() !== USDT.toLowerCase()) return false;
    try {
      const ev = decodeEventLog({ abi: erc20Abi, data: l.data, topics: l.topics });
      return ev.eventName === 'Transfer' && ev.args.from.toLowerCase() === from.toLowerCase() && ev.args.to.toLowerCase() === to.toLowerCase() && ev.args.value === amount;
    } catch { return false; }
  });
  if (!ok) throw new PayError('We couldn’t find the right transfer in the receipt. Contact the stall with this tx: ' + hash);
  return { hash, block: Number(r.blockNumber), amount };
}

/** Pays one order: real when possible, simulated (and labelled) otherwise. Same steps either way. */
export async function payOrder(o: Order, v: Vendor, s: { address: Hex | null; provider: () => Promise<EIP1193Provider | null> }, onStep: (st: PayStep) => void, onIntent?: (i: PaymentIntent) => void): Promise<Payment> {
  const ref = orderRef(o.id, v.id);
  onIntent?.({ orderId: o.id, orderRef: ref, contract: '', token: USDT, merchant: v.wallet, amount: String(usdtUnits(o.usd)), chainId: CHAINS.whitechain.id, expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(), simulated: !canPayReal(v, s.address) });

  if (canPayReal(v, s.address)) {
    const provider = await s.provider();
    if (!provider) throw new PayError('Your wallet isn’t ready yet. Wait a moment and try again.');
    const t = await transferUsdt({ provider, from: s.address!, to: v.wallet, usd: o.usd, ref, onStep });
    const usd = Number(t.amount) / 1e6;
    return { rail: 'streetpay-usdt', paidToken: 'USDT', paidAmount: usd, settled: usd, settledToken: 'USDT', chainId: CHAINS.whitechain.id, tx: t.hash, at: new Date().toISOString(), simulated: false, from: s.address!, to: v.wallet, block: t.block, memo: ref };
  }

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  onStep('check'); await wait(350);
  onStep('sign'); await wait(500);
  onStep('send');
  const p = await mockPayments.payStreetPay(o);
  onStep('verify'); await wait(500);
  return { ...p, memo: ref };
}

/** Refund from the stall's own wallet back to the payer. Real only for real payments signed by the stall owner. */
export async function refundOrder(o: Order, usd: number, reason: string, s: { address: Hex | null; provider: () => Promise<EIP1193Provider | null> }): Promise<Refund> {
  const p = o.payment;
  if (!p) throw new PayError('This order has no payment to refund.');
  if (p.simulated) return mockPayments.refund(o, usd, reason);
  if (!s.address || !p.to || s.address.toLowerCase() !== p.to.toLowerCase()) throw new PayError('Sign in with the stall’s account to send this refund from its wallet.');
  if (!p.from) throw new PayError('We don’t know which wallet paid, so we can’t refund automatically.');
  const provider = await s.provider();
  if (!provider) throw new PayError('Your wallet isn’t ready yet.');
  const t = await transferUsdt({ provider, from: s.address, to: p.from, usd, ref: orderRef(`${o.id}:refund`, o.vendorId), onStep: () => undefined });
  return { amount: Number(t.amount) / 1e6, token: 'USDT', reason, tx: t.hash, at: new Date().toISOString(), simulated: false };
}

export const txLink = (p: Payment | Refund) => ('rail' in p ? RAILS[p.rail].txUrl(p.tx) : `${CHAINS.whitechain.explorer}/tx/${p.tx}`);

// ── Real stalls on the Zeeto server ─────────────────────────────────────────────────────────────────

/**
 * What the server asks the wallet to sign: an EIP-3009 ReceiveWithAuthorization that lets ZeetoCheckout pull exactly
 * this amount once. The stall and the order are bound inside the nonce, so nobody can redirect it.
 */
export interface ServerIntent {
  domain: { name: string; version: string; chainId: number; verifyingContract: Address };
  types: { ReceiveWithAuthorization: { name: string; type: string }[] };
  primaryType: 'ReceiveWithAuthorization';
  message: { from: Address; to: Address; value: string; validAfter: string; validBefore: string; nonce: Hex };
  call: { contract: Address; fn: 'pay' | 'refund'; orderRef: Hex; payer: Address; merchant: Address; amount: string };
  gasless: boolean;
}

type Wallet = { address: Hex | null; provider: () => Promise<EIP1193Provider | null> };

const CHECKOUT_ABI = [
  { type: 'function', name: 'pay', stateMutability: 'nonpayable', inputs: [
    { name: 'orderRef', type: 'bytes32' }, { name: 'payer', type: 'address' }, { name: 'merchant', type: 'address' }, { name: 'amount', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' }, { name: 'validBefore', type: 'uint256' }, { name: 'signature', type: 'bytes' }], outputs: [] },
  { type: 'function', name: 'refund', stateMutability: 'nonpayable', inputs: [
    { name: 'orderRef', type: 'bytes32' }, { name: 'payer', type: 'address' }, { name: 'amount', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' }, { name: 'validBefore', type: 'uint256' }, { name: 'signature', type: 'bytes' }], outputs: [] },
] as const;

const cancelled = (e: unknown) => /reject|denied|cancel|closed/i.test((e as Error)?.message ?? '');

/**
 * Main flow (gas-free): the embedded wallet signs silently, the server's relayer submits through ZeetoCheckout and pays
 * the gas, then the server checks the contract's Paid event. The payer sees "Pay ₹120", then "Paid".
 * Fallback (relayer off / over budget): the same signature, submitted by the payer's wallet to the contract.
 */
export async function signAndSettle(i: ServerIntent, s: Wallet, onStep: (st: PayStep) => void, submit: (b: Record<string, unknown>) => Promise<Order>): Promise<Order> {
  const provider = await s.provider();
  if (!provider || !s.address) throw new PayError('Your account is still getting ready. Try again in a moment.');
  if (s.address.toLowerCase() !== i.message.from.toLowerCase()) throw new PayError('You’re signed in with a different account than this order. Sign in again.');
  const wallet = createWalletClient({ account: s.address, chain: whitechain, transport: custom(provider) });

  onStep('check');
  const bal = await publicClient.readContract({ address: USDT, abi: erc20Abi, functionName: 'balanceOf', args: [s.address] });
  if (bal < BigInt(i.message.value)) {
    throw new PayError(`Your Zeeto balance is ${(Number(bal) / 1e6).toFixed(2)}, this needs ${(Number(i.message.value) / 1e6).toFixed(2)}. Top up and try again.`, { label: 'How to top up', href: '/wallet' });
  }
  onStep('sign');
  let signature: Hex;
  try {
    signature = await wallet.signTypedData({
      account: s.address, domain: i.domain, types: i.types, primaryType: i.primaryType,
      message: { ...i.message, value: BigInt(i.message.value), validAfter: BigInt(i.message.validAfter), validBefore: BigInt(i.message.validBefore) },
    });
  } catch (e) {
    throw new PayError(cancelled(e) ? 'You cancelled. Nothing was charged.' : 'We couldn’t confirm the payment. Nothing was charged.');
  }
  onStep('send');
  let relayErr: Error | null = null;
  try {
    const o = await submit({ signed: i.message, signature });
    onStep('verify');
    return o;
  } catch (e) {
    // Only fall back when the relayer itself is unavailable; every other error (bad signature, limits) is final.
    if (!['relay-off', 'budget', 'gas-spike'].includes(String((e as PayError & { code?: string }).code))) throw e;
    relayErr = e as Error;
  }
  // Fallback: submit through the contract from the payer's own wallet (needs a little WBT for gas).
  const gas = await publicClient.getBalance({ address: s.address });
  if (gas === 0n) throw new PayError(`${relayErr?.message ?? 'Gas-free payments are busy.'} Nothing was charged.`);
  const c = i.call;
  let hash: Hex;
  try {
    hash = await wallet.writeContract({
      account: s.address, chain: whitechain, address: c.contract, abi: CHECKOUT_ABI, functionName: c.fn,
      args: c.fn === 'pay'
        ? [c.orderRef, c.payer, c.merchant, BigInt(c.amount), 0n, BigInt(i.message.validBefore), signature]
        : [c.orderRef, c.payer, BigInt(c.amount), 0n, BigInt(i.message.validBefore), signature],
    } as Parameters<typeof wallet.writeContract>[0]);
  } catch (e) {
    throw new PayError(cancelled(e) ? 'You cancelled. Nothing was charged.' : 'The payment couldn’t be sent. Nothing was charged.');
  }
  onStep('verify');
  return submit({ tx: hash });
}

const post = async (body: Record<string, unknown>) => {
  try { return await api<{ order: Order; intent?: ServerIntent }>('/api/orders', { body }); }
  catch (e) { const pe = new PayError((e as Error).message); (pe as PayError & { code?: string }).code = (e as { code?: string }).code; throw pe; }
};

/** Creates the order on the server (prices come from the server), then pays it. */
export async function payOnServer(create: Record<string, unknown>, s: Wallet, onStep: (st: PayStep) => void, onOrder?: (o: Order) => void): Promise<Order> {
  onStep('check');
  const r = await post({ action: 'create', ...create });
  onOrder?.(r.order);
  if (!r.intent) return r.order;
  return signAndSettle(r.intent, s, onStep, async (b) => (await post({ action: 'pay', orderId: r.order.id, ...b })).order);
}

/** Pay an order the server already created (after a cancelled confirm, say). */
export async function retryOnServer(o: Order, s: Wallet, onStep: (st: PayStep) => void): Promise<Order> {
  onStep('check');
  const r = await post({ action: 'intent', orderId: o.id });
  if (!r.intent) return r.order;
  return signAndSettle(r.intent, s, onStep, async (b) => (await post({ action: 'pay', orderId: o.id, ...b })).order);
}

/** Stall refund through ZeetoCheckout: the stall signs, the contract sends the money back to the payer only. */
export async function refundOnServer(o: Order, usd: number | undefined, reason: string, s: Wallet): Promise<Order> {
  const r = await post({ action: 'refund', prepare: true, orderId: o.id, usd });
  return signAndSettle(r.intent!, s, () => undefined, async (b) => (await post({ action: 'refund', orderId: o.id, usd, reason, ...b })).order);
}

/** A button on a server order (accept, packed, handover, arrived, cancel). */
export async function orderAction(o: Order, action: 'accept' | 'packed' | 'handover' | 'arrived' | 'cancel'): Promise<Order> {
  return (await api<{ order: Order }>('/api/orders', { body: { action, orderId: o.id } })).order;
}

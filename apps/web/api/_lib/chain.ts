import { createPublicClient, createWalletClient, decodeEventLog, defineChain, formatEther, http, parseGwei, verifyTypedData, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { env, has } from './env.js';
import { HttpError, bad, off } from './http.js';
import { AUTH_TTL_S, USDT, WHITECHAIN } from './shared.js';

export const whitechain = defineChain({
  id: WHITECHAIN.id,
  name: 'Whitechain Testnet',
  nativeCurrency: { name: 'WBT', symbol: 'WBT', decimals: 18 },
  rpcUrls: { default: { http: [env.whitechainRpc] } },
  blockExplorers: { default: { name: 'Blockscout', url: WHITECHAIN.explorer } },
});

export const chain = () => createPublicClient({ chain: whitechain, transport: http(env.whitechainRpc, { timeout: 20_000, retryCount: 2 }) });

/**
 * Whitechain test USDT's EIP-712 domain. Checked against the live contract: this domain hashes to its DOMAIN_SEPARATOR(),
 * and a fork test (contracts/test/ZeetoCheckout.fork.t.sol) settles a real payment + refund with these exact signatures.
 */
export const USDT_DOMAIN = { name: 'Tether USD', version: '1', chainId: WHITECHAIN.id, verifyingContract: USDT } as const;
export const RECEIVE_TYPES = {
  ReceiveWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

export const CHECKOUT_ABI = [
  { type: 'function', name: 'pay', stateMutability: 'nonpayable', inputs: [
    { name: 'orderRef', type: 'bytes32' }, { name: 'payer', type: 'address' }, { name: 'merchant', type: 'address' }, { name: 'amount', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' }, { name: 'validBefore', type: 'uint256' }, { name: 'signature', type: 'bytes' }], outputs: [] },
  { type: 'function', name: 'refund', stateMutability: 'nonpayable', inputs: [
    { name: 'orderRef', type: 'bytes32' }, { name: 'payer', type: 'address' }, { name: 'amount', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' }, { name: 'validBefore', type: 'uint256' }, { name: 'signature', type: 'bytes' }], outputs: [] },
  { type: 'function', name: 'payNonce', stateMutability: 'view', inputs: [{ name: 'orderRef', type: 'bytes32' }, { name: 'merchant', type: 'address' }], outputs: [{ type: 'bytes32' }] },
  { type: 'function', name: 'refundNonce', stateMutability: 'view', inputs: [{ name: 'orderRef', type: 'bytes32' }, { name: 'refundedSoFar', type: 'uint256' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bytes32' }] },
  { type: 'function', name: 'getPayment', stateMutability: 'view', inputs: [{ name: 'orderRef', type: 'bytes32' }, { name: 'payer', type: 'address' }], outputs: [{ type: 'tuple', components: [
    { name: 'payer', type: 'address' }, { name: 'merchant', type: 'address' }, { name: 'amount', type: 'uint128' }, { name: 'refunded', type: 'uint128' }, { name: 'paidAt', type: 'uint64' }] }] },
  { type: 'function', name: 'paused', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'event', name: 'Paid', inputs: [
    { name: 'orderRef', type: 'bytes32', indexed: true }, { name: 'payer', type: 'address', indexed: true }, { name: 'merchant', type: 'address', indexed: true },
    { name: 'amount', type: 'uint256', indexed: false }, { name: 'relayer', type: 'address', indexed: false }] },
  { type: 'event', name: 'Refunded', inputs: [
    { name: 'orderRef', type: 'bytes32', indexed: true }, { name: 'payer', type: 'address', indexed: true }, { name: 'merchant', type: 'address', indexed: true },
    { name: 'amount', type: 'uint256', indexed: false }, { name: 'totalRefunded', type: 'uint256', indexed: false }] },
] as const;

const usdtAbi = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'authorizationState', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }, { name: 'n', type: 'bytes32' }], outputs: [{ type: 'bool' }] },
] as const;

export const checkoutAddress = () => { if (!has.checkout) throw off('Checkout contract (CHECKOUT_ADDRESS)'); return env.checkout as Hex; };

/** What the payer (or the stall, for a refund) signs. Shown to nobody: the app signs it silently with the embedded wallet. */
export interface Intent {
  domain: typeof USDT_DOMAIN;
  types: typeof RECEIVE_TYPES;
  primaryType: 'ReceiveWithAuthorization';
  message: { from: Hex; to: Hex; value: string; validAfter: string; validBefore: string; nonce: Hex };
  /** The contract call that settles it, so the app can submit it itself if the relayer is off. */
  call: { contract: Hex; fn: 'pay' | 'refund'; orderRef: Hex; payer: Hex; merchant: Hex; amount: string };
  gasless: boolean;
}

export interface Settled { hash: Hex; block: number; from: Hex; to: Hex; amount: bigint; gasWei: bigint; relayer: Hex | null }

const same = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
const deadline = () => String(Math.floor(Date.now() / 1000) + AUTH_TTL_S);

export async function payIntent(o: { order_ref: Hex; payer: Hex; amount: string }, merchant: Hex): Promise<Intent> {
  const contract = checkoutAddress();
  const nonce = await chain().readContract({ address: contract, abi: CHECKOUT_ABI, functionName: 'payNonce', args: [o.order_ref, merchant] });
  return {
    domain: USDT_DOMAIN, types: RECEIVE_TYPES, primaryType: 'ReceiveWithAuthorization',
    message: { from: o.payer, to: contract, value: o.amount, validAfter: '0', validBefore: deadline(), nonce },
    call: { contract, fn: 'pay', orderRef: o.order_ref, payer: o.payer, merchant, amount: o.amount },
    gasless: has.relay,
  };
}

/** Refund intent. "Refunded so far" is read from the contract (the source of truth), never from our database. */
export async function refundIntent(o: { order_ref: Hex; payer: Hex }, merchant: Hex, amount: bigint): Promise<Intent> {
  const contract = checkoutAddress();
  const p = await onchainPayment(o.order_ref, o.payer);
  if (!p || !same(p.merchant, merchant)) throw bad('This order isn’t paid to your stall onchain.');
  if (amount <= 0n || BigInt(p.refunded) + amount > BigInt(p.amount)) throw bad(`You can refund up to ${(Number(BigInt(p.amount) - BigInt(p.refunded)) / 1e6).toFixed(2)} USDT.`);
  const nonce = await chain().readContract({ address: contract, abi: CHECKOUT_ABI, functionName: 'refundNonce', args: [o.order_ref, BigInt(p.refunded), amount] });
  return {
    domain: USDT_DOMAIN, types: RECEIVE_TYPES, primaryType: 'ReceiveWithAuthorization',
    message: { from: merchant, to: contract, value: amount.toString(), validAfter: '0', validBefore: deadline(), nonce },
    call: { contract, fn: 'refund', orderRef: o.order_ref, payer: o.payer, merchant, amount: amount.toString() },
    gasless: has.relay,
  };
}

export async function onchainPayment(orderRef: Hex, payer: Hex) {
  const p = await chain().readContract({ address: checkoutAddress(), abi: CHECKOUT_ABI, functionName: 'getPayment', args: [orderRef, payer] });
  return p.payer === '0x0000000000000000000000000000000000000000' ? null : p;
}

/**
 * Checks a signature against exactly the intent we issued before any gas is spent:
 * same signer, same contract, same amount, same nonce (which binds the order and the stall), still in its time window.
 */
export async function checkSignature(i: Intent, signed: Intent['message'], sig: Hex) {
  const m = i.message;
  if (!same(signed.from, m.from) || !same(signed.to, m.to) || signed.value !== m.value || !same(signed.nonce, m.nonce) || signed.validAfter !== '0') throw bad('This signature doesn’t match the order. Start again.');
  const now = Math.floor(Date.now() / 1000);
  const vb = Number(signed.validBefore);
  if (!(vb > now + 30 && vb <= now + AUTH_TTL_S + 120)) throw bad('The approval expired. Pay again.');
  const ok = await verifyTypedData({
    address: m.from, domain: USDT_DOMAIN, types: RECEIVE_TYPES, primaryType: 'ReceiveWithAuthorization',
    message: { from: m.from, to: m.to, value: BigInt(m.value), validAfter: 0n, validBefore: BigInt(vb), nonce: m.nonce },
    signature: sig,
  }).catch(() => false);
  if (!ok) throw bad('The approval doesn’t match your account. Sign in again.');
  const pub = chain();
  const [used, bal] = await Promise.all([
    pub.readContract({ address: USDT, abi: usdtAbi, functionName: 'authorizationState', args: [m.from, m.nonce] }),
    pub.readContract({ address: USDT, abi: usdtAbi, functionName: 'balanceOf', args: [m.from] }),
  ]);
  if (used) throw new HttpError(409, 'This payment was already submitted.', 'already-used');
  if (bal < BigInt(m.value)) throw new HttpError(402, `Not enough balance: ${(Number(bal) / 1e6).toFixed(2)} available, ${(Number(m.value) / 1e6).toFixed(2)} needed.`, 'low-balance');
}

const relayer = () => privateKeyToAccount(env.relayerKey as Hex);

/**
 * Submits a checked intent through ZeetoCheckout and pays the gas. Simulates first (a failing payment costs nothing),
 * refuses when gas is unusually expensive, then reads the receipt and requires the matching Paid/Refunded event.
 */
export async function relay(i: Intent, validBefore: string, sig: Hex): Promise<Settled> {
  if (!has.relay) throw off('Gasless payments (RELAYER_PRIVATE_KEY + CHECKOUT_ADDRESS)');
  const pub = chain();
  const account = relayer();
  const c = i.call;
  const args = c.fn === 'pay'
    ? { functionName: 'pay' as const, args: [c.orderRef, c.payer, c.merchant, BigInt(c.amount), 0n, BigInt(validBefore), sig] as const }
    : { functionName: 'refund' as const, args: [c.orderRef, c.payer, BigInt(c.amount), 0n, BigInt(validBefore), sig] as const };

  // Compare the network's current gas price (not the wallet's padded max fee, which is ~2x base) with our ceiling.
  // Whitechain's floor is 5 gwei, so the ceiling must sit well above it (default 50 gwei, RELAY_MAX_GWEI).
  const price = await pub.getGasPrice();
  const cap = parseGwei(String(env.relayMaxGwei));
  if (price > cap) throw new HttpError(503, 'The network is busy right now. Try again in a minute.', 'gas-spike');
  let request;
  try {
    ({ request } = await pub.simulateContract({ account, address: c.contract, abi: CHECKOUT_ABI, ...args } as Parameters<typeof pub.simulateContract>[0]));
  } catch (e) {
    console.error('[relay] simulate', (e as Error).message.split('\n')[0]);
    throw bad('The network rejected this payment. Nothing was charged.');
  }
  const wbt = await pub.getBalance({ address: account.address });
  if (wbt < 10n ** 14n) { console.error('[relay] relayer low on WBT', account.address, formatEther(wbt)); throw off('Gasless payments (relayer needs WBT)'); }
  const wallet = createWalletClient({ account, chain: whitechain, transport: http(env.whitechainRpc, { timeout: 20_000 }) });
  // Never pay more than the ceiling per gas, even if the network spikes between the check and the send.
  const tip = price / 10n > 10n ** 9n ? 10n ** 9n : price / 10n;
  const hash = await wallet.writeContract({ ...(request as Parameters<typeof wallet.writeContract>[0]), maxFeePerGas: cap, maxPriorityFeePerGas: tip } as Parameters<typeof wallet.writeContract>[0]);
  return confirm(hash, i);
}

/** The customer (or stall) submitted the contract call themselves, paying their own gas. We only trust the receipt's event. */
export async function verifySubmitted(hash: Hex, i: Intent): Promise<Settled> {
  return confirm(hash, i);
}

async function confirm(hash: Hex, i: Intent): Promise<Settled> {
  const r = await chain().waitForTransactionReceipt({ hash, confirmations: 1, timeout: 90_000 });
  if (r.status !== 'success') throw bad('The payment failed on the network. Nothing was charged.');
  const c = i.call;
  const hit = r.logs.find((l) => {
    if (!same(l.address, c.contract)) return false;
    try {
      const ev = decodeEventLog({ abi: CHECKOUT_ABI, data: l.data, topics: l.topics });
      return ev.eventName === (c.fn === 'pay' ? 'Paid' : 'Refunded') && same(ev.args.orderRef, c.orderRef) && same(ev.args.payer, c.payer)
        && same(ev.args.merchant, c.merchant) && ev.args.amount === BigInt(c.amount);
    } catch { return false; }
  });
  if (!hit) throw bad(`That transaction isn’t this ${c.fn === 'pay' ? 'payment' : 'refund'}. Tx: ${hash}`);
  return {
    hash, block: Number(r.blockNumber), from: c.fn === 'pay' ? c.payer : c.merchant, to: c.fn === 'pay' ? c.merchant : c.payer,
    amount: BigInt(c.amount), gasWei: r.gasUsed * r.effectiveGasPrice, relayer: same(r.from, has.relay ? relayer().address : '') ? r.from : null,
  };
}

/**
 * Reconcile: the payment may already be onchain even though we never saw the reply (the relayer's request timed out,
 * the app was closed mid-payment...). Finds this order's Paid event from this payer and turns it into a Settled.
 */
export async function findPaid(i: Intent): Promise<Settled | null> {
  if (!(await onchainPayment(i.call.orderRef, i.call.payer))) return null;
  const pub = chain();
  const latest = await pub.getBlockNumber();
  const ev = CHECKOUT_ABI.find((x) => x.type === 'event' && x.name === 'Paid')!;
  for (let to = latest, n = 0; n < 6; n++) {
    const from = to > 9_999n ? to - 9_999n : 0n;
    const logs = await pub.getLogs({ address: i.call.contract, event: ev as never, args: { orderRef: i.call.orderRef, payer: i.call.payer } as never, fromBlock: from, toBlock: to }).catch(() => []) as { transactionHash: Hex | null }[];
    const hit = logs.find((l) => l.transactionHash);
    if (hit) return confirm(hit.transactionHash as Hex, i);
    if (from === 0n) break;
    to = from - 1n;
  }
  return null;
}

/** For the admin dashboard and /api/health: who pays gas and how much it has left. */
export async function relayerStatus() {
  if (!has.relay) return null;
  const a = relayer().address;
  const wbt = await chain().getBalance({ address: a }).catch(() => null);
  return { address: a, wbt: wbt == null ? null : Number(formatEther(wbt)), low: wbt != null && wbt < 10n ** 16n };
}

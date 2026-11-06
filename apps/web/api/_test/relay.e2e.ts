/**
 * End-to-end check of the gas-free flow against a FORK of the live Whitechain testnet (real USDT, real ZeetoCheckout):
 * intent → customer signs (EIP-3009) → signature check → relayer simulates + sends → Paid event → stall-signed refund.
 * Needs anvil running:  anvil --fork-url https://rpc.testnet.whitechain.io --chain-id 1874
 * Run:  npx tsx apps/web/api/_test/relay.e2e.ts
 */
import assert from 'node:assert/strict';
import { createTestClient, createWalletClient, http, parseEther, type Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const RPC = 'http://127.0.0.1:8545';
process.env.WHITECHAIN_RPC = RPC;
process.env.CHECKOUT_ADDRESS = '0xB3D0d4FB70f1C09C311194E322CDE225eCf3f22f';
process.env.RELAYER_PRIVATE_KEY = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // anvil #0, no 0x on purpose (like a MetaMask export)
const USDT = '0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7' as Hex;
const WHALE = '0xA1616Fe9624B64eF2Dddc8ccAc735bAA234CEbF7' as Hex;

const { payIntent, refundIntent, checkSignature, relay, chain, whitechain, onchainPayment, findPaid } = await import('../_lib/chain.js');
const { orderRef } = await import('../_lib/shared.js');

const test = createTestClient({ chain: whitechain, mode: 'anvil', transport: http(RPC) });
const payerKey = generatePrivateKey(); const payer = privateKeyToAccount(payerKey);
const stallKey = generatePrivateKey(); const stall = privateKeyToAccount(stallKey);
const erc20 = [{ type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ name: 't', type: 'address' }, { name: 'v', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] }] as const;

// Customer gets 10 USDT and NO WBT (gas-free means they never need any).
await test.impersonateAccount({ address: WHALE });
await test.setBalance({ address: WHALE, value: parseEther('1') });
const whale = createWalletClient({ chain: whitechain, transport: http(RPC), account: WHALE });
await chain().waitForTransactionReceipt({ hash: await whale.writeContract({ address: USDT, abi: erc20, functionName: 'transfer', args: [payer.address, 10_000_000n] }) });
const bal = (a: Hex) => chain().readContract({ address: USDT, abi: erc20, functionName: 'balanceOf', args: [a] });
assert.equal(await bal(payer.address), 10_000_000n);
assert.equal(await chain().getBalance({ address: payer.address }), 0n);
console.log('✓ customer has 10 USDT and 0 WBT');

// 1. Pay ₹400 (4.76 USDT) to the stall.
const ref = orderRef(`otest${Date.now()}`, 'sameer-s-food-truck');
const amount = '4760000';
const i = await payIntent({ order_ref: ref, payer: payer.address, amount }, stall.address);
assert.equal(i.gasless, true);
const signer = createWalletClient({ chain: whitechain, transport: http(RPC), account: payer });
const sig = await signer.signTypedData({ domain: i.domain, types: i.types, primaryType: i.primaryType, message: { ...i.message, value: BigInt(i.message.value), validAfter: 0n, validBefore: BigInt(i.message.validBefore) } });
await checkSignature(i, i.message, sig);
console.log('✓ signature checked against the issued intent');
const paid = await relay(i, i.message.validBefore, sig);
assert.equal(await bal(stall.address), 4_760_000n);
assert.equal(await bal(payer.address), 5_240_000n);
assert.equal(await chain().getBalance({ address: payer.address }), 0n);
assert.ok(paid.relayer, 'sent by the relayer');
console.log(`✓ gas-free payment settled in block ${paid.block}: stall got 4.76 USDT, customer paid 0 gas (relayer gas ${paid.gasWei} wei)`);

// 1b. If we never saw the reply (timeout), the order is found onchain and settled from there.
const again = await findPaid(await payIntent({ order_ref: ref, payer: payer.address, amount }, stall.address));
assert.equal(again?.hash, paid.hash);
assert.equal(await findPaid(await payIntent({ order_ref: orderRef('never-paid', 'x'), payer: payer.address, amount }, stall.address)), null);
console.log('✓ reconcile: a paid order is found onchain by its order ref; an unpaid one is not');

// 2. The same signature can't be used twice.
await assert.rejects(checkSignature(i, i.message, sig), /already submitted/);
console.log('✓ replay refused');

// 3. Stall refunds 1 USDT, signed by the stall's wallet, also gas-free.
const r = await refundIntent({ order_ref: ref, payer: payer.address }, stall.address, 1_000_000n);
const stallSigner = createWalletClient({ chain: whitechain, transport: http(RPC), account: stall });
const rsig = await stallSigner.signTypedData({ domain: r.domain, types: r.types, primaryType: r.primaryType, message: { ...r.message, value: BigInt(r.message.value), validAfter: 0n, validBefore: BigInt(r.message.validBefore) } });
await checkSignature(r, r.message, rsig);
await relay(r, r.message.validBefore, rsig);
assert.equal(await bal(payer.address), 6_240_000n);
assert.equal((await onchainPayment(ref, payer.address))!.refunded, 1_000_000n);
console.log('✓ partial refund: 1 USDT back to the customer, recorded onchain');

// 4. Can't refund more than was paid.
await assert.rejects(refundIntent({ order_ref: ref, payer: payer.address }, stall.address, 4_000_000n), /refund up to 3.76/);
console.log('✓ over-refund refused');
console.log('\nGas-free pay + refund work end to end on a fork of Whitechain.');

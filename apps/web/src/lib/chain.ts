import { createPublicClient, defineChain, erc20Abi, formatUnits, http, type Address } from 'viem';
import { ADDRESSES, CHAINS } from '@zeeto/core';

/** Whitechain Testnet (L2), chain 1874. Checked against the live RPC. */
export const whitechain = defineChain({
  id: CHAINS.whitechain.id,
  name: CHAINS.whitechain.name,
  nativeCurrency: { name: 'WBT', symbol: 'WBT', decimals: 18 },
  rpcUrls: { default: { http: [CHAINS.whitechain.rpc] } },
  blockExplorers: { default: { name: 'Whitechain Explorer', url: CHAINS.whitechain.explorer } },
  testnet: true,
});

export const publicClient = createPublicClient({ chain: whitechain, transport: http() });

/** Real balances for one address: test WBT (gas) and test USDT (payments). */
export async function readBalances(address: Address) {
  const usdt = ADDRESSES.usdtWhitechain as Address;
  const [wbt, raw] = await Promise.all([
    publicClient.getBalance({ address }),
    publicClient.readContract({ address: usdt, abi: erc20Abi, functionName: 'balanceOf', args: [address] }),
  ]);
  return { wbt: Number(formatUnits(wbt, 18)), usdt: Number(formatUnits(raw, 6)) };
}

/** Live check used by the admin System tab. */
export async function chainStatus() {
  const [id, block] = await Promise.all([publicClient.getChainId(), publicClient.getBlockNumber()]);
  return { id, block: Number(block) };
}
export { unichainSepolia } from 'viem/chains';

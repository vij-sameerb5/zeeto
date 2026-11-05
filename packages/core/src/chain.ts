import type { Rail, RailId } from './types';

/** Testnets only. Sources: docs/spec/INTEGRATIONS.md. Verify before first real tx. */
export const CHAINS = {
  whitechain: { name: 'Whitechain Sepolia', id: 1874, explorer: 'https://explorer.testnet.whitechain.io', faucet: 'https://faucet.testnet.whitechain.io' },
  unichain: { name: 'Unichain Sepolia', id: 1301, explorer: 'https://sepolia.uniscan.xyz', rpc: 'https://sepolia.unichain.org' },
} as const;

export const ADDRESSES = {
  /** Official Whitechain test USDT. Required by the Whitechain prize. */
  usdtWhitechain: '0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7',
  /** Deployed during the hackathon. */
  streetPay: '',
  uniswapRouterUnichain: '0xf70536b3bcc1bd1a972dc186a2cf84cc6da6be5d',
  usdcUnichain: '0x31d0220469e10c4E71834a79b1f276d740d3768F',
} as const;

export const ENDPOINTS = {
  zeroG: 'https://router-api.0g.ai/v1',
  uniswap: 'https://trade-api.gateway.uniswap.org/v1',
} as const;

export const RAILS: Record<RailId, Rail> = {
  'streetpay-usdt': {
    id: 'streetpay-usdt',
    label: 'StreetPay USDT',
    blurb: 'Pay test USDT. No gas for you, an onchain receipt, refunds in one tap.',
    token: 'USDT',
    network: CHAINS.whitechain.name,
    chainId: CHAINS.whitechain.id,
    txUrl: (h) => `${CHAINS.whitechain.explorer}/tx/${h}`,
  },
  'uniswap-usdc': {
    id: 'uniswap-usdc',
    label: 'Pay with ETH',
    blurb: 'Spend the ETH you hold. Uniswap swaps it to the exact USDC the vendor asked for.',
    token: 'USDC',
    network: CHAINS.unichain.name,
    chainId: CHAINS.unichain.id,
    txUrl: (h) => `${CHAINS.unichain.explorer}/tx/${h}`,
  },
};

/** Demo rates until a price feed is wired in. */
export const FX = { inrPerUsd: 84, usdPerEth: 3000 } as const;

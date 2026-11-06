import { env, has } from './_lib/env.js';
import { bad, body, HttpError, isAddr, off, route } from './_lib/http.js';

/**
 * Uniswap Trading API, called from the server so the API key never reaches the browser.
 * quote: how much ETH buys an exact amount of USDC. swap: the transaction for the user's wallet to sign.
 * Chain is UNISWAP_CHAIN_ID (default 1301, Unichain Sepolia).
 */
const API = 'https://trade-api.gateway.uniswap.org/v1';
const ETH = '0x0000000000000000000000000000000000000000';
const USDC: Record<number, string> = {
  1301: '0x31d0220469e10c4E71834a79b1f276d740d3768F', // Unichain Sepolia
  11155111: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Sepolia
  130: '0x078D782b760474a361dDA0AF3839290b0EF57AD6', // Unichain
};

async function call(path: string, payload: unknown) {
  const r = await fetch(`${API}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': env.uniswapKey, 'x-universal-router-version': '2.0' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  const j = await r.json().catch(() => ({})) as Record<string, unknown>;
  if (!r.ok) {
    console.error('[uniswap]', path, r.status, JSON.stringify(j).slice(0, 300));
    throw new HttpError(502, typeof j.detail === 'string' ? `Uniswap: ${j.detail}` : 'Uniswap couldn’t quote this right now.');
  }
  return j;
}

export default route(['POST'], async (req) => {
  if (!has.uniswap) throw off('Uniswap (UNISWAP_API_KEY)');
  const b = body<{ action?: string; usdcOut?: number; swapper?: string; quote?: unknown }>(req);
  const chainId = env.uniswapChainId;
  const usdc = USDC[chainId];
  if (!usdc) throw off(`Uniswap on chain ${chainId}`);

  if (b.action === 'quote') {
    const out = Number(b.usdcOut);
    if (!(out >= 0.01 && out <= 1000)) throw bad('Quote between 0.01 and 1000 USDC.');
    if (!isAddr(b.swapper)) throw bad('Missing wallet.');
    const j = await call('quote', {
      type: 'EXACT_OUTPUT', amount: String(Math.round(out * 1e6)), tokenIn: ETH, tokenOut: usdc,
      tokenInChainId: chainId, tokenOutChainId: chainId, swapper: b.swapper, routingPreference: 'BEST_PRICE', protocols: ['V4', 'V3', 'V2'],
    });
    const q = (j.quote ?? {}) as Record<string, unknown>;
    const input = (q.input ?? {}) as { amount?: string };
    return {
      quote: {
        id: String(j.requestId ?? q.quoteId ?? 'q'),
        ethIn: Number(input.amount ?? 0) / 1e18,
        usdcOut: out,
        impactPct: Number(q.priceImpact ?? 0),
        gasUsd: Number(q.gasFeeUSD ?? 0),
        route: String(j.routing ?? 'CLASSIC'),
        simulated: false,
      },
      raw: j.quote, // passed back unchanged for /swap
      chainId,
    };
  }

  if (b.action === 'swap') {
    if (!b.quote || typeof b.quote !== 'object') throw bad('Missing quote.');
    const j = await call('swap', { quote: b.quote, simulateTransaction: true, refreshGasPrice: true });
    const s = (j.swap ?? {}) as { to?: string; data?: string; value?: string; chainId?: number };
    if (!isAddr(s.to) || typeof s.data !== 'string') throw new HttpError(502, 'Uniswap didn’t return a transaction.');
    return { tx: { to: s.to, data: s.data, value: s.value ?? '0', chainId: s.chainId ?? chainId } };
  }
  throw bad('Unknown action.');
}, { perMinute: 30 });

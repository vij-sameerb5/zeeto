/**
 * Server-only settings. Set them in Vercel → Project → Settings → Environment Variables (or apps/web/.env.local for `vercel dev`).
 * Never prefix these with VITE_: anything VITE_ is shipped to every browser.
 */
const get = (k: string) => process.env[k]?.trim() || '';
const num = (k: string, d: number) => { const n = Number(get(k)); return Number.isFinite(n) && n > 0 ? n : d; };

export const env = {
  privyAppId: get('PRIVY_APP_ID') || get('VITE_PRIVY_APP_ID'),
  privySecret: get('PRIVY_APP_SECRET'),
  supabaseUrl: get('SUPABASE_URL') || get('VITE_SUPABASE_URL'),
  supabaseKey: get('SUPABASE_SECRET_KEY'),
  whitechainRpc: get('WHITECHAIN_RPC') || 'https://rpc.testnet.whitechain.io',
  /** ZeetoCheckout on Whitechain Sepolia (deployed + verified). Every payment and refund goes through it. */
  checkout: get('CHECKOUT_ADDRESS'),
  /** Hot wallet that submits customers' signed payments and pays the WBT gas on the business's behalf. Holds only WBT. */
  relayerKey: get('RELAYER_PRIVATE_KEY'),
  // Relayer limits: what stops anyone draining it (see docs/ARCHITECTURE.md → "Relayer").
  relayMinInr: num('RELAY_MIN_INR', 10),
  relayUserPerDay: num('RELAY_USER_PER_DAY', 25),
  relayStallPerDay: num('RELAY_STALL_PER_DAY', 500),
  relayDailyGasWbt: num('RELAY_DAILY_GAS_WBT', 0.5),
  relayMaxGwei: num('RELAY_MAX_GWEI', 5),
  geminiKey: get('GEMINI_API_KEY'),
  geminiModel: get('GEMINI_MODEL') || 'gemini-2.5-flash',
  uniswapKey: get('UNISWAP_API_KEY'),
  uniswapChainId: num('UNISWAP_CHAIN_ID', 1301),
  waToken: get('WHATSAPP_TOKEN'),
  waPhoneId: get('WHATSAPP_PHONE_NUMBER_ID'),
  waVerify: get('WHATSAPP_VERIFY_TOKEN'),
  waAppSecret: get('WHATSAPP_APP_SECRET'),
  /** Public site URL, for links in WhatsApp messages, hosted checkout and webhooks. */
  siteUrl: (get('SITE_URL') || (get('VERCEL_PROJECT_PRODUCTION_URL') ? `https://${get('VERCEL_PROJECT_PRODUCTION_URL')}` : '')).replace(/\/+$/, ''),
  /** Comma list of Privy ids, phones or emails allowed into /admin. */
  admins: get('ADMIN_USERS').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
};

const isKey = (k: string) => /^0x[0-9a-fA-F]{64}$/.test(k);
const isAddr = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a);

export const has = {
  auth: !!env.privyAppId,
  db: !!(env.supabaseUrl && env.supabaseKey),
  checkout: isAddr(env.checkout),
  relay: isKey(env.relayerKey) && isAddr(env.checkout),
  ai: !!env.geminiKey,
  uniswap: !!env.uniswapKey,
  whatsapp: !!(env.waToken && env.waPhoneId && env.waVerify && env.waAppSecret),
};

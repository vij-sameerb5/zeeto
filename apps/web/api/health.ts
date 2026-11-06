import { relayerStatus } from './_lib/chain.js';
import { env, has } from './_lib/env.js';
import { route } from './_lib/http.js';

/** What's switched on. Booleans only: never echoes a key. The app uses this to choose server or demo mode. */
export default route(['GET'], async () => ({
  ok: true,
  chainId: 1874,
  features: { ...has },
  checkout: has.checkout ? env.checkout : null,
  relayer: (await relayerStatus())?.address ?? null,
  waNumber: env.waDisplay || null,
  site: env.siteUrl || null, // links in WhatsApp messages point here
}));

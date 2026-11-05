# STREETLAYER — Integration Notes

One section per integration: what it does for us, docs, auth, SDK, network IDs, addresses, env vars, steps, and the exact code seam it replaces.
Values marked **verify** came from public docs on 1 Nov 2026 and must be re-checked at the hackathon. Testnets only.

## Quick reference

| What | Value |
|---|---|
| Whitechain Sepolia chain ID | `1874` |
| Whitechain explorer | https://explorer.testnet.whitechain.io |
| Whitechain faucet | https://faucet.testnet.whitechain.io |
| Whitechain test USDT (required) | `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` |
| Unichain Sepolia chain ID | `1301` · RPC https://sepolia.unichain.org · explorer https://sepolia.uniscan.xyz |
| Uniswap Universal Router (Unichain Sepolia) | `0xf70536b3bcc1bd1a972dc186a2cf84cc6da6be5d` (verify) |
| USDC (Unichain Sepolia) | `0x31d0220469e10c4E71834a79b1f276d740d3768F` (verify) |
| Base Sepolia (backup) | chain `84532` · router `0x492e6456d9528771018deb9e87ef7750ef184104` (verify) |
| Uniswap API base | `https://trade-api.gateway.uniswap.org/v1` (header `x-api-key`) |
| 0G PC base URL | `https://router-api.0g.ai/v1` (mainnet; OpenAI-compatible) |
| Arkiv (optional) | `@arkiv-network/sdk`; testnet name differs across docs (Kaolin / Mendoza) — verify |

All constants live in `packages/core/src/networks.ts`.

## Env vars (`.env.example`)

| Var | Where | Secret? |
|---|---|---|
| `VITE_MAPBOX_TOKEN` | web | public, URL-restricted |
| `VITE_PRIVY_APP_ID` | web, mobile | public |
| `VITE_API_URL` | web, mobile | public |
| `ZEROG_API_KEY` | api | **secret** |
| `UNISWAP_API_KEY` | api | **secret** |
| `RELAYER_PRIVATE_KEY` | api | **secret**, testnet wallet only |
| `DATABASE_URL` | api | **secret** |
| `STREETPAY_ADDRESS` | api, web | public |

---

## 1. Privy — login and wallets
- **Role:** "Continue with Google" creates an embedded wallet; existing users connect MetaMask/WalletConnect. Signs txs on 1874 and 1301.
- **Docs:** https://docs.privy.io
- **Auth:** App ID (public) from the Privy dashboard; allowed origins = localhost + Vercel domain.
- **SDK:** `@privy-io/react-auth` (web). Mobile: check Expo SDK works in Expo Go; otherwise the WebView shell already covers mobile.
- **Steps:** add custom chains 1874 and 1301 to Privy config → wrap `<App>` in `PrivyProvider` → replace Welcome's simulated sign-in → read `wallet.address` into `Customer.wallet`.
- **Seam:** `apps/web/src/screens/Welcome.tsx` (`go()`), `DEMO_CUSTOMER` usages.
- **Check:** Whitechain Sepolia appears as a selectable chain; gas sponsorship is handled by our relayer, not Privy.

## 2. Mapbox — map
- **Role:** real tiles, clustering for dense markets, fresh-stock layer.
- **Docs:** https://docs.mapbox.com/mapbox-gl-js/
- **Auth:** public token `pk.…`, restrict to URLs.
- **SDK:** `mapbox-gl` (web only). **Not** `@rnmapbox/maps` in Expo Go (needs a dev build).
- **Steps:** create `apps/web/src/components/MapboxMap.tsx` implementing `MapViewProps` (same as `MapCanvas`) → GeoJSON source from vendors → `cluster: true` → pin layer + selected state → swap the import in `Explore.tsx`.
- **Seam:** `MapCanvas.tsx` ↔ `MapboxMap.tsx`.

## 3. 0G Private Computer — AI (prize track)
- **Role:** Snap & Sell (photo → listing), Speak stock (voice → stock), announcements in Hindi/Marathi.
- **Docs:** https://pc.0g.ai · https://docs.0g.ai/developer-hub/building-on-0g/compute-network/overview · iAI https://iai.finance/docs
- **Auth:** API key from https://pc.0g.ai/dashboard/api-keys (connect wallet → create). Server-side only. Optional header `X-0G-Provider-Trust-Mode: private`.
- **SDK:** `openai` npm package with `baseURL: 'https://router-api.0g.ai/v1'`.
- **Models (from prize page):** vision `qwen vision`, speech `whisper-large-v3`, text `0gm-1.0`. Check exact model IDs at https://pc.0g.ai/models.
- **Steps:**
  1. `apps/api/src/ai.ts`: `POST /ai/snap` takes the photo (base64) → chat completion with image + JSON schema `{items:[{name,nameLocal,unit,price,qty,emoji,confidence}]}`.
  2. Second call to `0gm-1.0` for announcement + translations.
  3. Return `request_id` from each response (find the field/header on day 1) → `AiRun.requestId`.
  4. `POST /ai/voice`: whisper transcription → same pipeline.
  5. Implement `AiService` over HTTP in `packages/core/src/http/ai.ts`.
- **Seam:** `mockAi` in `packages/core/src/mock/services.ts`; UI in `SnapSell.tsx` already shows request IDs.
- **iAI bonus:** let a user sign in with their 0G account and spend their own daily credits; show the balance dropping. Research the flow on day 1.
- **"What breaks without 0G":** vendors can't turn a photo or voice note into a live listing and alert; they'd have to type every item and price.

## 4. Uniswap API — pay with ETH (prize track)
- **Role:** customer holds ETH; vendor receives exact USDC.
- **Docs:** https://developers.uniswap.org/docs/trading/swapping-api/supported-chains · getting started under the same site.
- **Auth:** `x-api-key` from https://developers.uniswap.org/dashboard. Server-side only.
- **Network:** Unichain Sepolia 1301 (backup Base Sepolia 84532). Whitechain is **not** supported → separate route, no bridge.
- **Steps:**
  1. `POST /quote` with `tokenIn = 0x000…000` (native ETH), `tokenOut = USDC`, `type = EXACT_OUTPUT`, `amount = order USDC (6 decimals)`, `swapper = customer`, `chainId = 1301`; set `x-universal-router-version` explicitly.
  2. Return amountIn, route, price impact, gas → UI quote card (already built).
  3. `POST /swap` → calldata → Privy wallet sends tx.
  4. Recipient = vendor wallet (or customer then transfer; prefer direct if API supports a recipient).
  5. API reads receipt: USDC `Transfer` to vendor with the right amount → mark PAID.
- **Seam:** `mockPayments.quoteEthToUsdc` / `payWithEth`.
- **Paperwork:** `FEEDBACK.md` + submit https://developers.uniswap.org/hackathon-feedback with its link; README points to exact files/lines.
- **Risk:** thin testnet liquidity → test a real quote in hour 1; keep Base Sepolia as fallback.

## 5. Whitechain — StreetPay checkout (prize track: Operate)
- **Role:** drop-in merchant checkout in official test USDT with receipts, refunds and CSV export.
- **Docs:** https://docs.whitechain.io · faucet · explorer (above). Plain EVM; Foundry or Hardhat.
- **Contract `StreetPayCheckout.sol` (write at hackathon):**
  - `pay(bytes32 orderId, address merchant, uint256 amount)` — pulls USDT via `transferFrom` (or `permit` if the token supports EIP-2612; verify), forwards to merchant, emits `Paid(orderId, payer, merchant, amount)`; rejects reused orderId.
  - `refund(bytes32 orderId, uint256 amount)` — only that order's merchant; pulls USDT from merchant to payer; emits `Refunded`; cumulative ≤ paid.
  - `payments(orderId)` view for receipts.
- **Drop-in piece (`packages/streetpay`):** `<StreetPayButton orderId amount merchant onPaid />` + `createPaymentLink()` — STREETLAYER's checkout is the "separate app" that embeds it in ~20 lines.
- **Gas:** relayer pays WBT for customers (merchant-covered gas). Guard: per-wallet rate limit, daily cap, only our contract, funded from faucet. Document in README.
- **Steps:** deploy → verify on explorer → put address in `CONTRACTS.streetPayCheckout` → implement `payWithStreetPay` / `refund` → API listens for `Paid` events → one real USDT payment → explorer link in README.
- **Seam:** `mockPayments.payWithStreetPay`, `mockPayments.refund`; UI in `Checkout.tsx`, `VendorOrders.tsx` (refund sheet), `VendorPayments.tsx` (CSV).
- **Paperwork:** `WHITECHAIN_FEEDBACK.md`, README line on why onchain settlement, steady commits, 2–4 min video showing merchant + customer.

## 6. Arkiv — optional (only if it replaces a selected prize)
- **Fit:** announcements and offers that expire; vendor profiles any app can read.
- **SDK:** `@arkiv-network/sdk` (`createWalletClient`, `createPublicClient`, `ExpirationTime`, `eq`). Requires user-visible reads and `/arkiv/*.md` files.

## 7. Backend + hosting
- API: Node 22 + Express, deploy to Render/Railway. DB: Supabase/Neon Postgres with PostGIS.
- PWA: Vercel (`apps/web`, build `npm run build`, output `dist`).
- Mobile: Expo Go via `npx expo start` (QR). APK via EAS after the hackathon.

## 8. Swap checklist (mock → real)
- [ ] `packages/core/src/http/` clients implementing `MarketplaceService`, `PaymentService`, `AiService`
- [ ] `apps/web/src/services.ts` chooses real or mock by `VITE_USE_MOCKS`
- [ ] Remove `SimBadge` where data is real
- [ ] Replace `DEMO_CUSTOMER` / `DEMO_VENDOR_ID` with signed-in identity

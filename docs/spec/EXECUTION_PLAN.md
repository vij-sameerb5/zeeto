# STREETLAYER — Hackathon Build Plan

> Plan only. All code is written **after** hacking starts. Disclose this plan as a pre-event planning artifact in the submission.

## Product in one line
**STREETLAYER — discover local vendors on a map, follow them, order for pickup and pay in crypto; vendors run their stall with AI.**
Paytm (wallet + pay + rewards) + Swiggy (storefront + orders) + Google Maps (discovery) + crypto + AI.

## Surfaces
| Surface | Tech | Scope |
|---|---|---|
| **PWA** (primary demo) | React + TS + Vite + Tailwind + vite-plugin-pwa, Mapbox GL JS, Privy | Customer + Vendor, full flow |
| **Expo Go app** | Expo (React Native) + Expo Router, react-native-maps or WebView-Mapbox | Customer flow: map → vendor → order → pay status → rewards |
| **Android APK** | EAS build | After the hackathon |
| **API** | Node + Express + TS, Postgres + PostGIS | Vendors, products, orders, follows, rewards, AI proxy, payment verification |
| **Contracts** | Solidity on Whitechain Sepolia | StreetPayCheckout (orders, receipts, refunds) |

## Monorepo layout (create at hack start)
```
streetlayer/
├── apps/web        # PWA
├── apps/mobile     # Expo
├── apps/api        # Express
├── packages/core   # shared types, API client, price/order logic
├── packages/streetpay   # drop-in Whitechain checkout SDK + React button
├── packages/ai     # 0G PC client (server-only)
├── packages/swaps  # Uniswap API client (server-only)
├── contracts/whitechain
├── README.md  AI_USAGE.md  FEEDBACK.md  WHITECHAIN_FEEDBACK.md
```

## Core data (Postgres)
vendors(id, name, category, geom, wallet, hours, photo, verified) ·
products(id, vendor_id, name, price_inr, price_usd, stock, unit, photo, fresh_until) ·
follows(customer_id, vendor_id, notify_fresh) ·
orders(id, customer_id, vendor_id, items, total, route[A|B], status, tx_hash, chain_id) ·
announcements(id, vendor_id, text, products, ai_request_id) ·
rewards(customer_id, vendor_id, points, reason, order_id) ·
ai_runs(id, kind, model, request_id, latency_ms)

## Payment routes (no bridge)
- **Route A — Pay with any token (Uniswap):** customer's ETH → Uniswap API quote → swap to USDC → USDC to vendor (Unichain Sepolia/Base Sepolia).
- **Route B — StreetPay USDT (Whitechain):** customer pays official test USDT into `StreetPayCheckout` with orderId → event → backend marks order PAID → vendor confirms pickup → points issued. Refund = vendor one-click.
- UI shows one "Pay" sheet with a clear network label per route.

## Timeline (~36 h; adjust to official start)
| Block | Goal | Done when |
|---|---|---|
| H0–1 | Repo, monorepo scaffold, `.gitignore`, `.env.example`, AI_USAGE.md, first push | Public repo live |
| H1–4 | API + DB + seed 25 demo vendors near chosen market; PWA map with markers, clustering, filters, vendor card | Tap marker → card with products |
| H4–7 | Vendor storefront, product list, follow, cart → order (status PENDING) | Order created |
| H7–11 | **Whitechain**: write + test + deploy + verify StreetPayCheckout; streetpay SDK + button; backend verifier | Real USDT payment, explorer link |
| H11–12 | **Checkpoint 1** — vertical slice works end-to-end on phone | Discover→order→pay→vendor sees PAID |
| H12–16 | **0G**: Snap & Sell (photo→listing), voice stock update, Hindi/Marathi announcement; request IDs in UI | AI creates live listing |
| H16–18 | Followers get fresh-stock notifications (in-app feed + web push if time) | Notification shows |
| H18–22 | **Uniswap** Route A: quote + swap + pay | Swap tx on explorer |
| H22–24 | **Checkpoint 2** — decide Expo scope freeze | |
| H22–28 | Expo app customer flow (shares packages/core) | Runs in Expo Go on iPhone |
| H28–30 | Rewards (ST points), refunds, CSV export, vendor dashboard stats | |
| H30–32 | Deploy PWA to Vercel, API to Render/Railway; test on fresh phones | QR opens live demo |
| H32–34 | README, diagrams, feedback files, AI usage, limitations | |
| H34–36 | Record demo video (2:30–2:55), submit, select 3 prizes | Submitted |

Sleep in shifts. Commit every 30–60 min.

## Demo story (2:45)
1. (0:00) Problem: vendor in Mumbai — invisible online, no way to reach crypto customers. 15 s.
2. (0:15) Customer opens PWA via QR → map of nearby vendors → taps "Ravi's Vegetables".
3. (0:35) Sees fresh stock, follows, adds 2 kg tomatoes.
4. (0:50) Pays: Route A — ETH → Uniswap quote → USDC (show explorer).
5. (1:20) Second order on Expo app: Route B — StreetPay USDT on Whitechain (show explorer).
6. (1:40) Vendor view: verified PAID orders, confirm pickup, one-click partial refund, CSV export.
7. (2:05) Vendor snaps photo of mangoes → 0G creates listing + Hindi announcement (request ID visible) → follower gets notification.
8. (2:30) Customer earns ST points. Close: "Discover locally, pay onchain." 

## Fallbacks
- Uniswap testnet pool fails → demo Route B only; keep Uniswap integration as quote + tx built, explain.
- Privy fails in Expo Go → Expo app opens PWA checkout via deep link.
- Mapbox native → WebView with Mapbox GL JS.
- 0G latency → show spinner + cached last result, but every demo run must be a real call.

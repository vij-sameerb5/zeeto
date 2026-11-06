# AI usage

ETHGlobal asks every team to say where and how AI tools were used. This log is updated with each feature.

## Planning (before the event)
Pre-event planning documents were written with Claude (Anthropic): product spec, architecture, data model,
integration notes, wireframes, prize requirements and checklists. They are in `docs/spec/` as the spec this
build follows. An earlier prototype of the same idea (named STREETLAYER) was explored before the event;
none of its code is in this repository.

## During the hackathon
| Time (IST) | Tool | What it did | Files |
|---|---|---|---|
| Nov 5, 21:05 | Claude | Repo scaffold, monorepo config | root files |
| Nov 5, 21:15 | Claude | Shared core: types, rails, demo data, mock services | `packages/core` |
| Nov 5, 21:35 | Claude | Web app shell, design tokens, landing page with video hero | `apps/web` |
| Nov 5, 21:50 | Claude | Explore: offline street map, stall list, stories, filters | `apps/web/src/screens/customer/Explore.tsx`, `components/*` |
| Nov 5, 22:15 | Claude | Architecture and build blueprint for the full platform (API, Whitechain checkout, Arkiv, 0G, WhatsApp) | `docs/ARCHITECTURE.md`, `docs/BLUEPRINT.md` |
| Nov 5, 22:40 | Claude | Expo mobile app: welcome, map explore, stall, bag + mock USDT pay, order with pickup code, orders, points | `apps/mobile` |
| Nov 5, 22:55 | Claude | Mobile: home feed + stories, wallet tab, seller mode (orders hand-over with pickup code, Snap & Sell with camera, stock) | `apps/mobile/src` |
| Nov 5, 23:05 | Claude | Web: stall route, bag + 4-step pay flow, order page with pickup QR, orders, feed, rewards, wallet; merchant dashboard (overview, orders accept/reject/hand-over, products + Snap & Sell, payments + CSV + refunds, store + QR); vendor onboarding `/join`. Mobile: accept/reject. Core: `accepted` status, payment intent. Contract: StreetPayCheckout + 17 Foundry tests. System map. | `apps/web/src`, `apps/mobile/src`, `packages/core`, `contracts/`, `docs/system-map.html` |
| Nov 5, 23:58 | Claude | Pay at the counter: stall Collect screen (keypad or items → single-use bill QR, payment sound), printed shop QR `/p/:id`, customer pay page `/pay/r/:id`; shared pay-flow component; system map: workflow, ways in, shop types, counter | `apps/web/src`, `docs/system-map.html` |
| Nov 6, 02:30 | Claude | Privy login (SMS/email, embedded wallet on Whitechain 1874), real WBT/USDT balances from the RPC, admin dashboard (roles, stall verify/suspend, orders, live system checks), Mapbox map, Supabase schema with RLS, Expo scan-to-pay. Verified Whitechain network: chain 1874 not 2625. | `apps/web/src`, `apps/mobile/src`, `supabase/schema.sql`, `packages/core/src/chain.ts` |
| Nov 6, 06:00 | Claude | Real payments for app-created stalls, Paytm-style flow (name + spoken code, arrived, cancel-before-accept, one-tap hand-over), mobile app brought level with web, /app-link sign-in for Expo | `apps/web/src`, `apps/mobile/src` |
| Nov 6, 07:00 | Claude | Server API (Vercel functions): Privy JWT auth, Supabase, server-side pricing, order state machine, bills, Gemini Snap & Sell, Uniswap proxy, WhatsApp webhook | `apps/web/api`, `supabase/schema.sql` |
| Nov 6, 12:00 | Claude | ZeetoCheckout contract (EIP-3009 gas-free pay + refunds) with unit tests and a live-USDT fork test; relayer with drain limits; Checkout API, checkout.js, signed webhooks, example store; live admin; zero-crypto payer UI; mobile stall-grid fix, stories/offers, inbox, GPS; README, SETUP, WHATSAPP, WHITECHAIN_FEEDBACK | `contracts/`, `apps/web`, `apps/mobile`, `examples/store`, `docs/` |
| Nov 6, 15:40 | Claude | Per-stall loyalty cards with visit tiers, regulars for shopkeepers, wallet-style pass (Apple Wallet coming soon) | `packages/core/src/loyalty.ts`, `apps/web`, `apps/mobile` |

Human decisions: product idea, features, prize selection (Whitechain Operate), business rules (per-stall loyalty, pickup by name + code), design direction, vendor research, keys/deploys, testing and review. Every commit is made by the author.

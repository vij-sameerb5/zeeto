# Zeeto build journal: ETHGlobal Mumbai 2026

All times IST. Repo: github.com/vij-sameerb5/zeeto (Sameer does every git command; no co-authors).

## Nov 5

- **21:00** Hacking started. Decided to build from scratch in a new repo (`zeeto`). The old STREETLAYER prototype stays untouched as a reference only. Pre-event planning is disclosed in `docs/spec/`.
- **21:05–21:50** Scaffold (npm workspaces), shared core (types, 25 stalls, 56 products, mock services), web shell with the black / chalk / orange design, video landing page, Explore (offline street map, list, stories, filters).
- **21:30–21:50** Fixed git authorship so every commit is `vij-sameerb5` via the GitHub noreply email. Repo recreated so the Contributors box shows only vij-sameerb5.
- **22:15** New direction from Sameer's blueprint notes: one platform with customer, merchant and WhatsApp front doors; Whitechain USDT checkout as the core; Arkiv for public data; 0G for vendor AI. Wrote `docs/ARCHITECTURE.md` and `docs/BLUEPRINT.md`. Partner shortlist changed to Whitechain, Arkiv, 0G, with Uniswap as backup (to confirm on the ETHGlobal dashboard).
- **22:40** Expo mobile app: welcome, Apple-maps explore with photo pins, stall, bag + mock USDT pay, order with pickup code, orders, points.
- **22:45** Expo Go hung on the phone. Cause: the venue Wi-Fi hands out `100.x` addresses and blocks phone-to-laptop traffic. Fix: `npx expo start --tunnel`. Then fixed stretched avatars and map pins (new React Native architecture needs explicit image sizes).
- **22:55** Mobile: home feed with stories, wallet tab, seller mode (orders, Snap & Sell with camera, stock).
- **22:52** Sameer asked: keep AI_USAGE.md, ARCHITECTURE.md and BLUEPRINT.md out of git; build everything that doesn't need API keys; diagrams; security first.
- **23:05** Web, complete front end:
  - Customer: the stall page is now routed (`/s/:id`; it used to bounce to the landing page), bag with a 4-step pay flow (lock price, approve, pay, confirm onchain), order page with pickup QR and progress, orders, feed, rewards, wallet.
  - Merchant (5 sections): Overview, Orders (accept / reject with refund / ready / hand-over by pickup code with 5-try limit), Products (price, stock, add, Snap & Sell), Payments (totals, partial refunds, CSV export safe against formula injection), Store (open/closed, photos, profile, hours, YouTube, WhatsApp number, printable shop QR).
  - Vendor onboarding `/join`: phone + OTP, shop, location + hours, wallet, live.
  - Core: new `accepted` order state; a `PaymentIntent` matching the contract.
- **23:05** `contracts/StreetPayCheckout.sol`: EIP-712 signed intents (payer, stall, amount, expiry), one payment per order, USDT goes straight to the stall, capped refunds by the stall, pause, signer rotation, USDT-style no-return tokens handled, malleable signatures rejected. 17 Foundry tests pass, including a fuzz test. Not deployed yet; that needs keys.
- **23:05** System map artifact: journey, architecture, payment sequence, order states, onboarding, WhatsApp, built vs waiting, safety rules. A copy is in `docs/system-map.html`.

### Checks run
- Web: `tsc` clean, production build OK, 13 screens screenshotted at phone + desktop with no console errors, full pay flow clicked through.
- Mobile: `tsc` clean, `expo-doctor` 20/20, iOS bundle exports.
- Contract: `forge test`, 17/17 passing.

### Waiting on Sameer (keys / accounts)
Whitechain RPC + deployer key + test WBT + test USDT · intent signer key · Supabase project · Privy app id · Mapbox token · Arkiv network + key · 0G key · Meta WhatsApp test number.

### Next
1. Deploy StreetPayCheckout to Whitechain Sepolia, put its address in `chain.ts`.
2. `apps/api`: Express + Supabase schema + Privy auth + intent signing + receipt verification + log watcher.
3. Swap mocks for real services one at a time (payments → Arkiv → 0G → WhatsApp), keeping the "Simulated" labels honest.

## Nov 6 · 22:15–23:30 · First screen, Gemini in WhatsApp, launch checklist

Earlier this evening: **ZeetoCheckout deployed** to Whitechain Sepolia at `0xB3D0d4FB70f1C09C311194E322CDE225eCf3f22f` (tx `0xfd15e6f2…6054`, owner = deployer wallet). Explorer verification failed only because Blockscout's verifier was down; retry command in docs/SETUP.md.

### Built
- **Role chooser + sign in/up on open.** Web `/start` and phone Welcome: "I'm shopping" / "I run a stall or shop" → one sign-in step (new phone/email = new account + wallet) → customers land on Explore, merchants on Join (or their dashboard if they already have a stall). "Just look around" stays for judges. Landing buttons and the installed PWA go through it; signing out on the phone returns to it.
- **MetaMask top-up.** Wallet → "Add USDT from MetaMask": QR + address + 3 steps. Test USDT in a MetaMask wallet is moved once into the Zeeto wallet; paying after that is gas-free.
- **Gemini inside WhatsApp.** Stall sends a stock photo → Gemini listing draft → `publish` puts it live. Free text in any language from stalls (`250 ka bill bana do`, `aaj 20 kilo tamatar 40`) or customers (`chai kahan milegi?`, `ravi bhaiya ko 60 rupaye bhejo`) is mapped to one existing command, which runs with its normal checks. Per-phone AI limit, drafts private and expiring. Gemini code shared in `api/_lib/gemini.ts`.
- `npm run test:whatsapp`: offline test of the webhook with fake Meta/Supabase/Gemini.
- Launch checklist artifact ("you vs me") with how to verify each step.

### Checks
web tsc + build · api tsc · `test:whatsapp` 8/8 · Playwright: /start merchant → /join, customer → /explore, wallet top-up, 12 routes, no page errors · mobile tsc + Android export.

### Waiting on Sameer
Push · Vercel import + env + SITE_URL + redeploy · Privy allowed origin · `/api/health` all true · mobile `.env` · WhatsApp webhook + test recipients send `hi` · move 20 USDT from MetaMask customer wallet to the Zeeto wallet · first real payment · retry contract verification · demo video.

## Nov 6 · 11:55–13:30 · Whitechain-first rebuild (Arkiv out, Operate track in)

**Decision:** drop Arkiv (it wasn't read by anything, so it wouldn't qualify) and go all-in on Whitechain's **Operate · Stablecoin Payments for Business** ($5k), whose rules reject "a pay button that sends a plain transfer" and ask for a drop-in piece a separate app adds in ~20 lines, both views in the demo, and extra credit for refunds/exports.

### Built
- **ZeetoCheckout.sol** (new, replaces StreetPayCheckout): gas-free payments via USDT's EIP-3009 `receiveWithAuthorization`; stall + order bound into the signed nonce; payments keyed by (orderRef, payer) so front-running can't block an order; stall-signed refunds capped onchain and only to the payer; pause = new payments only; two-step ownership; holds no funds. **15 unit tests + a fork test against the live Whitechain USDT** (real pay + partial refund succeeded on a fork of chain 1874).
- Server: contract flow (intent → signature check → relayer simulate/send → Paid event → settle), fallback self-submit, **relayer drain protection** (min order, per-user/stall daily caps, daily gas budget, gas-price ceiling, WBT-only hot wallet, relay_log), **Checkout API** (`/api/checkout`, secret keys hashed), **signed webhooks**, merchant **Developers** page, **live Admin** (stalls verify/suspend, roles, orders, relayer health, webhooks), accountant CSV with receipt links + gas.
- `checkout.js` drop-in SDK + `examples/store` (a chai shop site, ~20-line integration).
- Payer UI with zero crypto words on real stalls ("Pay ₹120" → "Paid · Public receipt"); Privy wallet pop-ups off.
- Mobile: fixed the broken stall product grid (Image sizing on the new architecture), merchant **Post** tab (stories + offers to followers), notification **inbox** with bell, real GPS "near me" on the map, crypto chips removed from stall pages.
- Docs: README (why onchain stablecoins, architecture, relayer economics, limitations, AI use), WHITECHAIN_FEEDBACK.md, docs/SETUP.md, docs/WHATSAPP.md, this ARCHITECTURE rewrite.

### Findings
- USDT domain is `{ name: "Tether USD", version: "1" }` (version() and eip712Domain() revert; matched DOMAIN_SEPARATOR by hashing).
- UniswapX (gasless) is mainnet-only per Uniswap's supported-chains page, so no gas-free "pay with any token" on testnet.

### Checks
forge 16/16 · web tsc + build · api tsc · mobile tsc + Android export · 19 web routes render with no errors · demo pay → handover and cancel → refund flows pass · mobile stall/post/inbox screenshots verified.

### Waiting on Sameer
Run schema · deployer + relayer wallets funded with WBT · deploy + verify ZeetoCheckout · Vercel env + deploy · Privy allowed origins · test USDT on YetiTrade · first real payment → README link · demo video · regular commits.


## Nov 6 · 00:00–11:00 · Logins, real payments, server

- Privy sign-in (SMS + email, embedded wallet on Whitechain 1874), admin dashboard, Mapbox map, Whitechain RPC checked (chain 1874, USDT verified; 2625 was the wrong network).
- Real USDT payments for app-created stalls (verified Transfer + order memo), Paytm-style flow: no QR at pickup, name + spoken code, "I'm at the stall", cancel-before-accept, one-tap hand over, refunds from the stall's wallet.
- Phone app brought level with the web (rules, seller QR, money tab, Privy wallet link via /app-link, real balances, Uniswap sheet, offline persistence).
- Server API on Vercel functions + Supabase (Privy JWT, server-side pricing, conditional state transitions), Gemini Snap & Sell, Uniswap Trading API proxy, WhatsApp webhook (pay links + stall commands). Gas-free payment signature format proven against the live USDT.

# ETHGlobal Mumbai — Zeeto submission answers

**Project name:** Zeeto
**Category:** DeFi (alt: Payments / Consumer)
**Emoji:** 🛺
**Demo link:** https://zeeto.vercel.app
**Repo:** https://github.com/vij-sameerb5/zeeto

## Short description (≤100 chars)
Gas-free USDT checkout for street stalls: order, pay with one signature, pick up. Web + mobile.

## Description (≥280 chars)
Street stalls and small shops run on cash and UPI, but a growing number of customers (tourists, freelancers paid in crypto, NRIs) hold stablecoins instead. Zeeto lets any stall accept USDT on Whitechain with no gas, no seed phrase and no new hardware.

Customers sign in with a phone number or email (a wallet is made for them), explore live stalls on a map, add items to a bag and pay with one signature. A relayer submits the payment and pays the gas, so the customer never needs a gas token. They get a pickup code and loyalty points; the stall sees the order live, taps Accept → Packed → Hand over and checks the code.

Merchants get a dashboard with sales, busiest hours, best sellers, stock, receipts with explorer links, capped refunds and an AI assistant (Gemini) that answers questions about their own sales and turns a photo into a menu listing. One contract supports 7 ways to pay: order ahead, counter amount, printed stall QR, bill QR, WhatsApp pay link, a website checkout API and bring-your-own MetaMask. WhatsApp ordering for stalls is built and is coming next.

## How it's made (≥280 chars)
Contract: ZeetoCheckout (Solidity, Foundry) on Whitechain Sepolia (chain 1874) at 0xB3D0d4FB70f1C09C311194E322CDE225eCf3f22f. Whitechain's test USDT supports EIP-3009, so the customer signs a receiveWithAuthorization message off-chain. The nonce is derived from the order reference and the stall address, so a signature can only pay that stall, for that order, once. The contract pulls the USDT, checks the exact amount arrived, forwards it to the stall and emits Paid(orderRef, payer, merchant, amount, relayer). It holds no funds and has no withdraw function; refunds are capped at the amount paid.

Relayer: a Vercel serverless function holds a separate relayer key, checks the order server-side (prices, stall, amount), caps the gas price, submits pay() and reconciles from Paid logs if a request is retried, so an order can't be charged twice.

Apps: React + Vite PWA (web, customer + merchant) and Expo / React Native (phone). Privy for phone/email/MetaMask login and embedded wallets; the phone app hands off to a secure checkout page for the single signature and returns with the result. Supabase stores stalls, products and orders. viem for chain calls. Gemini drafts listings from photos and answers merchant questions — it never moves money. WhatsApp Cloud API webhook (commands, buttons, photo → listing) is built and tested offline. A fork test replays the full gas-free payment against the real USDT contract.

Hacky bit: Expo Go can't host the wallet signature, so the app creates the order natively and opens /app-pay/:id with a whitelisted return URL (zeeto:/exp:) — one tap, sign, back in the app with the pickup code.

## Tech stack
Solidity, Foundry, TypeScript, React, Vite, Expo/React Native, viem, Privy, Supabase, Vercel, Google Gemini, WhatsApp Cloud API, Mapbox, Tailwind.

## AI usage
Claude (Anthropic) was used as a coding assistant for scaffolding, UI, API routes, tests and docs; every change is logged with timestamps in AI_USAGE.md. Google Gemini runs inside the product (photo → listing drafts, merchant Q&A, WhatsApp intent) and can only draft or pick a command, never move funds. Product idea, prize choice, design direction, vendor research, testing and review were done by the team.

## Prize: Whitechain — Operate · Stablecoin Payments
**Why applicable:** Zeeto is a working stablecoin payment product on Whitechain: real USDT payments for real orders, gas paid by a relayer, an on-chain receipt for every order, refunds, and a merchant dashboard on top. First live payment: tx 0x1803cf45f3806e61b22ddafd4b467dbb2050e1bd15e1ae19f072cd989a941e65.
**Code link:** https://github.com/vij-sameerb5/zeeto/blob/main/contracts/src/ZeetoCheckout.sol#L107
**Ease (1–10):** fill in your own rating
**Feedback:** see WHITECHAIN_FEEDBACK.md (copy the top 2–3 points).

## Prize: Uniswap Foundation
**Status warning:** `/api/uniswap` (Trading API quote + swap, server-side key) is in the code, but production health shows `uniswap: false` — UNISWAP_API_KEY isn't set in Vercel. Either add the key and redeploy before submitting, or skip this prize.
**Why applicable (if key added):** customers with ETH but no stablecoin get a Uniswap Trading API quote (EXACT_OUTPUT, V4/V3/V2 routing) for the exact USDC they need and sign the swap in their wallet before paying; the API key stays server-side.
**Code link:** https://github.com/vij-sameerb5/zeeto/blob/main/apps/web/api/uniswap.ts

## Media
- Logo: the orange "Z" mark (square PNG, 512×512)
- Cover: a still from the demo video (logo scene or "7 ways to pay")
- Screenshots (≥3): Explore map with stalls · phone pickup pass LR-473 · merchant dashboard · Whitechain explorer tx · 7 ways to pay

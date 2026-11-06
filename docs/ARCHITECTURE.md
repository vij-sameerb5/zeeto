# Zeeto architecture (v3, Nov 6 2026)

Zeeto lets street stalls and small shops take **USDT on Whitechain** from anyone with a phone number, gas-free for the payer, with orders, refunds, receipts and a merchant API. This file is the source of truth for how it works and the rules it enforces.

## 1. Parties

| Party | What they use | What they can do |
|---|---|---|
| Customer | Web app / phone app / WhatsApp / a store's "Pay with Zeeto" | Sign in (phone/email), browse, pay, track, say "I'm here", cancel before accept, earn points |
| Stall (merchant) | Seller dashboard (web + phone), WhatsApp commands | Go live, list stock (AI), post stories/offers, collect at the counter, accept → packed → hand over, refund, export, API keys + webhooks |
| Store developer | Checkout API + `checkout.js` + webhooks | Create checkout sessions server-side, confirm, receive signed events |
| Zeeto relayer | Server hot wallet (WBT only) | Submit signed payments/refunds and pay gas. Nothing else. |
| Admin | `/admin` (ADMIN_USERS only) | Verify / suspend / reopen stalls, set roles, watch volume, relayer, webhooks |

## 2. Components

```
apps/web (Vite + React PWA) ── /api (Vercel functions, Node, TypeScript)
  ├─ customer: explore map, stall, bag, pay QR (/p/:stall), bill (/pay/r/:id), orders, rewards, wallet
  ├─ merchant: /sell (overview, collect, orders, products, payments, developers, store), /join
  ├─ admin: /admin (live data when the server is up, demo data otherwise)
  ├─ hosted checkout: /pay/r/:id  (bills, WhatsApp links, Checkout API sessions)
  └─ public/checkout.js (drop-in SDK)
apps/web/api
  ├─ health · stalls · products · orders · requests · checkout · admin · ai · uniswap · whatsapp   (10 functions)
  └─ _lib: auth (Privy JWT + server user lookup), chain (contract, signatures, relayer), policy (relayer limits),
          orders (state machine helpers, settle, notify), webhooks (HMAC), wa (WhatsApp), db, env, http, shared
apps/mobile (Expo) ── same stalls/flows; sign-in and real payments hand off to the web pages
contracts/ZeetoCheckout.sol ── Whitechain Sepolia (1874)
supabase/schema.sql ── Postgres, RLS on with no policies (service key only)
examples/store ── a separate shop site using the Checkout API
```

## 3. Money flow (main path)

1. **Order.** The app sends product ids and quantities (or an amount at the counter, or a bill/session id). The server prices it from the database, checks stock, opening status and limits, and stores the order as `paying` with `amount` (USDT base units, ₹84 = $1 demo rate) and `order_ref = keccak256("zeeto:<order>:<stall>:1874")`.
2. **Intent.** The server returns an EIP-712 `ReceiveWithAuthorization` for USDT: `from = customer wallet` (from Privy, never from the request), `to = ZeetoCheckout`, `value = amount`, `validBefore = now + 10 min`, `nonce = ZeetoCheckout.payNonce(order_ref, stall wallet)`, which is read from the contract.
3. **Sign.** The embedded wallet signs silently (`showWalletUIs: false`). No gas, no pop-up; the app shows its own "Pay ₹120".
4. **Check.** The server verifies the signature against the intent it issued (signer, contract, amount, nonce, time window), that the authorization is unused and the balance is enough, and the relayer limits (§6).
5. **Settle.** The relayer simulates and sends `ZeetoCheckout.pay(...)`. The contract pulls the USDT with the authorization, forwards all of it to the stall, records the payment and emits `Paid`.
6. **Confirm.** The server reads the receipt, requires the matching `Paid` event, then marks the order paid in one conditional UPDATE, takes stock, logs gas, and notifies: the stall's dashboard (polling), WhatsApp to both sides, and the store's webhook.

Fallback: if the relayer is off, out of budget or gas spikes, the customer's wallet submits the same `pay` call itself (needs a little WBT). The server verifies the same `Paid` event.

## 4. Business rules (enforced on the server; the UI only mirrors them)

**Order states:** `paying → paid → accepted → ready → done`; counter sales and checkout sessions go `paying → done`; `paid | accepted | ready | done → part-refunded | refunded`; unpaid orders expire after 30 min (`expired`). Every transition is `UPDATE … WHERE status IN (allowed)`, so double taps and two devices can't both win (the loser gets "already moved on").

| Rule | Why |
|---|---|
| Prices, totals and amounts are always computed on the server | The client can't change what it pays |
| One stall per account; payouts go to the owner's own embedded wallet | No one can point a stall's money elsewhere |
| You can't pay your own stall | Stops fake volume and self-dealing |
| Order ₹1–₹20,000; gas-free only from ₹10 | Dust can't burn relayer gas; big tickets need a different flow |
| Max 30 lines, qty 1–100, within stock | Sanity + no overselling |
| Max 5 unpaid orders per customer per 30 min | Stops order spam |
| A bill/session is paid once; it expires (bills 5 min, API sessions 30 min) | No double charge, no stale prices |
| Customer can cancel only while `paid` (before the stall accepts); the stall then can only refund, not accept | Clear, fair cancellation |
| "I'm at the stall" any time from paid to ready | Stall knows to hand over |
| Hand over after the customer says name + code (no QR needed) | Fast at a crowded stall; code shown only to the two parties |
| Refunds: only by the stall owner, only to the original payer, total ≤ paid (also enforced onchain), each refund needs a reason | Customer protection with no chargeback fraud |
| A transaction hash settles at most one order (unique index) | Replay protection |
| Suspended stalls can't take orders or API sessions; refunds still work | Safety valve |

## 5. ZeetoCheckout contract

See `contracts/README.md`. Key properties: no funds held, no withdraw, stall bound in the signed nonce, payments keyed by `(orderRef, payer)`, refunds capped and only to the payer, `receiveWithAuthorization` so mempool signatures can't be front-run, pause stops new payments only, two-step ownership. 15 unit tests + a fork test against the live USDT.

## 6. Relayer: who pays gas and why it can't be drained

- The business side pays gas: Zeeto's relayer sends every payment and refund. Each transaction is logged (`relay_log`) with its gas and stall, shown on the merchant's Developers page ("network fees covered") and in the accountant CSV. On testnet it's funded from the faucet; in production the merchant is billed per payment.
- Limits (env, defaults): `RELAY_MIN_INR=10`, `RELAY_USER_PER_DAY=25`, `RELAY_STALL_PER_DAY=500`, `RELAY_DAILY_GAS_WBT=0.5`, `RELAY_MAX_GWEI=5`. Only server-issued intents are submitted; every call is simulated first; the relayer holds only WBT. A drain can cost at most one day's budget, after which customers fall back to self-submitting.
- Admin shows WBT balance, a low-balance alert, today's gas against the budget, and every relayed transaction.

## 7. Merchant integration (Checkout API)

- `POST /api/checkout` (Bearer `zk_test_…`) creates a session `cs_…` with an amount or items, an optional `reference` (unique per stall), `successUrl` and `cancelUrl`. `GET /api/checkout?id=` returns status, payer, tx hash, explorer link and refunds.
- Hosted page `/pay/r/cs_…`: the shopper signs in and pays gas-free; on success it messages `checkout.js` (`zeeto:paid`) and redirects to `successUrl?zeeto_session=…&zeeto_order=…`. Stores must confirm server-side.
- Webhooks `payment.succeeded` / `payment.refunded`, `Zeeto-Signature: t=…,v1=HMAC-SHA256(secret, "t.body")`, https public hosts only, 5 s timeout, logged.
- Keys: shown once, stored as SHA-256; rotate any time. Webhook secret shown once.

## 8. WhatsApp

See `docs/WHATSAPP.md`. Payments start in chat (`pay ravi 120` → Pay button) and finish with one tap on the hosted checkout, where the customer's wallet signs. Stalls run orders by text (`accept / ready / done <code>`, `bill 250`, `open/close`). Meta-signed webhooks only, idempotent per message id, rate-limited pay links.

**Gemini in WhatsApp:** a stall's photo → listing draft → `publish`; free text in any language from stalls or customers is mapped by Gemini (JSON schema) to exactly one existing command, which then runs with its normal checks. The model never moves money or picks a stall outside the live list. Shared Gemini code is in `api/_lib/gemini.ts`.

## 9. Auth and identity

Privy: SMS + email login, embedded EVM wallet created at login, chain 1874. The server verifies the Privy access token (JWKS, issuer, audience, expiry) and reads the user's wallet, phone and email from Privy's API with the app secret. The wallet used for payouts, payments and refunds always comes from Privy. Admin = listed in `ADMIN_USERS` (server).

**First screen (web `/start`, phone Welcome):** pick *I'm shopping* or *I run a stall*, then sign in or sign up in the same step (a new phone/email makes a new account and wallet). The pick only decides where the app opens (`/explore` vs `/join` or `/sell`); being a merchant is still decided by the server when a stall is created with that login. Test USDT held in MetaMask is moved into the Zeeto wallet once (Wallet → "Add USDT from MetaMask"); payments after that are gas-free.

The phone app (Expo Go) can't run Privy natively: it opens `/app-link` in an in-app browser, the user signs in, and only the public address and a masked label come back (allowed return schemes: `zeeto:`, `exp:`, `exps:`).

## 10. Data (Supabase)

`users, vendors, products, orders, pay_requests, relay_log, webhook_log, wa_messages, ai_runs`. RLS is on for every table with no policies, so only the API's secret key can read or write. The public stalls endpoint selects only public columns (never keys, webhook secrets or phone numbers).

## 11. AI (Gemini)

`/api/ai`: Snap & Sell (photo → up to 6 listings with price, unit and quantity, plus a note to followers in Hindi, Marathi and Gujarati) and voice/text drafts. JSON schema enforced and re-validated on the server, signed-in users only, 20/min, key server-side. The stall always confirms prices before anything goes live.

## 12. Uniswap

`/api/uniswap` proxies the Trading API (quote + swap tx) with the key on the server; the Wallet "Swap ETH → USDC" signs on Unichain Sepolia. UniswapX (gasless) isn't available on testnets, so Uniswap isn't in the gas-free main flow.

## 13. Phone app

Expo SDK 58. Home feed with stories, an inbox for offers and order updates, map with real GPS ("near me"), stall pages, bag (StreetPay / Uniswap rails, simulated on demo stalls), orders with name + code pickup, points with redeem, wallet with real balances after sign-in and the Uniswap sheet, scan-to-pay, and seller mode (orders with the same rules, Post: stories + offers to followers, QR, Snap & Sell with the camera, stock, money). State persists on the device (AsyncStorage).

## 14. Security checklist

- [x] Server-side pricing; client can't set amounts, wallets or roles
- [x] Privy JWT verified on every private call; wallet from Privy, not the request
- [x] Conditional state transitions; unique tx hash per order
- [x] Signatures checked before gas; simulation before send; gas-price ceiling; daily budgets
- [x] Contract: no custody, payer/stall bound in the signature, capped refunds, no withdraw
- [x] Secrets only in server env; API keys hashed; webhook HMAC; SSRF-safe webhook URLs
- [x] Meta webhook signature check; idempotent message handling
- [x] RLS with no public policies; public endpoints return public columns only
- [x] Upload limits (image types, size); input lengths and ranges validated
- [x] CSV export defuses spreadsheet formulas
- [ ] Next: webhook retries with backoff, per-merchant gas tanks / paymaster, audit of the contract by a third party

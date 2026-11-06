# Zeeto

**Gas-free USDT checkout for street stalls and small shops, on Whitechain.**
A customer scans a stall's QR (or taps a WhatsApp pay link, or a store's "Pay with Zeeto" button), signs in with their phone number, and pays in rupees. They never see a wallet, a seed phrase, a token, a chain or a gas fee. The stall gets USDT in its own wallet within seconds, with an onchain receipt, one-tap refunds and an export for its accountant.

Built at ETHGlobal Mumbai 2026 · Whitechain track: **Operate · Stablecoin Payments for Business**

| | |
|---|---|
| Live app | _add your Vercel URL_ |
| ZeetoCheckout (Whitechain Sepolia) | [`0xB3D0d4FB70f1C09C311194E322CDE225eCf3f22f`](https://explorer.testnet.whitechain.io/address/0xB3D0d4FB70f1C09C311194E322CDE225eCf3f22f) · deploy tx [`0xfd15e6f2…`](https://explorer.testnet.whitechain.io/tx/0xfd15e6f29bd27e15a1b7fc7849e8e6de77a54152474596278ad025bf722d6054) · verification pending (explorer verification service was down on Nov 6) |
| First USDT payment through the main flow | _add after first payment:_ `https://explorer.testnet.whitechain.io/tx/<TX>` |
| Demo video (2–4 min) | _add link_ |

## Why this needs onchain stablecoin settlement on Whitechain

A Kalbadevi sabzi stall can't get a card terminal, and UPI only works for Indian bank accounts. Tourists, NRIs, gig workers paid in stablecoins, and the stall's own suppliers abroad can't pay it at all. With USDT on Whitechain the stall gets final settlement in seconds, in a dollar asset, to a wallet it controls, with no acquirer, no chargebacks and no 2–3% MDR. Refund limits, one-payment-per-order and the receipt are enforced by a public contract that the customer can check themselves. A regular rail can't give a street stall programmable refunds, a public receipt and cross-border acceptance from day one, and it can't let a business pay its customers' fees per transaction the way our relayer does.

## How a payment works

```
Customer phone ──(1) Pay ₹120──▶ Zeeto app ──(2) create order──▶ Zeeto API ── prices from DB, intent ──┐
     ▲   (embedded Privy wallet signs an EIP-3009 ReceiveWithAuthorization, silently, no gas)          │
     └──────────────────────────────(3) signature──────────────────────────────▶ Zeeto API            │
                                                                                     │ checks signer, amount,
                                                                                     │ nonce, limits, simulates
                                                    (4) relayer pays WBT gas ────────▼
                                         ZeetoCheckout.pay(orderRef, payer, stall, amount, sig)
                                           ├─ USDT.receiveWithAuthorization(payer → checkout)  (only the payee can call)
                                           ├─ forward 100% to the stall's wallet, keep nothing
                                           └─ emit Paid(orderRef, payer, stall, amount, relayer)
                                                             │
     (5) API reads the Paid event ◀──────────────────────────┘
         → order "paid" · stall's phone dings · WhatsApp to both · signed webhook to the store · receipt link
```

* **No crypto steps for the payer.** Privy creates an embedded wallet at phone/email sign-in (`showWalletUIs: false`, so no wallet pop-ups). The app shows "Pay ₹120", then "Paid". The receipt link is optional.
* **The business pays the gas.** Zeeto's relayer submits every payment and refund and pays WBT. Each relayed transaction is logged with its gas cost and stall, so the merchant dashboard shows "network fees covered" and the CSV export lists gas per order. In production the merchant is billed for that (or a flat fee per payment); on testnet the relayer is topped up from the Whitechain faucet.
* **Fallback.** If the relayer is down or over its daily budget, the same signature can be submitted to the contract from the payer's own wallet. Money still only moves through ZeetoCheckout.

### What stops anyone draining the relayer

1. It only submits intents this server issued, for orders it created, signed by that order's own customer (or, for refunds, by the stall's owner). Anything else is rejected before any gas is spent.
2. Every call is simulated first. A payment that would revert costs nothing.
3. Minimum order (`RELAY_MIN_INR`, default ₹10), per-customer and per-stall daily caps, a global daily gas budget (`RELAY_DAILY_GAS_WBT`) and a gas-price ceiling (`RELAY_MAX_GWEI`).
4. The relayer holds only WBT, never USDT. The contract moves the money; the relayer just pays for the transaction. The worst a drain can cost is one day's budget.
5. The admin dashboard shows the relayer's WBT, a low-balance warning, gas spent today against the budget, and every relayed transaction.

## ZeetoCheckout (the contract)

`contracts/src/ZeetoCheckout.sol`, no dependencies, about 200 lines.

* `pay(orderRef, payer, merchant, amount, validAfter, validBefore, sig)`: pulls exactly what the customer signed via `receiveWithAuthorization`, forwards it all to the stall, and records the payment. The EIP-3009 nonce is `payNonce(orderRef, merchant)`, so **the stall and the order are inside the signature**: a relayer can't redirect money or reuse a signature.
* `refund(orderRef, payer, amount, …, stallSig)`: the stall signs; money only ever goes back to the original payer; total refunds are capped at what was paid; each refund has its own nonce so it can't be replayed.
* Payments are stored per `(orderRef, payer)`, so nobody can front-run a payment with their own money to block a customer's order.
* `receiveWithAuthorization`, not `transferWithAuthorization`: it only works when the caller is the payee (the contract), so a signature seen in the mempool can't be front-run into a plain transfer.
* The owner can only pause *new payments* (refunds always work) and transfer ownership in two steps. The contract holds no funds and has no withdraw.

Tests: `cd contracts && forge test` (16 tests). `forge test --match-contract ZeetoCheckoutForkTest --fork-url https://rpc.testnet.whitechain.io` runs a real payment and refund against **the live Whitechain USDT** on a fork. That's how we confirmed USDT's EIP-712 domain (`"Tether USD"`, version `"1"`) and its `receiveWithAuthorization`.

## Drop-in for any store: Zeeto Checkout API + `checkout.js`

A separate website adds Zeeto in about 20 lines (see `examples/store`, a chai shop's site):

```js
// your backend: create a checkout session (secret key from Zeeto → Payments → Developers)
const s = await fetch(`${ZEETO}/api/checkout`, { method: 'POST',
  headers: { Authorization: `Bearer ${ZEETO_SECRET_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ amountInr: 100, reference: 'order-42', successUrl: 'https://shop.com/thanks' }) }).then(r => r.json());
```
```html
<!-- your page -->
<script src="https://YOUR-ZEETO/checkout.js"></script>
<script>Zeeto.button('#pay', { createSession: () => fetch('/api/pay', { method: 'POST' }).then(r => r.json()), onPaid: confirmOnServer })</script>
```
* `GET /api/checkout?id=cs_…` with the same key returns status, payer, tx hash and explorer link.
* Webhooks `payment.succeeded` and `payment.refunded`, signed `Zeeto-Signature: t=…,v1=HMAC-SHA256(secret, "t.body")`. Only public https URLs are accepted.
* Secret keys are shown once and stored as SHA-256 hashes.

## Both sides of the product

**Customer (web + phone app):** map of nearby stalls (Mapbox; real GPS on the phone), stall pages with stock, stories and offers, bag → one-tap pay, scan a stall's QR and type the amount, pay a bill QR, order tracking with a spoken pickup code (no QR to show), "I'm at the stall", cancel-before-accept, points and rewards, notification inbox.

**Merchant:** go live in 4 steps with a phone number (payouts to their own embedded wallet), orders (accept → packed → hand over, one tap; reject or refund with a reason), counter QR and bill QR with a spoken "payment received" sound, products with AI Snap & Sell (Gemini: photo → listings + a note to followers in Hindi/Marathi/Gujarati), stories and offers to followers, payments with partial refunds and an accountant CSV (receipt URL, refunds, gas covered), developer keys and webhooks, WhatsApp commands.

**Admin:** live volume, stalls (verify / suspend / reopen), users and roles, every order with its receipt, relayer health and gas budget, webhook deliveries, system checks.

**WhatsApp:** a customer texts `pay ravi 120` and gets a Pay button; stalls reply `accept AB-123`, `ready AB-123`, `bill 250`, `orders`. Both sides get paid/ready/refund messages. Money never moves inside WhatsApp: the button opens the hosted checkout, where the customer's own wallet signs. See `docs/WHATSAPP.md`.

## Architecture

```
apps/web        React + Vite PWA (customer, merchant, admin, hosted checkout, /checkout.js)
apps/web/api    Vercel functions (TypeScript): orders, stalls, products, checkout API, requests, admin, ai, uniswap, whatsapp, health
apps/mobile     Expo (React Native) app; sign-in and real payments hand off to the web pages (Privy native needs a dev build)
packages/core   shared types, demo data, categories, constants
contracts       ZeetoCheckout (Foundry, no dependencies) + tests + live-chain fork test
supabase        schema.sql (RLS on, no public policies: only the API's service key reads/writes)
examples/store  a separate shop website integrating Zeeto Checkout
```

Security choices: prices and amounts are always computed on the server; payout and refund wallets come from Privy's server API, never from requests; every order transition is a conditional UPDATE (no double accept/refund); one transaction hash settles one order (unique index); webhook URLs can't target private networks; uploads are size-limited image data only; secrets live only in server env (`VITE_*` is public by design).

## Run it

```bash
npm install                       # repo root (web + core)
cp apps/web/.env.example apps/web/.env.local   # fill what you have; anything missing falls back to demo mode
npm run dev                       # web on :5173 (demo mode, no server)
cd apps/web && npx vercel dev     # web + API locally (needs the server env vars)
cd apps/mobile && npm install && npx expo start --tunnel
cd contracts && forge test
```

Full setup (Supabase schema, relayer wallet, contract deploy + verify, Privy, Vercel, WhatsApp): **[docs/SETUP.md](docs/SETUP.md)**.

## Current limitations

* Testnet only (Whitechain Sepolia, test USDT). The INR→USD rate is fixed at ₹84 for the demo.
* The phone app's payments open the hosted web checkout (Expo Go can't run Privy's native SDK); a dev build would sign in-app.
* The stall's own UI shows simulated orders for the built-in demo stalls; real stalls created with a signed-in account use the full server flow.
* Uniswap: live quotes and swaps via the Trading API on Unichain Sepolia (needs a key). UniswapX gasless swaps aren't offered on any testnet, so "pay with any token" isn't part of the gas-free main flow.
* Relayer limits are enforced per server database; a production setup would add a paymaster contract or per-merchant gas tanks.
* Webhooks are delivered once (with a log); retries with backoff are next.

## How we used AI

Claude (Anthropic) was used as a pair programmer throughout the hackathon for code, tests, reviews and docs; every change was reviewed and committed by the author. Google Gemini powers the in-app Snap & Sell feature. Timeline: [AI_USAGE.md](AI_USAGE.md); build log: [docs/JOURNAL.md](docs/JOURNAL.md).

## License

MIT, see [LICENSE](LICENSE).

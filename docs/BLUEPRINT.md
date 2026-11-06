> **Superseded (Nov 5 plan).** Kept to show how the plan changed. Current design: [ARCHITECTURE.md](ARCHITECTURE.md). Arkiv and 0G were dropped on Nov 6 to focus on Whitechain payments.

# Zeeto — Blueprint

> What we are building, in what order, and what "done" means. Written Nov 5, ~22:15 IST at ETHGlobal Mumbai 2026.
> Architecture details live in [ARCHITECTURE.md](./ARCHITECTURE.md).

## 1. The one-line pitch
**Zeeto: every street stall in your neighbourhood, on a map. Follow them, order for pickup, pay in USDT — and vendors run
their shop from a photo, a voice note or a WhatsApp message.**

Starting market: Kalbadevi / Bhuleshwar, Mumbai. Vegetables, chai, snacks, flowers, medical, electrical, hardware, phones,
tailors and more.

## 2. The demo we are building toward
One vendor, one customer, one order, one real USDT payment, start to finish.

| # | Scene | What the judge sees | Partner |
|---|---|---|---|
| 1 | **Vendor lists stock** | Ravi sends a photo of tomatoes on WhatsApp → Zeeto replies with a draft (Tomatoes, 10 kg, ₹30/kg) → he replies YES | 0G |
| 2 | **It goes public** | The listing is published to Arkiv; the customer app shows it with a "from Arkiv" badge and entity link | Arkiv |
| 3 | **Customer finds it** | Priya opens Zeeto, sees Ravi's pin on the Mapbox map, opens his stall, adds 2 kg tomatoes | — |
| 4 | **Customer pays** | Logs in with phone (Privy wallet, no MetaMask) → pays USDT on Whitechain → API verifies the tx → pickup code | Whitechain |
| 5 | **Vendor is told** | Ravi's merchant screen pings and he gets a WhatsApp: "New paid order #1024 · ₹60" → Accept → Ready | — |
| 6 | **Pickup** | Priya shows code 4821 → Ravi enters it → order completed → Priya earns points; Ravi's Payments tab shows the tx link | Whitechain |

If only one thing works on demo day, it must be scenes 3 → 4 → 6 with a real transaction.

## 3. Scope

### P0 — must work (the critical path)
- [ ] API + Postgres/PostGIS + Supabase storage running
- [ ] Privy login, embedded wallets for customer and merchant
- [ ] Merchant onboarding: shop name, category, pin on map, hours, go live, QR code
- [ ] Products: add/edit, price, stock, photo upload
- [ ] Mapbox map with real vendor coordinates, nearby query, filters
- [ ] Stall page, bag, pickup order
- [ ] `StreetPayCheckout` deployed on Whitechain Sepolia, verified on explorer
- [ ] Customer pays USDT; API verifies `Paid` event before marking paid
- [ ] Merchant orders: accept / reject / ready / complete with pickup code
- [ ] Merchant payments tab with tx links
- [ ] Arkiv: publish vendor + listings, customer app reads them back

### P1 — what makes it stand out
- [ ] Snap & Sell on 0G (photo → draft → confirm → publish)
- [ ] WhatsApp text assistant: add stock, set price, sales today, pending orders, mark ready
- [ ] WhatsApp order notification to the vendor
- [ ] Voice note → stock update
- [ ] Refund (merchant-initiated, on-chain)
- [ ] Points earned on completed orders

### P2 — only if P0 + P1 are solid
- [ ] AI insights and promotions in Hindi / Marathi / English
- [ ] Uniswap ETH→USDC second rail on Unichain
- [ ] Expo mobile app
- [ ] Feed, stories, rewards redemption polish

### Out of scope (say so if asked)
Delivery, INR/UPI payout or off-ramp, multiple neighbourhoods, subscriptions, POS integrations.

## 4. Partner prizes (max 3)

| Partner | What we submit | Proof for judges | Priority |
|---|---|---|---|
| **Whitechain** | StreetPay: merchant checkout in USDT with an on-chain order ref, verified by the backend, with refunds | verified contract, tx links in the merchant dashboard, demo video | 1 |
| **Arkiv** | Public marketplace layer: vendors, listings and announcements written to Arkiv and read back by the app | entity keys in UI, query code, schema in docs | 2 |
| **0G** | Vendor AI: Snap & Sell, WhatsApp/voice command parsing | real request ids in `ai_runs` and in the UI | 3 |
| Uniswap | optional second rail | — | backup |

**To confirm on the ETHGlobal dashboard before submitting:** that these three are offered at Mumbai, each prize's exact
requirements, and the 3-partner limit. Earlier plans targeted Uniswap instead of Arkiv; this blueprint switches to
Arkiv because the new design actually reads marketplace data from it.

## 5. Build order (time blocks are targets, not promises)

| Block | Work | Done when |
|---|---|---|
| **0 · now** | Run the current web app; add stall page; write these docs | `npm run dev` shows landing, explore, stall |
| **1 · 4–6 h** | `apps/api` skeleton, Supabase schema + seed (25 vendors, 56 products), Privy auth middleware, `/public/vendors`, `/vendors/nearby` | web Explore loads vendors from the API |
| **2 · 3–4 h** | Mapbox on Explore + merchant pin picker; bag + checkout UI; orders API + state machine | order created in DB as `pending_payment` |
| **3 · 6–8 h** | `contracts/` Foundry: StreetPayCheckout + tests → deploy to 1874 → verify; intent + payment endpoints; receipt verification + log watcher; Privy custom chain; gas top-up | one real USDT payment marks an order paid |
| **4 · 3–4 h** | Merchant screens: overview, products, orders (accept/ready/complete), payments, store + QR | full journey works in the browser |
| **5 · 3–4 h** | Arkiv publisher + public reads + badge | listing edit shows up from Arkiv in the customer app |
| **6 · 4–6 h** | 0G Snap & Sell; WhatsApp webhook + text commands + order alert; then voice | scene 1 and 5 work on a phone |
| **7 · rest** | End-to-end test ×3, README, INTEGRATION_STATUS, demo video, submission | checklist in §8 all ticked |

Rule: don't start block *n+1*'s integration until block *n*'s "done when" is true. UI polish can happen in parallel.

## 6. Screens

**Customer** — Landing · Explore (map + list + stories) · Stall (`/s/:id`) · Bag & pay (`/bag`) · Order + pickup code (`/orders/:id`) · Orders · Feed · Rewards · Wallet

**Merchant** (`/sell/*`, five tabs)
| Tab | Contents |
|---|---|
| Overview | today's sales, orders, USDT received, AI insight card |
| Products | list, add/edit, stock, Snap & Sell, voice |
| Orders | new → accept/reject → ready → enter pickup code |
| Payments | verified payments with explorer links, refunds, CSV |
| Store | profile, photos, YouTube, hours, map pin, QR code, WhatsApp number |

**Onboarding** — I'm a vendor → phone OTP (Privy) → shop name + category → pin location → hours → first product → go live → QR.

## 7. Risks and fallbacks

| Risk | Fallback |
|---|---|
| Privy doesn't support chain 1874 for embedded wallets | external wallet (injected) for the demo payer; keep Privy for login |
| Embedded wallets have no gas | relayer top-up from the API; document it |
| Whitechain USDT faucet unavailable | ask Whitechain mentors early (block 1, not block 3) |
| Arkiv SDK / network issues | Postgres fallback with an honest "from Postgres" badge; never fake the Arkiv badge |
| 0G has no vision or audio model | 0G for text commands; name the other provider in UI and docs |
| WhatsApp business verification / templates slow | test number + free-form replies inside the 24 h window; record the demo from it |
| Webhook needs public HTTPS | `cloudflared tunnel` to local API |
| Time | cut P2 first, then voice, then refunds — never the payment path |

## 8. Submission checklist
- [ ] Repo public, MIT, readable commit history (one feature per commit, sole author `vij-sameerb5`)
- [ ] README: what it is, how to run, architecture image, partner sections, contract address, explorer links
- [ ] `AI_USAGE.md` updated with every AI-assisted step
- [ ] `docs/INTEGRATION_STATUS.md`: each integration marked **real / partial / mocked**, honestly
- [ ] Pre-event planning disclosed (`docs/spec/`, AI_USAGE); no pre-event code
- [ ] Demo video (≤ 4 min) following §2
- [ ] Each partner's requirements re-read and evidenced
- [ ] Testnet keys rotated after the event

## 9. Working agreement
- Claude writes files in `~/Desktop/zeeto`; **Sameer does every git command** (no co-author lines, author `vij-sameerb5`).
- After each feature: Claude lists changed files + a suggested commit message and adds a row to `AI_USAGE.md`.
- Nothing is called "integrated" until it ran against the real service.
- `~/Desktop/zruchi/v2` and the old STREETLAYER folder are reference only — never edited, never copied from.

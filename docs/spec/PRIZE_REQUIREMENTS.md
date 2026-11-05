# STREETLAYER — Prize Requirements Map

ETHGlobal lets us select **max 3 partner prizes** (tracks of one partner count as one).
**Recommended selection: 0G · Uniswap · Whitechain (Operate).** Arc dropped (must be built inside Arc Studio). Arkiv optional/not selected.

---

## 1. 0G — Build with 0G PC ($5,000) ✅ SELECT
**Feature in STREETLAYER:** "Snap & Sell" vendor AI — vendor photographs stock / speaks in Hindi-Marathi → 0G turns it into listings + a fresh-stock announcement sent to followers. Customer side: AI shopping helper ("2 kg tomatoes + chai near me").
| Requirement | How we meet it | Status |
|---|---|---|
| Inference on 0G PC in main flow | Vision (qwen vision) for product photo → listing; whisper-large-v3 for voice stock update; 0gm-1.0 for announcement text in Hindi/Marathi/English | ☐ |
| Request IDs shown | Show `request_id` chip on every AI result + backend log table | ☐ |
| Reason to return tomorrow | Vendor: daily stock posting in 10 sec. Customer: daily fresh-stock alerts from followed vendors | ☐ |
| One sentence "what breaks without 0G" | "Without 0G, vendors can't turn a photo or voice note into a live listing and announcement — they'd have to type every item and price, which street vendors won't do." | ☐ |
| iAI bonus | Sign in with 0G account, spend own daily credits, balance visibly decreases | ☐ research |
| Not a chat wrapper | AI output = structured listings/announcements, not chat | ☐ |
| Submission | Name, description, public repo + README, video < 3 min, live link, contract addresses, Telegram/X | ☐ |

## 2. Uniswap ($10,000 pool) ✅ SELECT
**Feature:** "Pay with any token" — customer holds ETH (or other token); STREETLAYER quotes the cart price via Uniswap API and swaps to USDC to pay the vendor.
| Requirement | How we meet it | Status |
|---|---|---|
| Integrate Uniswap stack | Uniswap API `/quote` + `/swap` on Unichain Sepolia (1301) or Base Sepolia (84532) | ☐ |
| Public open-source repo | MIT license | ☐ |
| `FEEDBACK.md` | Honest notes on API DX | ☐ |
| Feedback form submitted with link | https://developers.uniswap.org/hackathon-feedback | ☐ |
| README points to exact files/lines | Link `packages/swaps/...` lines | ☐ |
| Stretch | v4 hook (e.g. loyalty-aware fee) — only if time | optional |

## 3. Whitechain — Operate: Stablecoin Payments for Business ($5,000) ✅ SELECT
**Feature:** "StreetPay" — a drop-in merchant checkout (widget + SDK + payment-link API) on Whitechain. STREETLAYER is the separate app that embeds it in ~20 lines.
| Requirement | How we meet it | Status |
|---|---|---|
| Contracts deployed + verified on Whitechain Sepolia (1874) | `StreetPayCheckout.sol` (orders, receipts, refunds) | ☐ |
| ≥1 payment in official USDT `0xcedf…55a7` in main flow + explorer link in README | Customer pays chai order | ☐ |
| README line: why onchain stablecoin settlement | Global customers/tourists pay instantly without INR rails; programmable receipts + refunds verifiable by customer; vendor-to-vendor/supplier settlement | ☐ |
| Drop-in piece (~20 lines in a separate app) | `<StreetPayButton orderId amount merchant />` + REST payment links | ☐ |
| Both views in demo (merchant + customer) | Vendor dashboard + customer phone | ☐ |
| Extra credit: beyond first payment | One-click refund/partial refund + CSV export for accountant | ☐ |
| Steady commit history | Commit every 30–60 min | ☐ |
| Demo 2–4 min showing each party | | ☐ |
| `WHITECHAIN_FEEDBACK.md` | | ☐ |
| Won't place | Plain transfer button, tipping, bill split, custodial INR bridge | avoid |

## 4. Arc / Circle (two tracks, $3,000 each) ❌ NOT SELECTED (reason)
Requires the app to be built end-to-end in **Arc Studio** with the Studio URL submitted and shown in the demo. Conflicts with our React/Expo monorepo and would be a 4th partner (limit is 3). Revisit only if we drop Uniswap.

## 5. Arkiv ($4,000) ⏸ OPTIONAL
Could store vendor profiles, listings and expiring fresh-stock offers (offers naturally expire!). Strong fit, but it would be a 4th partner. Only add if we swap it for Uniswap. Requires `/arkiv/*.md` files and a user-visible read from Arkiv.

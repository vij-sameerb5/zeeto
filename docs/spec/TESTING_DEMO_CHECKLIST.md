# STREETLAYER — Testing & Demo Checklist

## A. Frontend smoke test (now, mocks)
Run `npm run dev`, open on a phone (same Wi-Fi) and a desktop.
- [ ] Welcome → Customer → lands on Explore with Ravi's peek card open
- [ ] Filters: Fresh today, Offers, Following, Takes USDT, Takes ETH dim the right pins
- [ ] Search "tomato" keeps only stalls selling tomatoes; list view sorts by distance
- [ ] Map: drag, zoom, recenter; tapping empty map closes the card
- [ ] Stall page: follow toggles, Add/− respect stock, cart bar total is right
- [ ] Adding from a second stall shows the one-stall warning and starts a new cart
- [ ] Checkout: route disabled when the vendor doesn't accept it; quote loads and refreshes
- [ ] Pay → 4 steps → order page with QR + pickup code + receipt + points
- [ ] Orders tab badge counts open orders; Rewards balance increased
- [ ] Wallet → Switch to vendor view → the new order is in Orders → Hand over with wrong code fails, right code completes
- [ ] Partial refund (tick one item) → customer receipt shows refund; Money shows negative row; CSV includes it
- [ ] Snap & Sell sample → edit price → Publish → customer Fresh feed shows it with request ID; product appears with ✨
- [ ] Voice mode with typed Hindi → listing
- [ ] Stock: toggle off hides Add on the stall page; price edit sticks
- [ ] Dark mode (OS setting) readable on every screen
- [ ] 360 px width: no horizontal scroll
- [ ] Reset demo restores data
- [ ] Expo Go on iPhone: enter LAN URL → app loads, back gesture, pull to refresh, offline screen when server stops
- [ ] Expo Go on Android (borrowed phone): same + hardware back button

## B. Integration tests (hackathon)
| Integration | Pass when |
|---|---|
| Privy | New Google login gets a wallet; same wallet after refresh; chains 1874 + 1301 available |
| Mapbox | Tiles load on deployed domain only; clusters split on zoom |
| 0G | Photo → items JSON in < 10 s; request ID visible in UI and `ai_runs`; voice works for Hindi |
| Uniswap | Real quote on 1301; swap tx lands; vendor wallet USDC up by exact amount; tx link opens |
| Whitechain | Contract verified; real USDT payment; event → order PAID < 15 s; refund ≤ paid; reused orderId reverts |
| Relayer | Customer pays without WBT; 11th tx in a minute is rate-limited |
| API verify | Fake tx hash or wrong amount never marks an order PAID |

Contract tests (Foundry): pay happy path · duplicate orderId reverts · wrong merchant refund reverts · refund > paid reverts · partial then full refund · event fields.

## C. Demo-day checklist
- [ ] PWA deployed on Vercel; QR code to it printed
- [ ] API deployed; DB seeded; health route green
- [ ] Wallets funded: customer (ETH 1301, USDT 1874), vendor, relayer (WBT)
- [ ] One real payment on each route done beforehand; explorer links in README
- [ ] Phone hotspot ready; fallback screen recording of the full flow
- [ ] Mocks switch (`VITE_USE_MOCKS=true`) ready if the network fails
- [ ] Two phones: customer + vendor, both logged in, brightness up

## D. Video (2:30–2:55) — ETHGlobal + 0G limits
- [ ] ≥ 720p, screen-recorded on a laptop (not filmed with a phone)
- [ ] Own voice, no AI voiceover, no sped-up footage, no music-only
- [ ] Shows customer and merchant views, both payment routes, refund, Snap & Sell with request ID, explorer links

## E. Submission
- [ ] Public repo, MIT license, steady commits
- [ ] README: setup, architecture diagram, limitations, AI usage, contract addresses, explorer links
- [ ] FEEDBACK.md + Uniswap form · WHITECHAIN_FEEDBACK.md · 0G "what breaks" sentence
- [ ] Exactly 3 partner prizes selected
- [ ] Disclose pre-event work (this frontend and docs) in the submission

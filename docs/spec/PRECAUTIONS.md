# STREETLAYER — Precautions

Read this before writing a single line of code. Items are ordered by how badly they can hurt us.

---

## 🔴 P0 — Can disqualify us or lose every partner prize

### 1. Do NOT write project code or designs before the hackathon starts
- ETHGlobal "From Scratch" (Classic) rule: all work must begin **after the hackathon officially starts**. Prior **project-specific code, designs, or assets** are not allowed (public libraries / starter kits are OK).
- Projects built before the event **do not qualify for partner prizes or Finalist**. Every prize we want is a partner prize.
- Arkiv's track also says "Built from scratch at ETHGlobal Mumbai".
- **What IS safe before the event:** reading docs, creating accounts and API keys, getting faucet tokens, installing tools, learning SDKs in throwaway scratch folders (delete them), writing plans/notes, talking to vendors.
- **What is NOT safe:** creating the STREETLAYER repo, writing components, contracts, UI mockups in Figma, logos, generating app images.
- This prep folder is planning notes only. Keep it **outside** the hackathon repo. If we use any of it as a spec, disclose it in the submission.

### 2. Only 3 partner prizes can be selected
- ETHGlobal submission lets you select **up to 3 Partner Prizes**. Multiple tracks from the same partner count as 1.
- Our candidates: 0G, Uniswap, Arc (Circle), Whitechain → that's 4. **We must drop one.**
- Recommendation: **0G + Uniswap + Whitechain (Operate)**. Arc requires the app to be *built in Arc Studio* (shown in demo, project URL submitted) — that fights our React/Expo stack and splits our time.
- Confirm the limit on the Mumbai submission page during the event.

### 3. Commit history must show steady progress
- ETHGlobal: large single commits or missing history may be disqualified. Whitechain explicitly wants steady progress, not one big upload.
- Commit every 30–60 min with real messages. Push to a **public** GitHub repo from hour 1.

### 4. AI-use attribution is mandatory
- Document where and how AI (Claude, Copilot, etc.) was used — which files/parts.
- If we use spec-driven development, include spec files, prompts and planning artifacts in the repo.
- AI must *assist*; projects built entirely by AI may lose partner-prize eligibility. Every team member must make meaningful contributions.
- Keep an `AI_USAGE.md` from hour 1.

### 5. Whitechain payments must use THEIR USDT
- Main flow must settle at least one payment in USDT `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` on Whitechain Sepolia (chain 1874). A self-minted test token **won't count**.
- Contracts must be **deployed and verified** on the Whitechain explorer.
- "Won't place": a pay button that just sends a plain transfer. We need a real checkout contract (order IDs, receipts, refunds).
- Need a drop-in piece (widget/SDK/payment-link API) that a *separate* demo app adds in ~20 lines → STREETLAYER itself can be that separate app.
- Required files: `WHITECHAIN_FEEDBACK.md`, README line on why onchain stablecoin settlement is needed, explorer link.

### 6. 0G must be in the main user flow, with request IDs
- "Apps where the AI call could be removed without anyone noticing" are not wanted. Generic chat wrappers not wanted.
- Show request IDs in the UI/logs. Write one sentence: what breaks if 0G is removed.
- Demo video **under 3 minutes** for 0G (ETHGlobal says 2–4 min → target **2:30–2:55**).

### 7. Uniswap paperwork
- Public repo, `FEEDBACK.md`, AND submit the Uniswap Developer Feedback Form with the link to FEEDBACK.md: https://developers.uniswap.org/hackathon-feedback
- README must point to exact files/lines of the integration.

---

## 🟠 P1 — Technical traps that can kill the demo

### 8. Mapbox does NOT work in Expo Go
- `@rnmapbox/maps` needs native code → requires a development build, not Expo Go.
- iOS development builds on a physical iPhone need a paid Apple Developer account ($99/yr).
- **Plan:** Expo Go app uses `react-native-maps` (bundled in Expo Go) **or** renders Mapbox GL JS inside a `react-native-webview`. PWA uses Mapbox GL JS directly.
- Rule: in the Expo app, only use libraries listed as supported in Expo Go. Check before installing anything native.

### 9. Wallet SDKs in Expo Go
- Verify Privy's Expo SDK works in Expo Go on day 1 before building on it. If it needs a dev build, fall back to: wallet only on PWA, Expo app hands off checkout to the PWA via deep link, or use a WalletConnect flow.

### 10. Uniswap and Whitechain are different chains
- Uniswap API testnets: Unichain Sepolia (1301), Base Sepolia (84532), Ethereum Sepolia (11155111). Whitechain Sepolia (1874) is **not** among them.
- So: **two checkout routes**, no bridge. Route A = swap ETH→USDC via Uniswap on a supported testnet. Route B = USDT checkout on Whitechain. Be honest in the UI about which network each uses.
- Testnet pools can have thin/odd liquidity → test a real quote early; have a fallback pool/pair.

### 11. Two apps in ~36 hours is a lot
- Building PWA + Expo app doubles UI work. Mitigation: one monorepo, shared `packages/core` (types, API client, pricing, order logic). PWA is the primary demo; Expo app covers the customer flow only (map → vendor → order → pay status).
- Android APK is explicitly **after** the hackathon.
- If behind schedule at the halfway check, freeze Expo scope.

### 12. Testnet faucets and gas
- Collect faucet funds **before** the event (faucets rate-limit, conference Wi-Fi is bad): Whitechain WBT + USDT, Unichain/Base Sepolia ETH, Arkiv test ETH if used, 0G credits.
- Keep a funded backup wallet.

### 13. Conference Wi-Fi
- Bring a phone hotspot. Pre-install all npm packages the night before the event starts (installing public libraries is not project code).

---

## 🟡 P2 — Security and secrets

14. **Never commit secrets.** `.env` in `.gitignore` from the first commit. Use `.env.example` with blank values. Scan before every push.
15. **Mapbox token**: public token only in the frontend, URL-restricted to our Vercel domain + localhost.
16. **0G / Uniswap API keys** stay server-side (backend proxy). Never ship them in the PWA or Expo bundle.
17. **Testnet-only wallets.** Never use a wallet that holds real funds. Never paste a seed phrase into any tool, chat, or AI.
18. **Relayer/gas-sponsor wallet** (if we sponsor gas on Whitechain): rate-limit per user, cap per-day spend, only relay calls to our checkout contract — explain this in README ("what stops someone draining it").
19. **Order verification** must check onchain: recipient, token, amount, order ID. Never trust a screenshot or a customer-provided tx hash alone.
20. **AI outputs** (product names/prices from photos) always need vendor confirmation before publishing.

---

## 🟢 P3 — Legal, honesty and people

21. **India crypto reality**: private crypto is not legal tender; VDA income is taxed (30%) with 1% TDS on applicable transfers. Do **not** claim tax benefits. Do not imply testnet payments are real earnings.
22. **Pitch honesty**: say "testnet demo"; say what's real vs mocked. Judges respect "current limitations" sections (Whitechain requires one).
23. **Vendor consent**: get explicit consent before listing a real vendor, photographing their stall, or recording them. No faces of customers/children in demo footage without consent.
24. **Don't promise vendors money/customers** you can't deliver. Field visits are research, not sales.
25. **Loyalty points**: non-transferable, not a token you sell. Avoid anything that looks like an investment product.
26. **Demo video rules** (ETHGlobal): ≥720p, not recorded on a phone, no sped-up footage, no AI voiceover, no music-with-text instead of talking.

---

## Before each submission — final checklist
- [ ] Repo public, license added, history shows steady commits
- [ ] README: setup, architecture diagram, limitations, AI usage, contract addresses + explorer links
- [ ] `FEEDBACK.md` (Uniswap) + form submitted
- [ ] `WHITECHAIN_FEEDBACK.md` + real USDT payment link
- [ ] 0G request IDs visible + "what breaks without 0G" sentence
- [ ] Demo video 2:30–2:55, live demo link works on a fresh phone
- [ ] Exactly 3 partner prizes selected
- [ ] No secrets in repo history

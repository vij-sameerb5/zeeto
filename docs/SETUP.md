# Setup: from zero to a real gas-free USDT payment on Whitechain

Everything below is free (testnets). Order matters.

## 1. Wallets (on your machine, never in chat)

```bash
cd apps/web
node -e "const{generatePrivateKey,privateKeyToAccount}=require('viem/accounts');for(const n of ['DEPLOYER','RELAYER']){const k=generatePrivateKey();console.log(n,k,privateKeyToAccount(k).address)}"
```
Keep the two private keys in your password manager. Fund **both addresses** with WBT at https://faucet.testnet.whitechain.io (2 WBT/day per GitHub account). The deployer needs a little once; the relayer pays customers' gas.

For test USDT: import a customer test wallet (or sign in to Zeeto and copy your wallet address from Wallet), get WBT, then swap WBT → USDT at https://testnet.yetitrade.fi. USDT: `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` (6 decimals), chain **1874** (not 2625).

## 2. Deploy and verify ZeetoCheckout

```bash
cd contracts
forge test
forge create src/ZeetoCheckout.sol:ZeetoCheckout \
  --rpc-url https://rpc.testnet.whitechain.io \
  --private-key $DEPLOYER_KEY --broadcast \
  --constructor-args 0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7 \
  --verify --verifier blockscout --verifier-url https://explorer.testnet.whitechain.io/api/
```
If verification doesn't run with create, verify after:
```bash
forge verify-contract <ADDRESS> src/ZeetoCheckout.sol:ZeetoCheckout --chain-id 1874 \
  --verifier blockscout --verifier-url https://explorer.testnet.whitechain.io/api/ \
  --constructor-args $(cast abi-encode "constructor(address)" 0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7)
```
Put the address in `CHECKOUT_ADDRESS` and in the README.

## 3. Database

Supabase → SQL Editor → paste `supabase/schema.sql` → Run. (If you ran an older version, run `supabase/reset.sql` first; it deletes data.) Copy the project URL and the **secret** key (Project Settings → API).

## 4. Privy

dashboard.privy.io → your app: login methods SMS + email; embedded wallets on; **Allowed origins**: your Vercel URL and `http://localhost:5173`. Copy the App ID and App secret.

## 5. Vercel

New project → import the repo → Root Directory `apps/web` (keep "include files outside root" on) → add env vars from `apps/web/.env.example`:
`VITE_PRIVY_APP_ID, VITE_MAPBOX_TOKEN, VITE_ADMIN_USERS, PRIVY_APP_ID, PRIVY_APP_SECRET, SUPABASE_URL, SUPABASE_SECRET_KEY, CHECKOUT_ADDRESS, RELAYER_PRIVATE_KEY, ADMIN_USERS, SITE_URL` (+ optional `GEMINI_API_KEY, UNISWAP_API_KEY, WHATSAPP_*`). Deploy. Open `/api/health`: `db, auth, checkout, relay` should be `true`.

## 6. First real payment (for the README link)

1. Phone A (stall): sign in with your email → Sell → Join → go live.
2. Phone B (customer, with test USDT): open the stall → add an item → Pay. Or scan the stall's QR → type ₹20 → Pay.
3. Admin → Orders shows the receipt link. Copy the explorer link into the README.

## 7. Phone app

`apps/mobile/.env`: `EXPO_PUBLIC_WEB_URL=https://<your-vercel-url>` → `npm install` → `npx expo start --tunnel`.

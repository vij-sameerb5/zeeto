# Example store: Anna's Chai Co.

A separate website that takes payments with **Zeeto Checkout** (USDT on Whitechain, gas-free for the shopper).
The whole integration is the block marked "about 20 lines" in `server.mjs` plus the `<script>` in `public/index.html`.

```bash
# 1. In Zeeto: open your stall dashboard → Developers → "Create API key" and set the webhook to https://<tunnel>/webhooks/zeeto
# 2. Run the store (Node 18+, no installs):
ZEETO_URL=https://your-zeeto.vercel.app ZEETO_SECRET_KEY=zk_test_... ZEETO_WEBHOOK_SECRET=whsec_... node server.mjs
# 3. Open http://localhost:4000 and pay ₹100.
```

What happens:
1. The store's backend creates a checkout session with its secret key (`POST /api/checkout`).
2. `checkout.js` opens Zeeto's hosted page. The shopper signs in with phone/email; Zeeto makes their wallet.
3. They tap Pay. No gas, no seed phrase, no chain to pick. Zeeto's relayer settles it through the ZeetoCheckout contract.
4. The store confirms with `GET /api/checkout?id=…` and gets a signed `payment.succeeded` webhook with the explorer link.
5. Refunds: the stall issues them from its Zeeto dashboard; the store gets `payment.refunded`.

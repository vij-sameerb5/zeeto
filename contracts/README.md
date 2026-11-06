# ZeetoCheckout

Gas-free USDT checkout on Whitechain Sepolia (chain 1874). One file, no dependencies: `src/ZeetoCheckout.sol`.

- `pay`: settles one order from the customer's EIP-3009 `ReceiveWithAuthorization` (signed off-chain, no gas). The stall and order are bound into the nonce (`payNonce(orderRef, merchant)`), so nobody can redirect the money. The full amount goes straight to the stall; the contract keeps nothing.
- `refund`: signed by the stall; only ever pays the original payer; capped at what was paid; each refund has a unique nonce.
- Payments are keyed by `(orderRef, payer)` so a front-runner can't block someone else's order.
- Owner can pause new payments (refunds keep working) and hand over ownership in two steps. No withdraw: it holds no funds.

```bash
forge test                                                                     # 15 unit tests
forge test --match-contract ZeetoCheckoutForkTest --fork-url https://rpc.testnet.whitechain.io   # real USDT on a fork
```

Deploy + verify: see [../docs/SETUP.md](../docs/SETUP.md#2-deploy-and-verify-zeetocheckout).

Deployed: _add address_ · Explorer: https://explorer.testnet.whitechain.io

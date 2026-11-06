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

Deployed on Whitechain Sepolia (1874): [`0xB3D0d4FB70f1C09C311194E322CDE225eCf3f22f`](https://explorer.testnet.whitechain.io/address/0xB3D0d4FB70f1C09C311194E322CDE225eCf3f22f) · [deploy tx](https://explorer.testnet.whitechain.io/tx/0xfd15e6f29bd27e15a1b7fc7849e8e6de77a54152474596278ad025bf722d6054) · constructor arg: USDT `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`

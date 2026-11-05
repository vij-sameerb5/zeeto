# StreetPayCheckout

The USDT checkout contract for Zeeto on Whitechain Sepolia (chain 1874). One file, no external libraries.

## How a payment works

1. The Zeeto API prices the order and signs an **intent**: `orderRef`, `payer`, `merchant`, `amount`, `expiresAt` (EIP-712, domain `StreetPayCheckout` v1).
2. The customer's wallet approves USDT to this contract once, then calls `pay(intent, signature)`.
3. The contract checks that the caller is the payer, the intent is unexpired and signed by the Zeeto signer, and the order hasn't been paid. Then it moves USDT **straight from the customer to the stall** and emits `Paid`.
4. The API reads the `Paid` event from the transaction receipt before it marks the order paid.

Refunds: the stall calls `refund(orderRef, amount)` (after approving USDT once). Total refunds can never exceed what was paid.

## Security choices

| Risk | What stops it |
|---|---|
| Paying the wrong stall or a smaller amount | Every field is in the signed intent; any change fails the signature |
| Someone front-running an order reference | Only the `payer` in the intent can call `pay` |
| Paying the same order twice | `AlreadyPaid` per `orderRef` (and `UNIQUE(order_ref)` in the database) |
| Stale prices | Intents expire (API uses 15 minutes) |
| Signature malleability | High-`s` signatures and bad `v` rejected |
| USDT not returning a bool | Low-level call accepts empty return data, rejects `false` |
| Funds stuck in the contract | The contract never holds funds |
| Re-entrancy through the token | State is written before the transfer, plus a lock |
| Leaked signer key | Owner can rotate the signer and pause new payments; refunds keep working while paused |

Owner powers are limited to: rotate the signer, pause new payments, and hand over ownership. The owner cannot move anyone's money.

## Test

```bash
cd contracts
forge test -vv
```

There are 17 tests, including a fuzz test on the refund cap. They use a token that behaves like Tether's USDT (no return value).

## Deploy (waiting for keys)

Do this once the deployer wallet has test WBT for gas. Never commit keys; use a `.env` file, which is git-ignored.

```bash
export WHITECHAIN_RPC=...        # verify on Whitechain docs
export DEPLOYER_KEY=0x...        # testnet only
export SIGNER_ADDRESS=0x...      # the API's intent-signing address (its key lives only on the server)
forge create src/StreetPayCheckout.sol:StreetPayCheckout \
  --rpc-url $WHITECHAIN_RPC --private-key $DEPLOYER_KEY --broadcast \
  --constructor-args 0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7 $SIGNER_ADDRESS
```

Then put the address in `packages/core/src/chain.ts` (`ADDRESSES.streetPay`) and verify the contract on the Whitechain explorer.

# Whitechain feedback

Honest notes from building Zeeto (gas-free USDT checkout) on Whitechain Sepolia at ETHGlobal Mumbai 2026.

## What worked well

- **EIP-3009 on the test USDT is the killer feature.** `receiveWithAuthorization` / `transferWithAuthorization` and `authorizationState` are there, which made a fully gas-free payer flow possible with a small contract and our own relayer. No paymaster, no smart accounts.
- **Plain EVM, no surprises.** viem, Foundry and Privy embedded wallets all worked with chain 1874 out of the box. Fork testing against the live RPC (`forge test --fork-url https://rpc.testnet.whitechain.io`) let us prove our signatures against the real USDT before spending any WBT.
- The RPC was fast and stable all weekend, and the explorer's API (`/api/v2/tokens/<addr>/holders`) was handy.
- The one-pager (chain id, USDT address, YetiTrade for test USDT) answered most first-hour questions.

## Where we got stuck

- **Wrong network in wallets.** Chainlist (and so MetaMask's "add network") shows an older Whitechain testnet, **chain 2625**, which doesn't have this USDT. We lost time before noticing the event uses **1874**. A big "1874, not 2625" note in the docs would save everyone.
- **USDT's EIP-712 domain isn't discoverable.** `version()` and `eip712Domain()` (EIP-5267) both revert. We had to hash candidate domains until one matched `DOMAIN_SEPARATOR()` (it's `name: "Tether USD", version: "1"`). Please document it, or add `eip712Domain()`.
- **Which EIP-3009 variants exist?** We had to read the implementation's bytecode (behind a proxy) to confirm both the `(v,r,s)` and the `bytes signature` overloads are present. A short "USDT on Whitechain supports: permit, transferWithAuthorization, receiveWithAuthorization, cancelAuthorization" table would help.
- **Faucet limits.** 2 WBT a day with a GitHub account older than 30 days is fine for one wallet, but a relayer plus a deployer plus test users quickly need more. A hackathon top-up form, or a higher limit for verified builders, would help.
- **Getting test USDT** means swapping WBT on YetiTrade, which costs WBT we also need for gas. A USDT faucet (even 50 a day) would make demos easier.

- **Contract verification was down.** `forge create --verify` and `forge verify-contract` against `explorer.testnet.whitechain.io/api/` both returned `{"message":"Contract verification is temporarily unavailable."}` on Nov 6 (~17:10 IST). Deploy worked; verification had to wait. A status page or a fallback (Sourcify) would help.

## What the docs were missing

1. A "gasless payments" guide: EIP-3009 with the exact typehash and domain for the test USDT, plus a minimal relayer example.
2. Blockscout verification for Foundry, spelled out: `forge verify-contract --verifier blockscout --verifier-url https://explorer.testnet.whitechain.io/api/ …`.
3. The 1874 vs 2625 network note (see above), and the right Chainlist entry.
4. Recommended gas settings / typical base fee, so relayers can set a sane price ceiling.
5. Whether a USDC (or other stablecoin) with EIP-3009 is planned for mainnet, and its address.

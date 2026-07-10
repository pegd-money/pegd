# Examples

Runnable snippets that exercise the public Pegd surface. They live outside the pnpm
workspace on purpose, so they do not participate in `pnpm -r typecheck`. Point them at a
built copy of the workspace packages (or a published build) before running.

## Prerequisites

```
pnpm install
pnpm -r --parallel build
```

Then run an example with any TypeScript runner, for example:

```
npx tsx examples/quote-issuance.ts
npx tsx examples/inspect-reserves.ts <stable-mint-pubkey>
npx tsx examples/register-stable.ts
```

## What each example shows

- `quote-issuance.ts` -- quotes a 1,000,000 USD issuance against 1,500,000 USD of
  crypto collateral with `quoteIssuance` and prints whether it clears the minimum ratio,
  the resulting ratio in basis points, and the remaining headroom.
- `inspect-reserves.ts` -- reads the on-chain reserve attestation for a stable mint with
  `PegdIssuer.fetchReserveSnapshot`, handles the missing-attestation case, and classifies
  the observed ratio into a risk zone with `classifyRatio`.
- `register-stable.ts` -- builds the `register_stable` instruction with
  `PegdIssuer.buildRegisterStableIx`, wraps it in a transaction, and simulates it. The
  send path is shown as commented lines because it requires a funded issuer keypair and a
  Token-2022 mint that already exists on the target cluster.

## Environment variables

- `PEGD_RPC` -- RPC endpoint. Falls back to a public endpoint when unset.
- `PEGD_PROGRAM_ID` -- the deployed `pegd_issuance` program id.
- `PEGD_STABLE_MINT` -- the Token-2022 mint used by `register-stable.ts`.

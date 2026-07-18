# Security Notes

Operational and design notes for people reviewing Pegd. For vulnerability reports see `SECURITY.md` at the repo root.

## Threat Model

Pegd assumes:

- A trusted admin holds the `Config.admin` authority and can pause the system. Loss of that key is treated as a full incident.
- The issuer holds the mint authority for the stable token. Loss of that key allows unauthorized minting up to the collateral ratio ceiling.
- Attestors hold Ed25519 keys used to sign PoR snapshots. Loss of an attestor key allows a compromised party to publish plausible but incorrect ratios; the on-chain circuit breaker catches gross under-collateralization.
- The Solana runtime provides ordering and durability for all account writes.

We do not assume that:

- Off-chain price feeds are always available.
- Oracles are honest at every slot -- freshness and circuit breaker thresholds compensate.
- Consumers of the badge check the on-chain state themselves; the badge is a summary they should be able to trust after the program's guards.

## Ratio Guards

Three thresholds are wired into the program and mirrored in the TypeScript risk module:

| Constant           | Value  | Meaning                                                             |
|--------------------|--------|---------------------------------------------------------------------|
| `MIN_RATIO_BPS`    | 15000  | Registration floor for a crypto-overcollateralized stable.         |
| `LIQUIDATION_BPS`  | 12000  | Below this a partial liquidation is planned.                        |
| `CIRCUIT_BREAKER_BPS` | 11000 | Below this the program refuses mints and emits a breaker event.    |
| `HARD_FLOOR_BPS`   | 10000  | Below this the token is under-peg and the risk module treats it as a total failure. |

`initialize_config` refuses to accept threshold parameters that violate the ordering `min > liquidation > circuit`.

## Circuit Breaker

The breaker lives in two places:

- On-chain, inside `mint_stable`. A mint attempt that would drop the ratio below `Config.circuit_bps` fails with `CircuitBreakerTripped`.
- Off-chain, inside `@pegd/risk-module::CircuitBreaker`. It tracks the last observed ratio and refuses to reset while the observed ratio is still below the threshold.

The two enforcement points are intentionally redundant. The off-chain breaker prevents a UI from optimistically proceeding while the on-chain breaker prevents the actual mint from settling.

## Liquidation Ordering Invariants

`planPartialLiquidation` guarantees:

- `shouldLiquidate` is `false` when the observed ratio is at or above the liquidation threshold.
- When `shouldLiquidate` is `true`, `liquidateUsd` is at most `issuedSupplyUsd`, so the queue cannot ask the vault to burn more than what is outstanding.
- `postLiquidationRatioBps` is computed from the post-burn state and returned to the caller; it is not silently clipped.

The queue orders positions from lowest ratio to highest, so the most under-collateralized positions are worked first.

## Pause Semantics

`pause_issuance` sets `Config.paused = true`. While paused:

- `register_stable` fails with `IssuancePaused`.
- `mint_stable` fails with `IssuancePaused`.
- `burn_stable`, `deposit_collateral`, and `commit_attestation` are still permitted so that positions can be de-risked while the framework is under review.

`resume_issuance` clears the flag. Both handlers require the recorded admin signer.

## Audit Status

No third-party audit has been completed. An external review is planned before the v1.0.0 mainnet cutover. The README does not carry an audit badge; when the audit closes, the auditor and the final report link will be added here and in `SECURITY.md`.

## Known Limitations

- The on-chain signature check on attestations is a non-zero sanity check, not a curve verification. Full Ed25519 verification is delegated to a preceding `ed25519_program` instruction. Consumers that submit `commit_attestation` outside of that pattern should not treat the on-chain byte string as a curve-valid signature.
- `has_compliance_hook = true` records the intent but does not wire the transfer hook program into the mint. That wiring happens at mint creation time inside `register_stable`'s Token-2022 initialization.
- The Pegd compliance hook enforces a simple allowlist. It is not a KYC provider. Issuers with more nuanced compliance needs should replace the hook program.

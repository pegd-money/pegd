# Changelog

All notable changes to this repository are recorded here. The format follows the spirit of
Keep a Changelog, and the project aims to follow semantic versioning once a tagged release
is cut.

## Unreleased

### Added

- SDK usage examples under `examples/` covering issuance quoting, reserve inspection, and
  building the `register_stable` instruction.
- Additional Anchor integration cases exercising register, deposit, and mint on the
  happy path, plus circuit-breaker and minimum-ratio rejections.

### Documentation

- `docs/error-codes.md` mapping every `PegdError` variant to its Anchor code, message, and
  trigger condition.
- `docs/attestation-layout.md` describing the 165-byte `ReserveAttestation` account layout
  and the on-chain invariants enforced by `commit_attestation`.

## 0.1.0 - 2026-07-11

Initial development milestone: the on-chain issuance program, the off-chain support
packages, and the documentation surface.

### Added

- Anchor `pegd_issuance` program with a config PDA and issuance vault state accounts.
- `register_stable` instruction that records stablecoin metadata against a Token-2022 mint.
- `deposit_collateral` and `mint_stable` instructions with a collateral ratio guard and a
  circuit-breaker check on every mint.
- `burn_stable` plus `pause_issuance` and `resume_issuance` admin controls.
- Proof-of-Reserve `commit_attestation` instruction with freshness and ratio-consistency
  checks and an Ed25519 signature sanity guard.
- `pegd_compliance_hook` program: an optional Token-2022 transfer hook backed by an
  on-chain allowlist.
- `@pegd/issuance-core` quote math and the three collateral modes.
- `@pegd/risk-module` circuit breaker, ratio thresholds, and partial-liquidation planner.
- `@pegd/yield-engine` helpers around the Token-2022 interest-bearing extension.
- `@pegd/sdk` `PegdIssuer` client wrapping quoting, PDA derivation, and reserve reads.
- `pegd` CLI with issue, mint, burn, reserves, por, and stress commands.

### Documentation

- Architecture, issuance, Proof-of-Reserve, and security documents under `docs/` with
  Mermaid diagrams.
- Continuous integration workflow, README, security policy, and contributing guide.

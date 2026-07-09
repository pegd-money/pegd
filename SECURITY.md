# Security Policy

Pegd handles stablecoin issuance, on-chain collateral custody, and Proof-of-Reserve attestations. We take security reports seriously and prefer coordinated disclosure.

## Reporting a Vulnerability

Please email **security@pegd.money** with:

- a description of the issue and its impact,
- reproduction steps (transactions, program instructions, PDA addresses, or code),
- your suggested fix if you have one,
- an optional PGP key so we can encrypt the reply.

We aim to acknowledge new reports within **72 hours** and provide an initial impact assessment within **7 days**. If the report affects a live mainnet deployment, we may request a private embargo of up to **90 days** while we ship a fix.

Do not open a public GitHub issue for a security vulnerability. Do not disclose the issue on social media until we agree on a coordinated disclosure timeline.

## Scope

In scope:

- Anchor programs under `programs/pegd_issuance` and `programs/pegd_compliance_hook`.
- TypeScript SDK, CLI, issuance-core, risk-module, and yield-engine packages.
- Reserve attestation cryptography and freshness invariants.
- Circuit breaker, liquidation, and pause flows.

Out of scope:

- Third-party wallets, RPC providers, and infrastructure not maintained by Pegd.
- Social engineering of maintainers.
- Denial-of-service against public RPC endpoints.
- Missing rate limits on public informational endpoints.

## Supported Versions

Pegd is pre-v1. Only the tip of `main` receives security fixes today. Once a stable v1 line ships, this table will be updated.

| Version | Supported |
|---------|-----------|
| `main`  | yes       |
| pre-0.x tags | no  |

## Audit Status

No third-party audit has been completed at the time of writing. An external review is planned before the v1.0.0 mainnet cutover. This document will be updated with the auditor and report once the audit closes; no audit claim will appear in the README until then.

## Cryptographic Notes

- Reserve attestations are Ed25519 signatures over a canonical byte encoding of `(stable_mint, timestamp, total_supply, reserve_value_usd, ratio_bps)`.
- The on-chain program rejects attestations older than `3600` seconds and attestations whose `ratio_bps` field is inconsistent with the reported supply and reserve value.
- The circuit breaker refuses to reset while the observed ratio is still below the threshold; the reset must be gated on a fresh healthy attestation.

## Responsible Disclosure Rewards

At this stage Pegd does not run a bounty program. When one is set up the terms and payout table will be published here.

# Proof-of-Reserve Specification

Pegd Proof-of-Reserve is an on-chain surface for verifiable reserve reports. It does not itself perform custody or reconciliation; it records signed snapshots that a downstream consumer can trust as long as they trust the attestor keypair.

## Attestation Payload

The attestor signs a canonical byte encoding of:

```
(stable_mint, timestamp, total_supply, reserve_value_usd, ratio_bps)
```

- `stable_mint` -- 32 bytes, the Token-2022 mint pubkey.
- `timestamp` -- 8 bytes little-endian `i64`, Unix seconds.
- `total_supply` -- 8 bytes little-endian `u64`, raw token units.
- `reserve_value_usd` -- 8 bytes little-endian `u64`, USD value with 6-decimal precision.
- `ratio_bps` -- 4 bytes little-endian `u32`, must equal `floor(reserve_value_usd * 10_000 / total_supply)`.

The signature is Ed25519 over the concatenation of the fields above and is stored verbatim on `ReserveAttestation`.

## Freshness Invariant

The `commit_attestation` handler enforces:

```
timestamp <= now
now - timestamp <= 3600
```

An attestation older than one hour is rejected with `StaleAttestation`. A future-dated attestation is rejected with `FutureAttestation`. This protects consumers from stale snapshots without requiring them to fetch a wall clock.

## Ratio Consistency

The program recomputes `ratio_bps` from `reserve_value_usd` and `total_supply` and rejects any snapshot whose reported ratio disagrees. This closes an attack surface where a malicious attestor could publish a signed but internally inconsistent snapshot.

If `total_supply` is zero, `ratio_bps` must also be zero. This special case is only expected at the moment of a fresh mint.

## Signature Sanity

The program rejects a signature that is all zeros. This is a minimum sanity check; a full curve verification is out of scope for the on-chain program because Solana's `ed25519_program` requires an accompanying compute-budget instruction. The recommended pattern is:

1. Precede the `commit_attestation` transaction with an `ed25519_program` verify instruction over the same payload.
2. On success, submit `commit_attestation`. The account it writes then represents a snapshot that has been curve-verified by the ledger.

The SDK's `PegdIssuer.buildRegisterStableIx` and its attestation helpers wire this pattern together.

## Off-chain Sourcing

Attestors typically:

1. Fetch collateral prices from Pyth Hermes (`hermes.pyth.network`).
2. Snapshot the on-chain `VaultState.collateral_amount` and `StablecoinMeta.issued_supply`.
3. Compute `reserve_value_usd = collateral_amount * price` in the collateral's oracle scale.
4. Sign and submit the payload.

The `@pegd/por-attestor` package (private -- runs in the Pegd control-plane, not published to this mirror) implements the pipeline end to end. Consumers who only need to read the resulting attestations can call `PegdIssuer.fetchReserveSnapshot`.

## Consumer Flow

A downstream consumer that wants to render a "Reserves verified by Pegd" badge:

1. Loads the stablecoin's mint pubkey.
2. Calls `PegdIssuer.attestationPda(mint)` to derive the PDA.
3. Reads the PDA and validates:
   - `now - timestamp <= 3600`
   - `ratio_bps >= configured_minimum_bps`
4. Renders the badge with the observed ratio and the attestor pubkey.

The badge does not need to re-verify the signature -- if the attestation is on-chain it has already passed the program's checks.

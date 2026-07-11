# Error Code Reference

Every custom error returned by the `pegd_issuance` program comes from the `PegdError`
enum in `programs/pegd_issuance/src/error.rs`. Anchor assigns custom error codes starting
at `6000` in declaration order, so the code equals `6000 + variant index`. A rejected
instruction surfaces the code both as a number and as the variant name; the `#[msg(...)]`
string is the human-readable message returned in the transaction logs.

The exact numbering below matches the order of declaration in `error.rs`. If a new variant
is inserted rather than appended, the codes of every following variant shift, so downstream
consumers should match on the variant name rather than hard-coding the number.

| Code | Name | Message | Raised when |
| --- | --- | --- | --- |
| 6000 | `RatioBelowMinimum` | Collateral ratio below minimum required for this mode | `register_stable` receives `min_ratio_bps` below the config floor, or `mint_stable` produces a ratio above the breaker but below the stable's `min_ratio_bps`. |
| 6001 | `CircuitBreakerTripped` | Collateral ratio below circuit breaker threshold | `mint_stable` computes a post-mint ratio below `config.circuit_bps`; a `CircuitBreakerTriggered` event is emitted before the instruction fails. |
| 6002 | `IssuancePaused` | Issuance is paused by the admin | `register_stable` or `mint_stable` runs while `config.paused` is true. |
| 6003 | `UnknownCollateralMode` | Unknown collateral mode | `register_stable` receives a `collateral_mode` byte greater than 2. |
| 6004 | `EmptyPegCurrency` | Peg currency identifier is empty | `register_stable` receives an all-zero `peg_currency` array. |
| 6005 | `YieldRateOutOfRange` | Yield rate exceeds allowed maximum | `register_stable` receives `yield_rate_bps` above 5000. |
| 6006 | `UnauthorizedAdmin` | Only the admin authority can perform this action | `pause_issuance` or `resume_issuance` is signed by an account that is not the config admin (`has_one` check). |
| 6007 | `UnauthorizedIssuer` | Only the recorded issuer can perform this action | `deposit_collateral`, `mint_stable`, or `burn_stable` is signed by an account that is not the recorded issuer (`has_one` check). |
| 6008 | `AttestorSignatureInvalid` | Attestor signature verification failed | Defined in the enum. The former all-zero signature guard was replaced by full ed25519 introspection over the instructions sysvar, so `commit_attestation` no longer raises this directly; it is kept for signature-path callers that reject a malformed signature before quorum evaluation. |
| 6009 | `StaleAttestation` | Attestation timestamp is stale | `commit_attestation` receives a timestamp older than 3600 seconds relative to the on-chain clock. |
| 6010 | `FutureAttestation` | Attestation timestamp is in the future | `commit_attestation` receives a timestamp greater than the on-chain clock. |
| 6011 | `ReservesUnderCollateral` | Reserve value under-collateralizes reported supply | `commit_attestation` receives a `ratio_bps` that does not equal `floor(reserve_value_usd * 10000 / total_supply)`. |
| 6012 | `NumericOverflow` | Numeric overflow while updating vault state | A checked add or subtract overflows in `deposit_collateral`, `mint_stable`, or `burn_stable`, or a mint would leave supply at zero. |
| 6013 | `BurnExceedsSupply` | Burn amount exceeds outstanding supply | `burn_stable` is asked to burn more than the recorded `issued_supply`. |
| 6014 | `InsufficientCollateral` | Vault has insufficient collateral to cover this operation | `mint_stable` runs while the stable's `VaultState.collateral_amount` is zero, so no collateral backs the requested issuance. |
| 6015 | `InvalidThresholdOrder` | Requested threshold parameters violate ordering invariants | `initialize_config` receives thresholds that do not satisfy `min_ratio_bps > liquidation_bps > circuit_bps`. |
| 6016 | `QuorumNotMet` | Attestor quorum not met for this attestation | `commit_attestation` finds fewer distinct registered attestors with a valid ed25519 signature over the attestation digest than the configured `AttestorSet.threshold`. |
| 6017 | `AttestationMissing` | No fresh reserve attestation for this stablecoin | `mint_stable` is called with an `ReserveAttestation` account whose `stable_mint` does not match the mint being issued, so no matching attestation backs the mint. |
| 6018 | `InvalidAttestorConfig` | Attestor set configuration invalid | `configure_attestors` receives an empty or oversized attestor list, a `threshold` outside `1..=attestors.len()`, a default (all-zero) pubkey, or duplicate attestors. |
| 6019 | `MintAuthorityMismatch` | Stablecoin mint authority is not the program PDA | Defined in the enum as a defensive guard for mint-authority checks. No instruction raises it in the current program; the `stable_meta` PDA is set as mint authority at `register_stable` time. |

## Reading a rejection

Anchor wraps a returned `PegdError` as an `AnchorError`. From the TypeScript client the
variant name is available at `err.error.errorCode.code` and the number at
`err.error.errorCode.number`, which is what the integration tests match against. From the
CLI or explorer the same information appears in the transaction's program logs as
`Error Code: <Name>. Error Number: <code>. Error Message: <message>.`

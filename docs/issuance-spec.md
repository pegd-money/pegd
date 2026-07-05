# Issuance Specification

This document specifies how a stablecoin is registered, collateralized, minted, and burned inside Pegd.

## Collateral Modes

Pegd currently supports three modes. Each mode carries a minimum collateral ratio expressed in basis points. The on-chain program refuses to register a mint whose declared minimum is below the mode's floor.

| Mode                          | Enum value                     | Minimum ratio (bps) | Notes                                                                 |
|-------------------------------|--------------------------------|---------------------|-----------------------------------------------------------------------|
| Crypto Overcollateralized     | `OVERCOLLATERALIZED_CRYPTO`    | 15000               | Default for demo stables. Collateral is volatile so headroom is large.|
| Attested Fiat Reserves        | `ATTESTED_FIAT`                | 10100               | Requires an off-chain attestor with signing authority.               |
| Real World Assets Backed      | `RWA_BACKED`                   | 10500               | Reserve value tracks a tokenized real-world basket.                   |

The Pegd public mirror only ships crypto-overcollateralized demo stables. Attested-fiat and RWA modes require additional off-chain infrastructure the issuer is responsible for operating.

## Lifecycle

1. `initialize_config` -- called once. Records the admin, treasury, and global thresholds. Fails if the thresholds violate ordering (`min_ratio_bps > liquidation_bps > circuit_bps`).
2. `register_stable` -- called by the issuer. Creates a `StablecoinMeta` PDA that pins the mint, mode, minimum ratio, yield rate, and compliance flag. Emits `RegisteredStable`.
3. `deposit_collateral` -- adds collateral to the `VaultState` PDA. The first deposit records the collateral mint and oracle pubkey verbatim. Later deposits only update the amount and timestamp.
4. `commit_attestation` -- attestor commits a signed snapshot to the `ReserveAttestation` PDA and mirrors `reserve_value_usd` onto `StablecoinMeta`.
5. `mint_stable` -- issuer mints new supply. The program recomputes the ratio from the supplied `reserve_value_usd` and rejects the mint if the ratio would fall below the per-mint minimum or the global circuit threshold.
6. `burn_stable` -- issuer burns outstanding supply. Cannot burn more than `issued_supply`.
7. `pause_issuance` / `resume_issuance` -- admin flips the global pause flag. All mint and register calls fail while paused.

## Account Schemas

### Config

```
admin:            Pubkey
treasury:         Pubkey
paused:           bool
min_ratio_bps:    u32
liquidation_bps:  u32
circuit_bps:      u32
bump:             u8
```

Seed: `b"pegd_config"`.

### StablecoinMeta

```
issuer:              Pubkey
mint:                Pubkey
peg_currency:        [u8; 8]
collateral_mode:     u8
min_ratio_bps:       u32
has_compliance_hook: bool
has_yield:           bool
yield_rate_bps:      u32
issued_supply:       u64
reserves_value_usd:  u64
bump:                u8
```

Seed: `b"stable_meta"` concatenated with the mint pubkey.

### VaultState

```
stable_mint:       Pubkey
collateral_mint:   Pubkey
collateral_amount: u64
oracle:            Pubkey
last_updated:      i64
bump:              u8
```

Seed: `b"vault_state"` concatenated with the mint pubkey.

## Numeric Guarantees

- All checked arithmetic on `issued_supply` and `collateral_amount` uses `checked_add` / `checked_sub`; overflow returns `PegdError::NumericOverflow`.
- Ratios are computed in `u128` and cast down to `u32` bps to avoid precision loss on the 64-bit supply.
- Yield rate cannot exceed 5000 bps (50%) at registration time. Larger rates require an admin config change that lives outside this program.

## Failure Modes

The full error surface is enumerated in `PegdError`. Notable variants:

- `RatioBelowMinimum` -- either the per-mint minimum or the reported ratio would fall below it.
- `CircuitBreakerTripped` -- the reported ratio would fall below the global circuit threshold.
- `ReservesUnderCollateral` -- attestation's `ratio_bps` disagrees with the recomputed value.
- `StaleAttestation` -- attestation is older than `3600` seconds.
- `FutureAttestation` -- attestation's `timestamp` is greater than `now`.
- `UnauthorizedIssuer` / `UnauthorizedAdmin` -- signer does not match the recorded authority.

## Deployment Status

The Anchor program targets Solana mainnet-beta. Program deployment is pending v1.0.0. Until the program ID is registered on mainnet the CLI, SDK, and PoR attestor exercise the interface against localnet or devnet.

use anchor_lang::prelude::*;

#[error_code]
pub enum PegdError {
    #[msg("Collateral ratio below minimum required for this mode")]
    RatioBelowMinimum,
    #[msg("Collateral ratio below circuit breaker threshold")]
    CircuitBreakerTripped,
    #[msg("Issuance is paused by the admin")]
    IssuancePaused,
    #[msg("Unknown collateral mode")]
    UnknownCollateralMode,
    #[msg("Peg currency identifier is empty")]
    EmptyPegCurrency,
    #[msg("Yield rate exceeds allowed maximum")]
    YieldRateOutOfRange,
    #[msg("Only the admin authority can perform this action")]
    UnauthorizedAdmin,
    #[msg("Only the recorded issuer can perform this action")]
    UnauthorizedIssuer,
    #[msg("Attestor signature verification failed")]
    AttestorSignatureInvalid,
    #[msg("Attestation timestamp is stale")]
    StaleAttestation,
    #[msg("Attestation timestamp is in the future")]
    FutureAttestation,
    #[msg("Reserve value under-collateralizes reported supply")]
    ReservesUnderCollateral,
    #[msg("Numeric overflow while updating vault state")]
    NumericOverflow,
    #[msg("Burn amount exceeds outstanding supply")]
    BurnExceedsSupply,
    #[msg("Vault has insufficient collateral to cover this operation")]
    InsufficientCollateral,
    #[msg("Requested threshold parameters violate ordering invariants")]
    InvalidThresholdOrder,
    #[msg("Attestor quorum not met for this attestation")]
    QuorumNotMet,
    #[msg("No fresh reserve attestation for this stablecoin")]
    AttestationMissing,
    #[msg("Attestor set configuration invalid")]
    InvalidAttestorConfig,
    #[msg("Stablecoin mint authority is not the program PDA")]
    MintAuthorityMismatch,
}

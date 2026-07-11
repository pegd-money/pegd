use anchor_lang::prelude::*;

#[event]
pub struct RegisteredStable {
    pub issuer: Pubkey,
    pub stable_mint: Pubkey,
    pub peg_currency: [u8; 8],
    pub collateral_mode: u8,
    pub yield_rate_bps: u32,
    pub has_compliance_hook: bool,
}

#[event]
pub struct DepositedCollateral {
    pub issuer: Pubkey,
    pub stable_mint: Pubkey,
    pub amount: u64,
    pub new_collateral_amount: u64,
}

#[event]
pub struct MintedStable {
    pub issuer: Pubkey,
    pub stable_mint: Pubkey,
    pub amount: u64,
    pub new_issued_supply: u64,
    pub ratio_bps: u32,
}

#[event]
pub struct BurnedStable {
    pub issuer: Pubkey,
    pub stable_mint: Pubkey,
    pub amount: u64,
    pub new_issued_supply: u64,
}

#[event]
pub struct AttestationCommitted {
    pub attestor: Pubkey,
    pub stable_mint: Pubkey,
    pub timestamp: i64,
    pub ratio_bps: u32,
    pub reserve_value_usd: u64,
}

#[event]
pub struct CircuitBreakerTriggered {
    pub stable_mint: Pubkey,
    pub ratio_bps: u32,
    pub threshold_bps: u32,
}

#[event]
pub struct IssuancePauseChanged {
    pub admin: Pubkey,
    pub paused: bool,
}

#[event]
pub struct AttestorSetConfigured {
    pub admin: Pubkey,
    pub threshold: u8,
    pub count: u8,
}

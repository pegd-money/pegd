use anchor_lang::prelude::*;

#[account]
pub struct StablecoinMeta {
    pub issuer: Pubkey,
    pub mint: Pubkey,
    pub peg_currency: [u8; 8],
    pub collateral_mode: u8,
    pub min_ratio_bps: u32,
    pub has_compliance_hook: bool,
    pub has_yield: bool,
    pub yield_rate_bps: u32,
    pub issued_supply: u64,
    pub reserves_value_usd: u64,
    pub bump: u8,
    pub breaker_tripped: bool,
    pub decimals: u8,
}

impl StablecoinMeta {
    // discriminator 8 + issuer 32 + mint 32 + peg_currency 8 + collateral_mode 1
    // + min_ratio_bps 4 + has_compliance_hook 1 + has_yield 1 + yield_rate_bps 4
    // + issued_supply 8 + reserves_value_usd 8 + bump 1 + breaker_tripped 1 + decimals 1 = 110
    pub const LEN: usize = 8 + 32 + 32 + 8 + 1 + 4 + 1 + 1 + 4 + 8 + 8 + 1 + 1 + 1;
    pub const SEED: &'static [u8] = b"stable_meta";
}

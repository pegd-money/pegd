use anchor_lang::prelude::*;

#[account]
pub struct Config {
    pub admin: Pubkey,
    pub treasury: Pubkey,
    pub paused: bool,
    pub min_ratio_bps: u32,
    pub liquidation_bps: u32,
    pub circuit_bps: u32,
    pub bump: u8,
}

impl Config {
    pub const LEN: usize = 8 + 32 + 32 + 1 + 4 + 4 + 4 + 1;
    pub const SEED: &'static [u8] = b"pegd_config";
}

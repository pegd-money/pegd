use anchor_lang::prelude::*;

#[account]
pub struct ReserveAttestation {
    pub stable_mint: Pubkey,
    pub timestamp: i64,
    pub total_supply: u64,
    pub reserve_value_usd: u64,
    pub ratio_bps: u32,
    pub attestor: Pubkey,
    pub signature: [u8; 64],
    pub bump: u8,
}

impl ReserveAttestation {
    pub const LEN: usize = 8 + 32 + 8 + 8 + 8 + 4 + 32 + 64 + 1;
    pub const SEED: &'static [u8] = b"reserve_attestation";
}

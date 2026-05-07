use anchor_lang::prelude::*;

#[account]
pub struct VaultState {
    pub stable_mint: Pubkey,
    pub collateral_mint: Pubkey,
    pub collateral_amount: u64,
    pub oracle: Pubkey,
    pub last_updated: i64,
    pub bump: u8,
}

impl VaultState {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 32 + 8 + 1;
    pub const SEED: &'static [u8] = b"vault_state";
}

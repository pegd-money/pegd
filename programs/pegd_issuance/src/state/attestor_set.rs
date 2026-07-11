use anchor_lang::prelude::*;

#[account]
pub struct AttestorSet {
    pub admin: Pubkey,
    pub threshold: u8,
    pub count: u8,
    pub attestors: [Pubkey; 5],
    pub bump: u8,
}

impl AttestorSet {
    pub const MAX: usize = 5;
    // discriminator 8 + admin 32 + threshold 1 + count 1 + attestors 32*5 + bump 1
    pub const LEN: usize = 8 + 32 + 1 + 1 + 32 * 5 + 1;
    pub const SEED: &'static [u8] = b"attestor_set";

    pub fn contains(&self, k: &Pubkey) -> bool {
        self.attestors[..self.count as usize].iter().any(|a| a == k)
    }
}

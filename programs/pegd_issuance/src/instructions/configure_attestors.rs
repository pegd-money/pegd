use anchor_lang::prelude::*;

use crate::error::PegdError;
use crate::events::AttestorSetConfigured;
use crate::state::{AttestorSet, Config};

#[derive(Accounts)]
pub struct ConfigureAttestors<'info> {
    #[account(
        seeds = [Config::SEED],
        bump = config.bump,
        has_one = admin @ PegdError::UnauthorizedAdmin,
    )]
    pub config: Account<'info, Config>,

    #[account(
        init_if_needed,
        payer = admin,
        space = AttestorSet::LEN,
        seeds = [AttestorSet::SEED],
        bump,
    )]
    pub attestor_set: Account<'info, AttestorSet>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<ConfigureAttestors>,
    threshold: u8,
    attestors: Vec<Pubkey>,
) -> Result<()> {
    require!(
        !attestors.is_empty() && attestors.len() <= AttestorSet::MAX,
        PegdError::InvalidAttestorConfig
    );
    require!(
        threshold >= 1 && (threshold as usize) <= attestors.len(),
        PegdError::InvalidAttestorConfig
    );
    for (i, a) in attestors.iter().enumerate() {
        require!(*a != Pubkey::default(), PegdError::InvalidAttestorConfig);
        for b in attestors.iter().skip(i + 1) {
            require!(a != b, PegdError::InvalidAttestorConfig);
        }
    }

    let set = &mut ctx.accounts.attestor_set;
    set.admin = ctx.accounts.config.admin;
    set.threshold = threshold;
    set.count = attestors.len() as u8;
    set.attestors = [Pubkey::default(); AttestorSet::MAX];
    for (i, a) in attestors.iter().enumerate() {
        set.attestors[i] = *a;
    }
    set.bump = ctx.bumps.attestor_set;

    emit!(AttestorSetConfigured {
        admin: set.admin,
        threshold: set.threshold,
        count: set.count,
    });
    Ok(())
}

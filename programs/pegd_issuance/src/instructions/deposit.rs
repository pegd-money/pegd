use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::error::PegdError;
use crate::events::DepositedCollateral;
use crate::state::{StablecoinMeta, VaultState};

#[derive(Accounts)]
pub struct DepositCollateral<'info> {
    #[account(
        mut,
        seeds = [StablecoinMeta::SEED, stable_mint.key().as_ref()],
        bump = stable_meta.bump,
        has_one = issuer @ PegdError::UnauthorizedIssuer,
    )]
    pub stable_meta: Account<'info, StablecoinMeta>,

    #[account(
        init_if_needed,
        payer = issuer,
        space = VaultState::LEN,
        seeds = [VaultState::SEED, stable_mint.key().as_ref()],
        bump,
    )]
    pub vault_state: Account<'info, VaultState>,

    pub stable_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub issuer: Signer<'info>,

    /// CHECK: collateral mint identity is recorded verbatim.
    pub collateral_mint: UncheckedAccount<'info>,

    /// CHECK: oracle pubkey recorded verbatim; verified at attestation time.
    pub oracle: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<DepositCollateral>, amount: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault_state;
    if vault.stable_mint == Pubkey::default() {
        vault.stable_mint = ctx.accounts.stable_mint.key();
        vault.collateral_mint = ctx.accounts.collateral_mint.key();
        vault.oracle = ctx.accounts.oracle.key();
        vault.bump = ctx.bumps.vault_state;
    }
    vault.collateral_amount = vault
        .collateral_amount
        .checked_add(amount)
        .ok_or(PegdError::NumericOverflow)?;
    vault.last_updated = Clock::get()?.unix_timestamp;

    emit!(DepositedCollateral {
        issuer: ctx.accounts.issuer.key(),
        stable_mint: ctx.accounts.stable_mint.key(),
        amount,
        new_collateral_amount: vault.collateral_amount,
    });
    Ok(())
}

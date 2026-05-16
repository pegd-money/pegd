use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::error::PegdError;
use crate::events::{CircuitBreakerTriggered, MintedStable};
use crate::state::{Config, StablecoinMeta, VaultState};

#[derive(Accounts)]
pub struct MintStable<'info> {
    #[account(
        seeds = [Config::SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [StablecoinMeta::SEED, stable_mint.key().as_ref()],
        bump = stable_meta.bump,
        has_one = issuer @ PegdError::UnauthorizedIssuer,
    )]
    pub stable_meta: Account<'info, StablecoinMeta>,

    #[account(
        seeds = [VaultState::SEED, stable_mint.key().as_ref()],
        bump = vault_state.bump,
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(mut)]
    pub stable_mint: InterfaceAccount<'info, Mint>,

    pub issuer: Signer<'info>,
}

pub fn handler(ctx: Context<MintStable>, amount: u64, reserve_value_usd: u64) -> Result<()> {
    require!(!ctx.accounts.config.paused, PegdError::IssuancePaused);

    let meta = &mut ctx.accounts.stable_meta;
    let new_supply = meta
        .issued_supply
        .checked_add(amount)
        .ok_or(PegdError::NumericOverflow)?;
    require!(new_supply > 0, PegdError::NumericOverflow);

    let ratio_bps = ((reserve_value_usd as u128) * 10_000u128 / (new_supply as u128)) as u32;

    if ratio_bps < ctx.accounts.config.circuit_bps {
        emit!(CircuitBreakerTriggered {
            stable_mint: meta.mint,
            ratio_bps,
            threshold_bps: ctx.accounts.config.circuit_bps,
        });
        return Err(PegdError::CircuitBreakerTripped.into());
    }
    require!(ratio_bps >= meta.min_ratio_bps, PegdError::RatioBelowMinimum);

    meta.issued_supply = new_supply;
    meta.reserves_value_usd = reserve_value_usd;

    emit!(MintedStable {
        issuer: ctx.accounts.issuer.key(),
        stable_mint: meta.mint,
        amount,
        new_issued_supply: new_supply,
        ratio_bps,
    });
    Ok(())
}

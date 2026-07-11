use anchor_lang::prelude::*;
use anchor_spl::token_2022::{mint_to, MintTo, Token2022};
use anchor_spl::token_interface::{Mint, TokenAccount};

use crate::error::PegdError;
use crate::events::{CircuitBreakerTriggered, MintedStable};
use crate::state::{Config, ReserveAttestation, StablecoinMeta, VaultState};

const MAX_ATTESTATION_AGE_SEC: i64 = 3_600;

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

    #[account(
        seeds = [ReserveAttestation::SEED, stable_mint.key().as_ref()],
        bump = attestation.bump,
    )]
    pub attestation: Account<'info, ReserveAttestation>,

    #[account(mut)]
    pub stable_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        token::mint = stable_mint,
        token::authority = issuer,
        token::token_program = token_program,
    )]
    pub destination: InterfaceAccount<'info, TokenAccount>,

    pub issuer: Signer<'info>,

    pub token_program: Program<'info, Token2022>,
}

pub fn handler(ctx: Context<MintStable>, amount: u64) -> Result<()> {
    require!(!ctx.accounts.config.paused, PegdError::IssuancePaused);
    require!(
        !ctx.accounts.stable_meta.breaker_tripped,
        PegdError::CircuitBreakerTripped
    );

    let now = Clock::get()?.unix_timestamp;
    require!(
        ctx.accounts.attestation.stable_mint == ctx.accounts.stable_mint.key(),
        PegdError::AttestationMissing
    );
    require!(
        now - ctx.accounts.attestation.timestamp <= MAX_ATTESTATION_AGE_SEC,
        PegdError::StaleAttestation
    );
    require!(
        ctx.accounts.vault_state.collateral_amount > 0,
        PegdError::InsufficientCollateral
    );

    let reserve_value_usd = ctx.accounts.attestation.reserve_value_usd;
    let new_supply = ctx
        .accounts
        .stable_meta
        .issued_supply
        .checked_add(amount)
        .ok_or(PegdError::NumericOverflow)?;
    require!(new_supply > 0, PegdError::NumericOverflow);

    let ratio_bps = ((reserve_value_usd as u128) * 10_000u128 / (new_supply as u128))
        .min(u32::MAX as u128) as u32;

    let circuit_bps = ctx.accounts.config.circuit_bps;
    let min_ratio_bps = ctx.accounts.stable_meta.min_ratio_bps;

    if ratio_bps < circuit_bps {
        ctx.accounts.stable_meta.breaker_tripped = true;
        emit!(CircuitBreakerTriggered {
            stable_mint: ctx.accounts.stable_mint.key(),
            ratio_bps,
            threshold_bps: circuit_bps,
        });
        return Err(PegdError::CircuitBreakerTripped.into());
    }
    require!(ratio_bps >= min_ratio_bps, PegdError::RatioBelowMinimum);

    let mint_key = ctx.accounts.stable_mint.key();
    let bump = ctx.accounts.stable_meta.bump;
    let signer_seeds: &[&[&[u8]]] =
        &[&[StablecoinMeta::SEED, mint_key.as_ref(), &[bump]]];
    mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.stable_mint.to_account_info(),
                to: ctx.accounts.destination.to_account_info(),
                authority: ctx.accounts.stable_meta.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )?;

    ctx.accounts.stable_meta.issued_supply = new_supply;
    ctx.accounts.stable_meta.reserves_value_usd = reserve_value_usd;

    emit!(MintedStable {
        issuer: ctx.accounts.issuer.key(),
        stable_mint: mint_key,
        amount,
        new_issued_supply: new_supply,
        ratio_bps,
    });
    Ok(())
}

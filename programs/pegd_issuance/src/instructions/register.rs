use anchor_lang::prelude::*;
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::Mint;

use crate::error::PegdError;
use crate::events::RegisteredStable;
use crate::state::{Config, StablecoinMeta};

#[derive(Accounts)]
pub struct RegisterStable<'info> {
    #[account(
        seeds = [Config::SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = issuer,
        space = StablecoinMeta::LEN,
        seeds = [StablecoinMeta::SEED, stable_mint.key().as_ref()],
        bump,
    )]
    pub stable_meta: Account<'info, StablecoinMeta>,

    #[account(mut)]
    pub stable_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub issuer: Signer<'info>,

    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<RegisterStable>,
    peg_currency: [u8; 8],
    collateral_mode: u8,
    min_ratio_bps: u32,
    yield_rate_bps: u32,
    has_compliance_hook: bool,
) -> Result<()> {
    require!(!ctx.accounts.config.paused, PegdError::IssuancePaused);
    require!(collateral_mode <= 2, PegdError::UnknownCollateralMode);
    require!(peg_currency.iter().any(|b| *b != 0), PegdError::EmptyPegCurrency);
    require!(yield_rate_bps <= 5_000, PegdError::YieldRateOutOfRange);
    require!(
        min_ratio_bps >= ctx.accounts.config.min_ratio_bps,
        PegdError::RatioBelowMinimum
    );

    let meta = &mut ctx.accounts.stable_meta;
    meta.issuer = ctx.accounts.issuer.key();
    meta.mint = ctx.accounts.stable_mint.key();
    meta.peg_currency = peg_currency;
    meta.collateral_mode = collateral_mode;
    meta.min_ratio_bps = min_ratio_bps;
    meta.has_compliance_hook = has_compliance_hook;
    meta.has_yield = yield_rate_bps > 0;
    meta.yield_rate_bps = yield_rate_bps;
    meta.issued_supply = 0;
    meta.reserves_value_usd = 0;
    meta.bump = ctx.bumps.stable_meta;

    emit!(RegisteredStable {
        issuer: meta.issuer,
        stable_mint: meta.mint,
        peg_currency,
        collateral_mode,
        yield_rate_bps,
        has_compliance_hook,
    });
    Ok(())
}

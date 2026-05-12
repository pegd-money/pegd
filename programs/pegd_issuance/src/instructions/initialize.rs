use anchor_lang::prelude::*;

use crate::error::PegdError;
use crate::state::Config;

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = admin,
        space = Config::LEN,
        seeds = [Config::SEED],
        bump,
    )]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: treasury is stored verbatim; any account can be nominated.
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeConfig>,
    min_ratio_bps: u32,
    liquidation_bps: u32,
    circuit_bps: u32,
) -> Result<()> {
    require!(
        min_ratio_bps > liquidation_bps && liquidation_bps > circuit_bps,
        PegdError::InvalidThresholdOrder
    );
    let cfg = &mut ctx.accounts.config;
    cfg.admin = ctx.accounts.admin.key();
    cfg.treasury = ctx.accounts.treasury.key();
    cfg.paused = false;
    cfg.min_ratio_bps = min_ratio_bps;
    cfg.liquidation_bps = liquidation_bps;
    cfg.circuit_bps = circuit_bps;
    cfg.bump = ctx.bumps.config;
    Ok(())
}

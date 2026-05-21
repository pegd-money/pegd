use anchor_lang::prelude::*;

use crate::error::PegdError;
use crate::events::IssuancePauseChanged;
use crate::state::Config;

#[derive(Accounts)]
pub struct PauseResume<'info> {
    #[account(
        mut,
        seeds = [Config::SEED],
        bump = config.bump,
        has_one = admin @ PegdError::UnauthorizedAdmin,
    )]
    pub config: Account<'info, Config>,

    pub admin: Signer<'info>,
}

pub fn handler_pause(ctx: Context<PauseResume>) -> Result<()> {
    ctx.accounts.config.paused = true;
    emit!(IssuancePauseChanged {
        admin: ctx.accounts.admin.key(),
        paused: true,
    });
    Ok(())
}

pub fn handler_resume(ctx: Context<PauseResume>) -> Result<()> {
    ctx.accounts.config.paused = false;
    emit!(IssuancePauseChanged {
        admin: ctx.accounts.admin.key(),
        paused: false,
    });
    Ok(())
}

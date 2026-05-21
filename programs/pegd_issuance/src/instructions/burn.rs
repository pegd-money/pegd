use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::error::PegdError;
use crate::events::BurnedStable;
use crate::state::StablecoinMeta;

#[derive(Accounts)]
pub struct BurnStable<'info> {
    #[account(
        mut,
        seeds = [StablecoinMeta::SEED, stable_mint.key().as_ref()],
        bump = stable_meta.bump,
        has_one = issuer @ PegdError::UnauthorizedIssuer,
    )]
    pub stable_meta: Account<'info, StablecoinMeta>,

    #[account(mut)]
    pub stable_mint: InterfaceAccount<'info, Mint>,

    pub issuer: Signer<'info>,
}

pub fn handler(ctx: Context<BurnStable>, amount: u64) -> Result<()> {
    let meta = &mut ctx.accounts.stable_meta;
    require!(amount <= meta.issued_supply, PegdError::BurnExceedsSupply);
    meta.issued_supply = meta
        .issued_supply
        .checked_sub(amount)
        .ok_or(PegdError::NumericOverflow)?;

    emit!(BurnedStable {
        issuer: ctx.accounts.issuer.key(),
        stable_mint: meta.mint,
        amount,
        new_issued_supply: meta.issued_supply,
    });
    Ok(())
}

use anchor_lang::prelude::*;
use anchor_spl::token_2022::{burn, Burn, Token2022};
use anchor_spl::token_interface::{Mint, TokenAccount};

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

    #[account(
        mut,
        token::mint = stable_mint,
        token::authority = issuer,
        token::token_program = token_program,
    )]
    pub source: InterfaceAccount<'info, TokenAccount>,

    pub issuer: Signer<'info>,

    pub token_program: Program<'info, Token2022>,
}

pub fn handler(ctx: Context<BurnStable>, amount: u64) -> Result<()> {
    require!(
        amount <= ctx.accounts.stable_meta.issued_supply,
        PegdError::BurnExceedsSupply
    );

    burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.stable_mint.to_account_info(),
                from: ctx.accounts.source.to_account_info(),
                authority: ctx.accounts.issuer.to_account_info(),
            },
        ),
        amount,
    )?;

    let meta = &mut ctx.accounts.stable_meta;
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

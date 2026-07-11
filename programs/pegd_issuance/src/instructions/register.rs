use anchor_lang::prelude::*;
use anchor_lang::system_program::{create_account, CreateAccount};
use anchor_spl::token_2022::spl_token_2022::extension::ExtensionType;
use anchor_spl::token_2022::spl_token_2022::state::Mint as SplMint;
use anchor_spl::token_2022::{initialize_mint2, InitializeMint2, Token2022};
use anchor_spl::token_2022_extensions::{
    interest_bearing_mint_initialize, InterestBearingMintInitialize,
};

use crate::error::PegdError;
use crate::events::RegisteredStable;
use crate::state::{Config, StablecoinMeta};

const STABLE_DECIMALS: u8 = 6;

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

    /// New Token-2022 mint account. Created and initialized in this handler,
    /// so it must sign and be owned by the system program on entry.
    #[account(mut)]
    pub stable_mint: Signer<'info>,

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

    let meta_key = ctx.accounts.stable_meta.key();

    // Allocate the mint with room for the interest-bearing extension.
    let space =
        ExtensionType::try_calculate_account_len::<SplMint>(&[ExtensionType::InterestBearingConfig])?;
    let lamports = Rent::get()?.minimum_balance(space);
    create_account(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            CreateAccount {
                from: ctx.accounts.issuer.to_account_info(),
                to: ctx.accounts.stable_mint.to_account_info(),
            },
        ),
        lamports,
        space as u64,
        &ctx.accounts.token_program.key(),
    )?;

    // Interest-bearing extension must be initialized before the base mint.
    // The stable_meta PDA is both the mint authority and the rate authority.
    let rate = yield_rate_bps.min(i16::MAX as u32) as i16;
    interest_bearing_mint_initialize(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            InterestBearingMintInitialize {
                token_program_id: ctx.accounts.token_program.to_account_info(),
                mint: ctx.accounts.stable_mint.to_account_info(),
            },
        ),
        Some(meta_key),
        rate,
    )?;

    initialize_mint2(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            InitializeMint2 {
                mint: ctx.accounts.stable_mint.to_account_info(),
            },
        ),
        STABLE_DECIMALS,
        &meta_key,
        None,
    )?;

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
    meta.breaker_tripped = false;
    meta.decimals = STABLE_DECIMALS;

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

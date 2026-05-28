use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::error::PegdError;
use crate::events::AttestationCommitted;
use crate::state::{ReserveAttestation, StablecoinMeta};

const MAX_ATTESTATION_AGE_SEC: i64 = 3_600;

#[derive(Accounts)]
pub struct CommitAttestation<'info> {
    #[account(
        mut,
        seeds = [StablecoinMeta::SEED, stable_mint.key().as_ref()],
        bump = stable_meta.bump,
    )]
    pub stable_meta: Account<'info, StablecoinMeta>,

    #[account(
        init_if_needed,
        payer = attestor,
        space = ReserveAttestation::LEN,
        seeds = [ReserveAttestation::SEED, stable_mint.key().as_ref()],
        bump,
    )]
    pub attestation: Account<'info, ReserveAttestation>,

    pub stable_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub attestor: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CommitAttestation>,
    timestamp: i64,
    total_supply: u64,
    reserve_value_usd: u64,
    ratio_bps: u32,
    signature: [u8; 64],
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(timestamp <= now, PegdError::FutureAttestation);
    require!(now - timestamp <= MAX_ATTESTATION_AGE_SEC, PegdError::StaleAttestation);
    let computed = if total_supply == 0 {
        0
    } else {
        ((reserve_value_usd as u128) * 10_000u128 / (total_supply as u128)) as u32
    };
    require!(computed == ratio_bps, PegdError::ReservesUnderCollateral);
    require!(signature.iter().any(|b| *b != 0), PegdError::AttestorSignatureInvalid);

    let att = &mut ctx.accounts.attestation;
    if att.stable_mint == Pubkey::default() {
        att.stable_mint = ctx.accounts.stable_mint.key();
        att.bump = ctx.bumps.attestation;
    }
    att.timestamp = timestamp;
    att.total_supply = total_supply;
    att.reserve_value_usd = reserve_value_usd;
    att.ratio_bps = ratio_bps;
    att.attestor = ctx.accounts.attestor.key();
    att.signature = signature;

    let meta = &mut ctx.accounts.stable_meta;
    meta.reserves_value_usd = reserve_value_usd;

    emit!(AttestationCommitted {
        attestor: ctx.accounts.attestor.key(),
        stable_mint: meta.mint,
        timestamp,
        ratio_bps,
        reserve_value_usd,
    });
    Ok(())
}

use anchor_lang::prelude::*;
use anchor_lang::solana_program::ed25519_program;
use anchor_lang::solana_program::hash::hash;
use anchor_lang::solana_program::sysvar::instructions::{
    load_current_index_checked, load_instruction_at_checked,
};

use crate::error::PegdError;
use crate::events::{AttestationCommitted, CircuitBreakerTriggered};
use crate::state::{AttestorSet, Config, ReserveAttestation, StablecoinMeta};

const MAX_ATTESTATION_AGE_SEC: i64 = 3_600;
const POR_DOMAIN: &[u8] = b"PEGD-POR-V1";
const ED25519_OFFSETS_LEN: usize = 14;
const SELF_REFERENCE_INDEX: u16 = u16::MAX;

#[derive(Accounts)]
pub struct CommitAttestation<'info> {
    #[account(
        seeds = [Config::SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        seeds = [AttestorSet::SEED],
        bump = attestor_set.bump,
    )]
    pub attestor_set: Account<'info, AttestorSet>,

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

    pub stable_mint: InterfaceAccount<'info, anchor_spl::token_interface::Mint>,

    #[account(mut)]
    pub attestor: Signer<'info>,

    /// CHECK: validated by address to be the Instructions sysvar; read via
    /// load_instruction_at_checked for ed25519 signature introspection.
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

/// Collect distinct registered attestors whose ed25519-verified signature in
/// `data` covers exactly our attestation `digest`. Only signatures whose
/// signature/pubkey/message all live inside the same ed25519 instruction data
/// (self-reference offsets == u16::MAX) are considered; cross-instruction
/// references are skipped conservatively.
fn parse_ed25519_and_collect(
    data: &[u8],
    digest: &[u8; 32],
    set: &AttestorSet,
    seen: &mut Vec<Pubkey>,
) {
    if data.len() < 2 {
        return;
    }
    let count = data[0] as usize;
    let mut off = 2usize;
    for _ in 0..count {
        if off + ED25519_OFFSETS_LEN > data.len() {
            break;
        }
        let rd = |p: usize| u16::from_le_bytes([data[p], data[p + 1]]) as usize;
        let sig_ix = rd(off + 2) as u16;
        let pk_off = rd(off + 4);
        let pk_ix = rd(off + 6) as u16;
        let msg_off = rd(off + 8);
        let msg_sz = rd(off + 10);
        let msg_ix = rd(off + 12) as u16;
        off += ED25519_OFFSETS_LEN;

        if sig_ix != SELF_REFERENCE_INDEX
            || pk_ix != SELF_REFERENCE_INDEX
            || msg_ix != SELF_REFERENCE_INDEX
        {
            continue;
        }
        if pk_off + 32 > data.len() {
            continue;
        }
        if msg_off + msg_sz > data.len() {
            continue;
        }
        let pk = Pubkey::new_from_array(
            <[u8; 32]>::try_from(&data[pk_off..pk_off + 32]).unwrap(),
        );
        let msg = &data[msg_off..msg_off + msg_sz];
        if msg != digest.as_ref() {
            continue;
        }
        if !set.contains(&pk) {
            continue;
        }
        if !seen.contains(&pk) {
            seen.push(pk);
        }
    }
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
    require!(
        now - timestamp <= MAX_ATTESTATION_AGE_SEC,
        PegdError::StaleAttestation
    );

    let computed = if total_supply == 0 {
        0u32
    } else {
        ((reserve_value_usd as u128) * 10_000u128 / (total_supply as u128))
            .min(u32::MAX as u128) as u32
    };
    require!(computed == ratio_bps, PegdError::ReservesUnderCollateral);

    // Reconstruct the domain-separated 71-byte payload and its SHA-256 digest.
    let mint_key = ctx.accounts.stable_mint.key();
    let mut body = Vec::with_capacity(71);
    body.extend_from_slice(POR_DOMAIN);
    body.extend_from_slice(mint_key.as_ref());
    body.extend_from_slice(&timestamp.to_le_bytes());
    body.extend_from_slice(&total_supply.to_le_bytes());
    body.extend_from_slice(&reserve_value_usd.to_le_bytes());
    body.extend_from_slice(&ratio_bps.to_le_bytes());
    let digest = hash(&body).to_bytes();

    // Introspect preceding ed25519 verify instructions in this transaction.
    let ixs = ctx.accounts.instructions.to_account_info();
    let current = load_current_index_checked(&ixs)? as usize;
    let mut seen: Vec<Pubkey> = Vec::new();
    for i in 0..current {
        let ix = load_instruction_at_checked(i, &ixs)?;
        if ix.program_id != ed25519_program::ID {
            continue;
        }
        parse_ed25519_and_collect(&ix.data, &digest, &ctx.accounts.attestor_set, &mut seen);
    }
    require!(
        seen.len() >= ctx.accounts.attestor_set.threshold as usize,
        PegdError::QuorumNotMet
    );

    let attestor_key = ctx.accounts.attestor.key();
    let attestation_bump = ctx.bumps.attestation;
    let att = &mut ctx.accounts.attestation;
    if att.stable_mint == Pubkey::default() {
        att.stable_mint = mint_key;
        att.bump = attestation_bump;
    }
    att.timestamp = timestamp;
    att.total_supply = total_supply;
    att.reserve_value_usd = reserve_value_usd;
    att.ratio_bps = ratio_bps;
    att.attestor = attestor_key;
    att.signature = signature;

    let circuit_bps = ctx.accounts.config.circuit_bps;
    let meta = &mut ctx.accounts.stable_meta;
    meta.reserves_value_usd = reserve_value_usd;

    if ratio_bps < circuit_bps {
        meta.breaker_tripped = true;
        emit!(CircuitBreakerTriggered {
            stable_mint: meta.mint,
            ratio_bps,
            threshold_bps: circuit_bps,
        });
    } else if ratio_bps >= meta.min_ratio_bps {
        meta.breaker_tripped = false;
    }

    emit!(AttestationCommitted {
        attestor: attestor_key,
        stable_mint: meta.mint,
        timestamp,
        ratio_bps,
        reserve_value_usd,
    });
    Ok(())
}

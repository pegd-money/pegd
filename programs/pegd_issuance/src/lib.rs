use anchor_lang::prelude::*;

declare_id!("11111111111111111111111111111111");

pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

use crate::instructions::*;

#[program]
pub mod pegd_issuance {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        min_ratio_bps: u32,
        liquidation_bps: u32,
        circuit_bps: u32,
    ) -> Result<()> {
        instructions::initialize::handler(ctx, min_ratio_bps, liquidation_bps, circuit_bps)
    }

    pub fn register_stable(
        ctx: Context<RegisterStable>,
        peg_currency: [u8; 8],
        collateral_mode: u8,
        min_ratio_bps: u32,
        yield_rate_bps: u32,
        has_compliance_hook: bool,
    ) -> Result<()> {
        instructions::register::handler(
            ctx,
            peg_currency,
            collateral_mode,
            min_ratio_bps,
            yield_rate_bps,
            has_compliance_hook,
        )
    }

    pub fn deposit_collateral(ctx: Context<DepositCollateral>, amount: u64) -> Result<()> {
        instructions::deposit::handler(ctx, amount)
    }

    pub fn mint_stable(ctx: Context<MintStable>, amount: u64, reserve_value_usd: u64) -> Result<()> {
        instructions::mint::handler(ctx, amount, reserve_value_usd)
    }

    pub fn burn_stable(ctx: Context<BurnStable>, amount: u64) -> Result<()> {
        instructions::burn::handler(ctx, amount)
    }

    pub fn commit_attestation(
        ctx: Context<CommitAttestation>,
        timestamp: i64,
        total_supply: u64,
        reserve_value_usd: u64,
        ratio_bps: u32,
        signature: [u8; 64],
    ) -> Result<()> {
        instructions::attest::handler(
            ctx,
            timestamp,
            total_supply,
            reserve_value_usd,
            ratio_bps,
            signature,
        )
    }

    pub fn pause_issuance(ctx: Context<PauseResume>) -> Result<()> {
        instructions::pause::handler_pause(ctx)
    }

    pub fn resume_issuance(ctx: Context<PauseResume>) -> Result<()> {
        instructions::pause::handler_resume(ctx)
    }
}

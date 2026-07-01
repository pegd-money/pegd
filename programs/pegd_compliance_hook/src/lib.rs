use anchor_lang::prelude::*;

declare_id!("11111111111111111111111111111111");

#[program]
pub mod pegd_compliance_hook {
    use super::*;

    pub fn initialize(ctx: Context<InitializeAllowlist>, allowlist_bump: u8) -> Result<()> {
        let allowlist = &mut ctx.accounts.allowlist;
        allowlist.authority = ctx.accounts.authority.key();
        allowlist.stable_mint = ctx.accounts.stable_mint.key();
        allowlist.max_entries = MAX_ENTRIES as u32;
        allowlist.entries_len = 0;
        allowlist.bump = allowlist_bump;
        Ok(())
    }

    pub fn set_entry(ctx: Context<UpdateAllowlist>, participant: Pubkey, allowed: bool) -> Result<()> {
        let allowlist = &mut ctx.accounts.allowlist;
        if let Some(idx) = allowlist.entries.iter().position(|e| e.participant == participant) {
            allowlist.entries[idx].allowed = allowed;
        } else {
            require!(
                (allowlist.entries_len as usize) < MAX_ENTRIES,
                ComplianceError::AllowlistFull
            );
            allowlist.entries[allowlist.entries_len as usize] = AllowlistEntry {
                participant,
                allowed,
            };
            allowlist.entries_len += 1;
        }
        Ok(())
    }

    pub fn execute(ctx: Context<Execute>, amount: u64) -> Result<()> {
        let allowlist = &ctx.accounts.allowlist;
        require!(!allowlist.paused_transfers(), ComplianceError::TransfersPaused);
        require!(amount > 0, ComplianceError::ZeroTransfer);

        let source_ok = allowlist.is_allowed(&ctx.accounts.source_owner.key());
        let dest_ok = allowlist.is_allowed(&ctx.accounts.destination_owner.key());
        require!(source_ok && dest_ok, ComplianceError::ParticipantBlocked);
        Ok(())
    }
}

pub const MAX_ENTRIES: usize = 64;

#[account]
pub struct Allowlist {
    pub authority: Pubkey,
    pub stable_mint: Pubkey,
    pub max_entries: u32,
    pub entries_len: u32,
    pub bump: u8,
    pub padding: [u8; 7],
    pub entries: [AllowlistEntry; MAX_ENTRIES],
}

#[derive(AnchorSerialize, AnchorDeserialize, Copy, Clone, Default)]
pub struct AllowlistEntry {
    pub participant: Pubkey,
    pub allowed: bool,
}

impl Allowlist {
    pub const LEN: usize = 8 + 32 + 32 + 4 + 4 + 1 + 7 + (33 * MAX_ENTRIES);

    pub fn is_allowed(&self, participant: &Pubkey) -> bool {
        self.entries
            .iter()
            .take(self.entries_len as usize)
            .any(|e| e.participant == *participant && e.allowed)
    }

    pub fn paused_transfers(&self) -> bool {
        self.max_entries == 0
    }
}

#[derive(Accounts)]
pub struct InitializeAllowlist<'info> {
    #[account(
        init,
        payer = authority,
        space = Allowlist::LEN,
        seeds = [b"pegd_allowlist", stable_mint.key().as_ref()],
        bump,
    )]
    pub allowlist: Account<'info, Allowlist>,

    /// CHECK: mint identity recorded verbatim.
    pub stable_mint: UncheckedAccount<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateAllowlist<'info> {
    #[account(
        mut,
        seeds = [b"pegd_allowlist", allowlist.stable_mint.as_ref()],
        bump = allowlist.bump,
        has_one = authority @ ComplianceError::UnauthorizedAuthority,
    )]
    pub allowlist: Account<'info, Allowlist>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct Execute<'info> {
    /// CHECK: source token account -- inspected by owner metadata.
    pub source_account: UncheckedAccount<'info>,
    /// CHECK: source owner is what we allowlist-check.
    pub source_owner: UncheckedAccount<'info>,
    /// CHECK: destination token account.
    pub destination_account: UncheckedAccount<'info>,
    /// CHECK: destination owner is what we allowlist-check.
    pub destination_owner: UncheckedAccount<'info>,
    /// CHECK: the token-2022 mint being transferred.
    pub stable_mint: UncheckedAccount<'info>,

    #[account(
        seeds = [b"pegd_allowlist", stable_mint.key().as_ref()],
        bump = allowlist.bump,
    )]
    pub allowlist: Account<'info, Allowlist>,
}

#[error_code]
pub enum ComplianceError {
    #[msg("Allowlist is full")]
    AllowlistFull,
    #[msg("Only the recorded authority can update allowlist")]
    UnauthorizedAuthority,
    #[msg("Transfers are currently paused by authority")]
    TransfersPaused,
    #[msg("Participant not on allowlist")]
    ParticipantBlocked,
    #[msg("Zero-amount transfer rejected")]
    ZeroTransfer,
}

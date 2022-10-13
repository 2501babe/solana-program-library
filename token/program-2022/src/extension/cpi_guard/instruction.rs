use {
    crate::{
        check_program_account,
        instruction::{encode_instruction, TokenInstruction},
    },
    num_enum::{IntoPrimitive, TryFromPrimitive},
    solana_program::{
        instruction::{AccountMeta, Instruction},
        program_error::ProgramError,
        pubkey::Pubkey,
    },
};

/// Cpi Guard extension instructions
#[derive(Clone, Copy, Debug, PartialEq, IntoPrimitive, TryFromPrimitive)]
#[repr(u8)]
pub enum CpiGuardInstruction {
    /// Lock certain token operations from taking place within cpi for this Account, namely:
    /// * Transfer and Burn must go through a delegate.
    /// * CloseAccount can only return lamports to owner.
    /// * SetAuthority can only be used to remove an existing close authority.
    /// * Approve is disallowed entirely.
    ///
    /// In addition, CpiGuard cannot be enabled or disabled via cpi.
    ///
    /// Accounts expected by this instruction:
    ///
    ///   0. `[writable]` The account to update.
    ///   1. `[signer]` The account's owner.
    ///
    ///   * Multisignature authority
    ///   0. `[writable]` The account to update.
    ///   1. `[]` The account's multisignature owner.
    ///   2. ..2+M `[signer]` M signer accounts.
    ///
    Enable,
    /// Allow all token operations to happen via cpi as normal.
    ///
    /// Fails if the account does not have the extension present.
    ///
    /// Accounts expected by this instruction:
    ///
    ///   0. `[writable]` The account to update.
    ///   1. `[signer]` The account's owner.
    ///
    ///   * Multisignature authority
    ///   0. `[writable]` The account to update.
    ///   1. `[]`  The account's multisignature owner.
    ///   2. ..2+M `[signer]` M signer accounts.
    ///
    Disable,
}

/// Create an `Enable` instruction
pub fn enable_cpi_guard(
    token_program_id: &Pubkey,
    account: &Pubkey,
    owner: &Pubkey,
    signers: &[&Pubkey],
) -> Result<Instruction, ProgramError> {
    check_program_account(token_program_id)?;
    let mut accounts = vec![
        AccountMeta::new(*account, false),
        AccountMeta::new_readonly(*owner, signers.is_empty()),
    ];
    for signer_pubkey in signers.iter() {
        accounts.push(AccountMeta::new_readonly(**signer_pubkey, true));
    }
    Ok(encode_instruction(
        token_program_id,
        accounts,
        TokenInstruction::CpiGuardExtension,
        CpiGuardInstruction::Enable,
        &(),
    ))
}

/// Create a `Disable` instruction
pub fn disable_cpi_guard(
    token_program_id: &Pubkey,
    account: &Pubkey,
    owner: &Pubkey,
    signers: &[&Pubkey],
) -> Result<Instruction, ProgramError> {
    check_program_account(token_program_id)?;
    let mut accounts = vec![
        AccountMeta::new(*account, false),
        AccountMeta::new_readonly(*owner, signers.is_empty()),
    ];
    for signer_pubkey in signers.iter() {
        accounts.push(AccountMeta::new_readonly(**signer_pubkey, true));
    }
    Ok(encode_instruction(
        token_program_id,
        accounts,
        TokenInstruction::CpiGuardExtension,
        CpiGuardInstruction::Disable,
        &(),
    ))
}

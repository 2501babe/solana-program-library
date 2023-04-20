#![allow(clippy::integer_arithmetic)]
#![cfg(feature = "test-sbf")]

mod helpers;

use {
    helpers::*,
    solana_program::{program_pack::Pack, stake},
    solana_program_test::*,
    solana_sdk::{message::Message, signature::Signer, transaction::Transaction},
    spl_single_validator_pool::{id, instruction},
    spl_token::state::Mint,
};

#[tokio::test]
async fn success() {
    let mut context = program_test().start_with_context().await;
    let accounts = SinglePoolAccounts::default();
    accounts.initialize(&mut context).await.unwrap();

    // mint exists
    let mint_account = get_account(&mut context.banks_client, &accounts.mint).await;
    Mint::unpack_from_slice(&mint_account.data).unwrap();

    // stake account exists
    let stake_account = get_account(&mut context.banks_client, &accounts.stake_account).await;
    assert_eq!(stake_account.owner, stake::program::id());
}

#[tokio::test]
async fn fail_double_init() {
    let mut context = program_test().start_with_context().await;
    let accounts = SinglePoolAccounts::default();
    accounts.initialize(&mut context).await.unwrap();
    refresh_blockhash(&mut context).await;

    let rent = context.banks_client.get_rent().await.unwrap();
    let instructions = instruction::initialize(
        &id(),
        &accounts.vote_account.pubkey(),
        &context.payer.pubkey(),
        &rent,
        stake_get_minimum_delegation(
            &mut context.banks_client,
            &context.payer,
            &context.last_blockhash,
        )
        .await,
    );
    let message = Message::new(&instructions, Some(&context.payer.pubkey()));
    let transaction = Transaction::new(&[&context.payer], message, context.last_blockhash);

    context
        .banks_client
        .process_transaction(transaction)
        .await
        .unwrap_err();
}

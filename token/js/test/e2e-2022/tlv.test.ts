import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised);

import type { Connection, PublicKey, Signer } from '@solana/web3.js';
import { sendAndConfirmTransaction, Keypair, SystemProgram, Transaction } from '@solana/web3.js';

import type { Account, Mint } from '../../src';
import {
    createInitializeAccountInstruction,
    getAccount,
    getAccountLen,
    createMint,
    ExtensionType,
    getExtensionData,
} from '../../src';
import { TEST_PROGRAM_ID, newAccountWithLamports, getConnection } from '../common';

const TEST_TOKEN_DECIMALS = 9;
const ACCOUNT_EXTENSIONS = [
    ExtensionType.TransferFeeAmount,
    ExtensionType.ConfidentialTransferAccount,
    ExtensionType.ImmutableOwner,
    ExtensionType.MemoTransfer,
    ExtensionType.CpiGuard,
];

describe('tlv test', () => {
    let connection: Connection;
    let payer: Signer;
    let owner: Keypair;

    let initTestMint: Function;
    let initTestAccount: Function;

    before(async () => {
        connection = await getConnection();
        payer = await newAccountWithLamports(connection, 1000000000);
        owner = Keypair.generate();

        initTestAccount = async (extraBytes: number = 0) => {
            const mintKeypair = Keypair.generate();
            const accountKeypair = Keypair.generate();
            const account = accountKeypair.publicKey;
            const accountLen = getAccountLen([]) + extraBytes;
            const lamports = await connection.getMinimumBalanceForRentExemption(accountLen);

            const mint = await createMint(
                connection,
                payer,
                mintKeypair.publicKey,
                mintKeypair.publicKey,
                TEST_TOKEN_DECIMALS,
                mintKeypair,
                undefined,
                TEST_PROGRAM_ID
            );

            const transaction = new Transaction().add(
                SystemProgram.createAccount({
                    fromPubkey: payer.publicKey,
                    newAccountPubkey: account,
                    space: accountLen,
                    lamports,
                    programId: TEST_PROGRAM_ID,
                }),
                createInitializeAccountInstruction(account, mint, owner.publicKey, TEST_PROGRAM_ID),
            );

            await sendAndConfirmTransaction(connection, transaction, [payer, accountKeypair], undefined);

            return account;
        }
    });

    // test that the parser gracefully handles accounts with arbitrary extra bytes
    it('parse account with extra bytes', async () => {
        let promises = [];

        for(let i = 0; i < 16; i++) {
            // trying to alloc exactly one extra byte causes an unpack failure in the program when initializing
            if (i == 1) continue;

            promises.push(
                initTestAccount(i)
                .then((account: PublicKey) => getAccount(connection, account, undefined, TEST_PROGRAM_ID))
                .then((accountInfo: Account) => [i, accountInfo])
            );
        }

        for (let promise of promises) {
            let [extraBytes, accountInfo] = await promise;

            for (let extension of ACCOUNT_EXTENSIONS) {
                // realistically this will never fail with a non-null value, it will just throw
                expect(
                    getExtensionData(extension, accountInfo.tlvData),
                    `account parse test failed: found ${ExtensionType[extension]}, but should not have. \
                    test case: no extensions, ${extraBytes} extra bytes` 
                ).to.be.null;
            }
        }
    });
});

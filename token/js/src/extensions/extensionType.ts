import { ACCOUNT_SIZE } from '../state/account.js';
import type { Mint } from '../state/mint.js';
import { MINT_SIZE } from '../state/mint.js';
import { MULTISIG_SIZE } from '../state/multisig.js';
import { ACCOUNT_TYPE_SIZE } from './accountType.js';
import { CPI_GUARD_SIZE } from './cpiGuard/index.js';
import { DEFAULT_ACCOUNT_STATE_SIZE } from './defaultAccountState/index.js';
import { IMMUTABLE_OWNER_SIZE } from './immutableOwner.js';
import { INTEREST_BEARING_MINT_CONFIG_STATE_SIZE } from './interestBearingMint/state.js';
import { MEMO_TRANSFER_SIZE } from './memoTransfer/index.js';
import { MINT_CLOSE_AUTHORITY_SIZE } from './mintCloseAuthority.js';
import { NON_TRANSFERABLE_SIZE } from './nonTransferable.js';
import { PERMANENT_DELEGATE_SIZE } from './permanentDelegate.js';
import { TRANSFER_FEE_AMOUNT_SIZE, TRANSFER_FEE_CONFIG_SIZE } from './transferFee/index.js';

export enum ExtensionType {
    Uninitialized,
    TransferFeeConfig,
    TransferFeeAmount,
    MintCloseAuthority,
    ConfidentialTransferMint,
    ConfidentialTransferAccount,
    DefaultAccountState,
    ImmutableOwner,
    MemoTransfer,
    NonTransferable,
    InterestBearingConfig,
    CpiGuard,
    PermanentDelegate,
}

export const TYPE_SIZE = 2;
export const LENGTH_SIZE = 2;

// NOTE: All of these should eventually use their type's Span instead of these
// constants.  This is provided for at least creation to work.
export function getTypeLen(e: ExtensionType): number {
    switch (e) {
        case ExtensionType.Uninitialized:
            return 0;
        case ExtensionType.TransferFeeConfig:
            return TRANSFER_FEE_CONFIG_SIZE;
        case ExtensionType.TransferFeeAmount:
            return TRANSFER_FEE_AMOUNT_SIZE;
        case ExtensionType.MintCloseAuthority:
            return MINT_CLOSE_AUTHORITY_SIZE;
        case ExtensionType.ConfidentialTransferMint:
            return 97;
        case ExtensionType.ConfidentialTransferAccount:
            return 286;
        case ExtensionType.CpiGuard:
            return CPI_GUARD_SIZE;
        case ExtensionType.DefaultAccountState:
            return DEFAULT_ACCOUNT_STATE_SIZE;
        case ExtensionType.ImmutableOwner:
            return IMMUTABLE_OWNER_SIZE;
        case ExtensionType.MemoTransfer:
            return MEMO_TRANSFER_SIZE;
        case ExtensionType.NonTransferable:
            return NON_TRANSFERABLE_SIZE;
        case ExtensionType.InterestBearingConfig:
            return INTEREST_BEARING_MINT_CONFIG_STATE_SIZE;
        case ExtensionType.PermanentDelegate:
            return PERMANENT_DELEGATE_SIZE;
        default:
            throw Error(`Unknown extension type: ${e}`);
    }
}

export function getAccountTypeOfMintType(e: ExtensionType): ExtensionType {
    switch (e) {
        case ExtensionType.TransferFeeConfig:
            return ExtensionType.TransferFeeAmount;
        case ExtensionType.ConfidentialTransferMint:
            return ExtensionType.ConfidentialTransferAccount;
        case ExtensionType.TransferFeeAmount:
        case ExtensionType.ConfidentialTransferAccount:
        case ExtensionType.CpiGuard:
        case ExtensionType.DefaultAccountState:
        case ExtensionType.ImmutableOwner:
        case ExtensionType.MemoTransfer:
        case ExtensionType.MintCloseAuthority:
        case ExtensionType.NonTransferable:
        case ExtensionType.Uninitialized:
        case ExtensionType.InterestBearingConfig:
        case ExtensionType.PermanentDelegate:
            return ExtensionType.Uninitialized;
    }
}

function getLen(extensionTypes: ExtensionType[], baseSize: number): number {
    if (extensionTypes.length === 0) {
        return baseSize;
    } else {
        const accountLength =
            ACCOUNT_SIZE +
            ACCOUNT_TYPE_SIZE +
            extensionTypes
                .filter((element, i) => i === extensionTypes.indexOf(element))
                .map((element) => getTypeLen(element) + TYPE_SIZE + LENGTH_SIZE)
                .reduce((a, b) => a + b);
        if (accountLength === MULTISIG_SIZE) {
            return accountLength + TYPE_SIZE;
        } else {
            return accountLength;
        }
    }
}

export function getMintLen(extensionTypes: ExtensionType[]): number {
    return getLen(extensionTypes, MINT_SIZE);
}

export function getAccountLen(extensionTypes: ExtensionType[]): number {
    return getLen(extensionTypes, ACCOUNT_SIZE);
}

export function getExtensionData(extension: ExtensionType, tlvData: Buffer): Buffer | null {
    let extensionTypeIndex = 0;
    //console.log("HANA BEGIN (entry type: u16le type tag in buffer, entry len: length of data, type idx: offset of data after type tag and length)");
    //console.log(`     cpi guard: ${ExtensionType.CpiGuard}/${CPI_GUARD_SIZE}, memo transfer: ${ExtensionType.MemoTransfer}/${MEMO_TRANSFER_SIZE}`);
    //console.log("     buffer:", tlvData);
    //console.log("");

    while (extensionTypeIndex + TYPE_SIZE + LENGTH_SIZE <= tlvData.length) {
        //console.log(`HANA idx: ${extensionTypeIndex}, tlv len: ${tlvData.length}`);
        const entryType = tlvData.readUInt16LE(extensionTypeIndex);

        //console.log(`     entry type: ${entryType} ==? ${extension}`);
        const entryLength = tlvData.readUInt16LE(extensionTypeIndex + TYPE_SIZE);

        //console.log(`     entry len: ${entryLength}`);
        const typeIndex = extensionTypeIndex + TYPE_SIZE + LENGTH_SIZE;

        //console.log(`     type idx: ${typeIndex}`);
        if (entryType == extension) {
            return tlvData.slice(typeIndex, typeIndex + entryLength);
        }
        extensionTypeIndex = typeIndex + entryLength;

        //console.log(`  -> newly computed: ${extensionTypeIndex}\n`);
    }
    return null;
}

export function getExtensionTypes(tlvData: Buffer): ExtensionType[] {
    const extensionTypes = [];
    let extensionTypeIndex = 0;
    while (extensionTypeIndex < tlvData.length) {
        const entryType = tlvData.readUInt16LE(extensionTypeIndex);
        extensionTypes.push(entryType);
        const entryLength = tlvData.readUInt16LE(extensionTypeIndex + TYPE_SIZE);
        extensionTypeIndex += TYPE_SIZE + LENGTH_SIZE + entryLength;
    }
    return extensionTypes;
}

export function getAccountLenForMint(mint: Mint): number {
    const extensionTypes = getExtensionTypes(mint.tlvData);
    const accountExtensions = extensionTypes.map(getAccountTypeOfMintType);
    return getAccountLen(accountExtensions);
}

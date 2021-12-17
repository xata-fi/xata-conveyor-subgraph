import {MetaTransaction, User, XATADayMEVData, XATAMEVData} from "../generated/schema";
import {Address, BigDecimal, BigInt, Bytes, ethereum, log} from "@graphprotocol/graph-ts/index";
import {getTokenUSDValue} from "./pricing";
import {Transfer} from "../generated/templates/ERC20/ERC20";
import {addGasPaidForUserAndGlobalData, updateUser, updateUserDayData, updateXataDayMEVData} from "./updateDayData";
import {Value} from "@graphprotocol/graph-ts";

export const FACTORY_ADDRESS = '0x5f8017621825BC10D63d15C3e863f893946781F7';
export const META_TXN_TYPES = '((address,address,uint256,uint256,uint256,bytes,bytes32),string,uint256,uint256,(uint8,bytes32,bytes32))';

// Instantiate MetaTransaction entity
export function getMetaTransaction(txnId: string): MetaTransaction {
    let metaTxn = MetaTransaction.load(txnId)
    if (!metaTxn) {
        metaTxn = new MetaTransaction(txnId)
        metaTxn.gasPaidUSD = BigDecimal.zero();
        metaTxn.unusedSlippageUSD = BigDecimal.zero();
        metaTxn.sender = '';
        metaTxn.success = false;
        metaTxn.swapInputToken = Bytes.empty();
        metaTxn.swapInputAmount = BigInt.zero();
        metaTxn.swapOutputToken = Bytes.empty();
        metaTxn.swapOutputAmount = BigInt.zero();
        metaTxn.unusedSlippageUSD = BigDecimal.zero();
    }
    return metaTxn;
}


// Compares if 2 Address or String types refer to the same address.
export function addressEquals(add1: string, add2: string): boolean {
    return add1.toLowerCase() == add2.toLowerCase();
}

// ethabi cargo crate does not expect function headers, but instead expects a tuple offset.
export function getTxnInputDataToDecode(event: ethereum.Event): Bytes {
    const inputDataHexString = event.transaction.input.toHexString().slice(10); //take away function signature: '0x????????'
    const hexStringToDecode = '0x0000000000000000000000000000000000000000000000000000000000000020' + inputDataHexString; // prepend tuple offset
    return Bytes.fromByteArray(Bytes.fromHexString(hexStringToDecode));
}

// Doesn't need a tuple prepend as the struct already comes with one.
export function stripFunctionSignature(bytes: Bytes): Bytes {
    const strippedUintArray = bytes.slice(4); //take away function signature: '????????'
    return Bytes.fromUint8Array(strippedUintArray);
}

function toAddress(addressBytes: Bytes): Address {
    return Value.fromBytes(addressBytes).toAddress();
}

// Given swapamount 0 and 1, and we don't know which method was called, we have to derive the slippage by guessing the 'exact' token that was used.
export function getUnusedSlippageInUSD(swapAmount0: BigInt, swapAmount1: BigInt, metaTxn: MetaTransaction): BigDecimal {
    if (metaTxn.swapInputAmount == BigInt.zero() && metaTxn.swapOutputAmount == BigInt.zero()) {
        return BigDecimal.zero(); // no swap data available
    }
    const actualSwapInput = metaTxn.swapInputAmount;
    const actualSwapOutput = metaTxn.swapOutputAmount;

    const swapAmount0HasExactMatch = swapAmount0 == actualSwapInput || swapAmount0 == actualSwapOutput;
    const swapAmount1HasExactMatch = swapAmount1 == actualSwapInput || swapAmount1 == actualSwapOutput;
    if (swapAmount0HasExactMatch && swapAmount1HasExactMatch) {
        return BigDecimal.zero(); // zero slippage
    }
    if (!swapAmount0HasExactMatch && !swapAmount1HasExactMatch) {
        log.warning('Unable to find exact amount match in swap, in {}', [metaTxn.id]);
        return BigDecimal.zero(); // none of the amounts match
    }

    // isSwapExactTokensForTokens
    if (swapAmount0 == actualSwapInput) {
        return getTokenUSDValue(toAddress(metaTxn.swapOutputToken), actualSwapOutput.minus(swapAmount1));
    }
    if (swapAmount1 == actualSwapInput) {
        return getTokenUSDValue(toAddress(metaTxn.swapOutputToken), actualSwapOutput.minus(swapAmount0));
    }

    // isSwapTokensForExactTokens
    if (swapAmount0 == actualSwapOutput) {
        return getTokenUSDValue(toAddress(metaTxn.swapInputToken), swapAmount1.minus(actualSwapInput));
    }
    if (swapAmount1 == actualSwapOutput) {
        return getTokenUSDValue(toAddress(metaTxn.swapInputToken), swapAmount0.minus(actualSwapInput));
    }

    log.warning('Unable calculate unused slippage in USD, for {}', [metaTxn.id]);
    return BigDecimal.zero();
}

// Index usd value of user's input swap leg
function addSwappedUsdData(originalSender: Address, swappedUsdAmount: BigDecimal, event: Transfer): void {
    const user = updateUser(originalSender);
    user.totalSwappedUSD = user.totalSwappedUSD.plus(swappedUsdAmount);
    user.save();

    const userDayData = updateUserDayData(event, originalSender);
    userDayData.dailySwappedUSD = userDayData.dailySwappedUSD.plus(swappedUsdAmount);
    userDayData.totalSwappedUSD = userDayData.totalSwappedUSD.plus(swappedUsdAmount);
    userDayData.save();

    const xataData = XATAMEVData.load(FACTORY_ADDRESS);
    if (xataData) {
        xataData.totalSwappedUSD = xataData.totalSwappedUSD.plus(swappedUsdAmount);
        xataData.save();
    }

    const xataDayData = updateXataDayMEVData(event);
    xataDayData.dailySwappedUSD = xataDayData.dailySwappedUSD.plus(swappedUsdAmount);
    xataDayData.totalSwappedUSD = xataDayData.totalSwappedUSD.plus(swappedUsdAmount);
    xataDayData.save();
}

// Depending on the token sender/receipients, we can infer the leg of the swap and save this information for determining MEV savings from slippage.
// Also saves the user info
function indexSwapDataToTxnAndSender(event: Transfer, originalSender: Address, metaTxn: MetaTransaction): void {
    if (addressEquals(event.params.from.toHexString(), originalSender.toHexString())) { // handle swapInputToken
        metaTxn.swapInputToken = event.address;
        metaTxn.swapInputAmount = event.params.value;
        const swappedUsdAmount = getTokenUSDValue(event.address, event.params.value);
        addSwappedUsdData(originalSender, swappedUsdAmount, event);

    } else if (addressEquals(event.params.to.toHexString(), originalSender.toHexString())) { // handle swapOutputToken
        metaTxn.swapOutputToken = event.address;
        metaTxn.swapOutputAmount = event.params.value;
    }
}

// Decode original sender for non-gas payment transfers
export function indexTokenDataForSwapTransfers(event: Transfer, metaTxn: MetaTransaction): void {
    const dataToDecode = getTxnInputDataToDecode(event);
    const decoded = ethereum.decode(META_TXN_TYPES, dataToDecode);
    if (decoded) {
        const originalSender = decoded.toTuple()[0].toTuple()[0].toAddress();
        indexSwapDataToTxnAndSender(event, originalSender, metaTxn);
    } else {
        log.warning('Unable to decode metaTxn for transfer event invoked by relayer: {}', [event.transaction.hash.toHexString()]);
    }
}

export function indexTokenDataForGasTransfer(event: Transfer, metaTxn: MetaTransaction): void {
    const gasPaidUsd = getTokenUSDValue(event.address, event.params.value);
    metaTxn.gasPaidUSD = gasPaidUsd
    addGasPaidForUserAndGlobalData(event, event.params.from, gasPaidUsd);
}
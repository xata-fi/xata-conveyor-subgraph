import {Address, BigDecimal, BigInt, Bytes, ethereum, log} from "@graphprotocol/graph-ts"
import { ERC20 } from '../generated/templates'

import {
  MetaStatus,
} from "../generated/ConveyorV2Router01/ConveyorV2Router01"
import {User, XATADayMEVData, XATAMEVData} from "../generated/schema"
import {Transfer} from "../generated/templates/ERC20/ERC20";
import {
  addressEquals, FACTORY_ADDRESS,
  getMetaTransaction,
  getTxnInputDataToDecode,
  getUnusedSlippageInUSD, indexTokenDataForGasTransfer, indexTokenDataForSwapTransfers, META_TXN_TYPES,
  stripFunctionSignature
} from "./helpers";
import {addSlippageToDayAndTotalData} from "./updateDayData";

const RELAYER_ADDRESS = '0x7b2854d5b756c5d2057128682c33c83fa5fa8c60'; //May change for different networks.

export function handleMetaStatus(event: MetaStatus): void {
  let metaTxn = getMetaTransaction(event.transaction.hash.toHexString());
  metaTxn.sender = event.params.sender.toHexString();
  metaTxn.success = event.params.success;

  const dataToDecode = getTxnInputDataToDecode(event);
  let decoded = ethereum.decode(META_TXN_TYPES, dataToDecode);
  if (decoded) {
    const decodedTuple = decoded.toTuple();
    let metaTxnStruct = decodedTuple[0].toTuple();

    const feeTokenAddress = metaTxnStruct[1].toAddress();
    log.debug('Decoded feeTokenAddress: {}', [feeTokenAddress.toHexString()]);
    ERC20.create(feeTokenAddress); // Start tracking the fee token for transfers if we have not done so

    const innerTxnCalldata = metaTxnStruct[5].toBytes(); // bytes from metaTransaction
    const swapTypes = '(uint256,uint256,address[],address,uint256)';
    const decodedInnerTxn = ethereum.decode(swapTypes, stripFunctionSignature(innerTxnCalldata));
    if (decodedInnerTxn) {
      const decodedSwap = decodedInnerTxn.toTuple();
      const unusedSlippageUSD = getUnusedSlippageInUSD(decodedSwap[0].toBigInt(), decodedSwap[1].toBigInt(), metaTxn);
      metaTxn.unusedSlippageUSD = unusedSlippageUSD;
      addSlippageToDayAndTotalData(event, unusedSlippageUSD);
    } else {
      log.debug('Could not decode swap data for [{}], it may not be a swap.', [event.transaction.hash.toHexString()]);
    }
  } else {
    log.debug('Unable to decode [{}] as a meta txn.', [event.transaction.hash.toHexString()]);
  }
  metaTxn.save();
}

export function handleTransfer(event: Transfer): void {
  let transactionSender = event.transaction.from.toHexString();
  if (addressEquals(transactionSender, RELAYER_ADDRESS)) { // We're interested only in transactions created by relayer
    let metaTxn = getMetaTransaction(event.transaction.hash.toHexString());
    if (addressEquals(event.params.to.toHexString(), transactionSender)) { // if transfer is sent to relayer's address, this should be a gas payment
      indexTokenDataForGasTransfer(event, metaTxn);
    } else {
      indexTokenDataForSwapTransfers(event, metaTxn);
    }
    metaTxn.save();
  }
}

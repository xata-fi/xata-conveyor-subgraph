import {Address, BigDecimal, BigInt, ethereum, log} from "@graphprotocol/graph-ts"
import {
  ConveyorV2Router01,
  MetaStatus,
  OwnershipTransferred
} from "../generated/ConveyorV2Router01/ConveyorV2Router01"
import { MetaTransaction, User } from "../generated/schema"
import {Transfer} from "../generated/templates/ERC20/ERC20";

// Compares if 2 Address or String types refer to the same address.
function addressEquals(add1: string, add2: string): boolean {
  return add1.toLowerCase() == add2.toLowerCase();
}

function getMetaTransaction(txnId: string): MetaTransaction {
  let metaTxn = MetaTransaction.load(txnId)
  if (!metaTxn) {
    metaTxn = new MetaTransaction(txnId)

    metaTxn.gasToken = Address.zero();
    metaTxn.gasTokenDecimal = 0;
    metaTxn.gasAmount = BigDecimal.zero();
    metaTxn.unusedSlippageUSD = BigDecimal.zero();
    metaTxn.sender = '';
    metaTxn.success = false;
  }
  return metaTxn;
}

export function handleMetaStatus(event: MetaStatus): void {
  let metaTxn = getMetaTransaction(event.transaction.hash.toHexString());

  //Set sender and meta status info
  const originalSenderAddress = event.params.sender;
  let sender = User.load(originalSenderAddress.toHexString());
  if (!sender) {
    sender = new User(originalSenderAddress.toHexString());
    sender.gasPaidUSD = BigDecimal.zero();
  }
  metaTxn.sender = sender.id;
  metaTxn.success = event.params.success;

  //Set decoded information within meta txn
  const metaTxnTypes = '(tuple(address,address,uint256,uint256,uint256,bytes,bytes32),string,uint256,uint256,tuple(uint8,bytes32,bytes32))';
  let decoded = ethereum.decode(metaTxnTypes, event.transaction.input);

  if (decoded) {
    const decodedTuple = decoded.toTuple();
    log.debug('Decoded address: {}', [decodedTuple[0].toTuple()[0].toAddress().toHexString()]);
    log.debug('Decoded domain: {}', [decodedTuple[1].toString()]);
  } else {
    log.debug('Unable to decode.', []);
  }

  sender.save();
  metaTxn.save();
}

export function handleTransfer(event: Transfer): void {
  if (addressEquals(event.params.to.toString(), event.transaction.from.toString())) { // if transfer is sent to relayer's address
    let metaTxn = getMetaTransaction(event.transaction.hash.toHexString());
    metaTxn.gasToken = event.address;
    metaTxn.gasAmount = event.params.value.toBigDecimal();
    metaTxn.gasTokenDecimal = 18;
    metaTxn.save();
    log.debug('Saved gas info. for {}', [metaTxn.id]);
  } else {
    log.debug('{} is not a gas fee payment.', [event.transaction.hash.toHexString()]);
  }
}

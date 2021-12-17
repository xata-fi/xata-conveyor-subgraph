import {BigDecimal, ethereum} from "@graphprotocol/graph-ts/index";
import {User, UserDayData, XATADayMEVData, XATAMEVData} from "../generated/schema";
import {FACTORY_ADDRESS} from "./helpers";
import {Address, BigInt} from "@graphprotocol/graph-ts";

// Get or create XataDayMEVData
export function updateXataDayMEVData(event: ethereum.Event): XATADayMEVData {
    let xataTotalData = XATAMEVData.load(FACTORY_ADDRESS)
    let timestamp = event.block.timestamp.toI32()
    let dayID = timestamp / 86400
    let dayStartTimestamp = dayID * 86400
    let xataDayMEVData = XATADayMEVData.load(dayID.toString())
    if (xataDayMEVData === null) {
        xataDayMEVData = new XATADayMEVData(dayID.toString())
        xataDayMEVData.date = dayStartTimestamp
        xataDayMEVData.dailyUnusedSlippageUSD = BigDecimal.zero();
        xataDayMEVData.dailyGasPaidUSD = BigDecimal.zero();
        xataDayMEVData.dailySwappedUSD = BigDecimal.zero()
        xataDayMEVData.totalUnusedSlippageUSD = BigDecimal.zero();
        xataDayMEVData.totalGasPaidUSD = BigDecimal.zero();
        xataDayMEVData.totalSwappedUSD = BigDecimal.zero();
    }
    if (xataTotalData){
        xataDayMEVData.totalUnusedSlippageUSD = xataTotalData.totalUnusedSlippageUSD;
        xataDayMEVData.totalGasPaidUSD = xataTotalData.totalGasPaidUSD;
        xataDayMEVData.totalSwappedUSD = xataTotalData.totalSwappedUSD;
    }
    xataDayMEVData.save();
    return xataDayMEVData;
}

// Adding slippage to the indexed day and total data
export function addSlippageToDayAndTotalData(event: ethereum.Event, unusedSlippageUSD: BigDecimal): void {
    const xataTotalData = XATAMEVData.load(FACTORY_ADDRESS);
    if (xataTotalData) {
        xataTotalData.totalUnusedSlippageUSD = xataTotalData.totalUnusedSlippageUSD.plus(unusedSlippageUSD);
        xataTotalData.save();
    }
    const xataDayData = updateXataDayMEVData(event);
    xataDayData.dailyUnusedSlippageUSD = xataDayData.dailyUnusedSlippageUSD.plus(unusedSlippageUSD);
    xataDayData.totalUnusedSlippageUSD = xataDayData.totalUnusedSlippageUSD.plus(unusedSlippageUSD);
    xataDayData.save();
}

export function updateUser(userAddress: Address): User {
    let user = User.load(userAddress.toHexString());
    if (user === null) {
        user = new User(userAddress.toHexString());
        user.totalGasPaidUSD = BigDecimal.zero();
        user.totalSwappedUSD = BigDecimal.zero();
    }
    user.save();
    return user;
}

export function updateUserDayData(event: ethereum.Event, userAddress: Address): UserDayData {
    const userTotalData = updateUser(userAddress);
    const timestamp = event.block.timestamp.toI32()
    const dayID = timestamp / 86400
    const dayStartTimestamp = dayID * 86400
    const dayUserId = userAddress.toHexString()
        .concat('-')
        .concat(BigInt.fromI32(dayID).toString());
    let userDayData = UserDayData.load(dayUserId);
    if (userDayData === null) {
        userDayData = new UserDayData(dayUserId);
        userDayData.date = dayStartTimestamp;
        userDayData.dailyGasPaidUSD = BigDecimal.zero();
        userDayData.dailySwappedUSD = BigDecimal.zero();
        userDayData.totalGasPaidUSD = userTotalData.totalGasPaidUSD;
        userDayData.totalSwappedUSD = userTotalData.totalSwappedUSD;
    }
    return userDayData;
}

// Adding gaspaid to the indexed user and total data
export function addGasPaidForUserAndGlobalData(event: ethereum.Event, userAddress: Address, gasPaid: BigDecimal): void {
    const xataTotalData = XATAMEVData.load(FACTORY_ADDRESS);
    if (xataTotalData) {
        xataTotalData.totalGasPaidUSD = xataTotalData.totalGasPaidUSD.plus(gasPaid);
        xataTotalData.save();
    }
    const xataDayData = updateXataDayMEVData(event);
    xataDayData.dailyGasPaidUSD = xataDayData.dailyGasPaidUSD.plus(gasPaid);
    xataDayData.totalGasPaidUSD = xataDayData.totalGasPaidUSD.plus(gasPaid);
    xataDayData.save();

    let userTotalData = updateUser(userAddress);
    userTotalData.totalGasPaidUSD = userTotalData.totalGasPaidUSD.plus(gasPaid);
    userTotalData.save();

    let userDayData = updateUserDayData(event, userAddress);
    userDayData.dailyGasPaidUSD = userDayData.dailyGasPaidUSD.plus(gasPaid);
    userDayData.totalGasPaidUSD = userDayData.totalGasPaidUSD.plus(gasPaid);
    userDayData.save();
}
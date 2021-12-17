
import { PairCreated } from '../generated/Factory/Factory'
import {ERC20} from "../generated/templates";
import {XATAMEVData} from "../generated/schema";
import {FACTORY_ADDRESS} from "./helpers";
import {BigDecimal, log} from "@graphprotocol/graph-ts";

export function handleNewPair(event: PairCreated): void {
    log.debug('Handle new pair', []);
    // Initialize total stats.
    let xataTotalData = XATAMEVData.load(FACTORY_ADDRESS)
    if (xataTotalData === null) {
        xataTotalData = new XATAMEVData(FACTORY_ADDRESS)
        xataTotalData.totalGasPaidUSD = BigDecimal.zero();
        xataTotalData.totalUnusedSlippageUSD = BigDecimal.zero();
        xataTotalData.totalSwappedUSD = BigDecimal.zero();
    }
    xataTotalData.save()

    ERC20.create(event.params.token0); // Start tracking the ERC20 for transfers
    ERC20.create(event.params.token1); // Start tracking the ERC20 for transfers
}

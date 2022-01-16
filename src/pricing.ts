import {Address, BigDecimal, BigInt, log} from "@graphprotocol/graph-ts";
import {ERC20} from "../generated/templates/ERC20/ERC20";
import {AggregatorV3Interface} from "../generated/ConveyorV2Router01/AggregatorV3Interface";
import {ConveyorV2Pair} from "../generated/templates/ERC20/ConveyorV2Pair";

// -------- Network specific price settings ---------------- //
const ATA_ADDRESS = Address.fromString('0x0df0f72ee0e5c9b7ca761ecec42754992b2da5bf'); //Because no chainlink oracle for this.
const ATA_USDT_PAIR = Address.fromString('0x28ccC6a15a2e6FA8C09cdDE9795417E8a9cD6edC');

const priceCache = new Map<string, BigDecimal>();
priceCache.set('0xc2132d05d31c914a87c6611c10748aeb04b58e8f'.toLowerCase(), BigDecimal.fromString('1')); // USDT
priceCache.set('0x2791bca1f2de4661ed88a30c99a7a9449aa84174'.toLowerCase(), BigDecimal.fromString('1')); // USDC
priceCache.set('0xdab529f40e671a1d4bf91361c21bf9f0c9712ab7'.toLowerCase(), BigDecimal.fromString('1')); // BUSD

const chainlinkOracleMap = new Map<Address,Address>();
chainlinkOracleMap.set(Address.fromString('0x9c2c5fd7b07e95ee044ddeba0e97a665f142394f'), Address.fromString('0x443C5116CdF663Eb387e72C688D276e702135C87')); // 1INCH
chainlinkOracleMap.set(Address.fromString('0x95c300e7740d2a88a44124b424bfc1cb2f9c3b89'), Address.fromString('0x5DB6e61B6159B20F068dc15A47dF2E5931b14f29')); // ALCX
chainlinkOracleMap.set(Address.fromString('0x334d7ae7f1d21ceb74537391558ce57bbf3ccf73'), Address.fromString('0x9c371aE34509590E10aB98205d2dF5936A1aD875')); // AXS
chainlinkOracleMap.set(Address.fromString('0x9a71012b13ca4d3d0cdc72a177df3ef03b0e76a3'), Address.fromString('0xD106B538F2A868c28Ca1Ec7E298C3325E0251d66')); // BAL
chainlinkOracleMap.set(Address.fromString('0x3cef98bb43d732e2f285ee605a8158cde967d219'), Address.fromString('0x2346Ce62bd732c62618944E51cbFa09D985d86D2')); // BAT
chainlinkOracleMap.set(Address.fromString('0x3BA4c387f786bFEE076A58914F5Bd38d668B42c3'), Address.fromString('0x82a6c4AF830caa6c97bb504425f6A66165C2c26e')); // BNB
chainlinkOracleMap.set(Address.fromString('0xc26d47d5c33ac71ac5cf9f776d63ba292a4f7842'), Address.fromString('0xF5724884b6E99257cC003375e6b844bC776183f9')); // BNT
chainlinkOracleMap.set(Address.fromString('0xdab529f40e671a1d4bf91361c21bf9f0c9712ab7'), Address.fromString('0xE0dC07D5ED74741CeeDA61284eE56a2A0f7A4Cc9')); // BUSD
chainlinkOracleMap.set(Address.fromString('0x8505b9d2254a7ae468c0e9dd10ccea3a837aef5c'), Address.fromString('0x2A8758b7257102461BC958279054e372C2b1bDE6')); // COMP
chainlinkOracleMap.set(Address.fromString('0x172370d5cd63279efa6d502dab29171933a610af'), Address.fromString('0x336584C8E6Dc19637A5b36206B1c79923111b405')); // CRV
chainlinkOracleMap.set(Address.fromString('0x8f3cf7ad23cd3cadbd9735aff958023239c6a063'), Address.fromString('0x4746DeC9e833A82EC7C2C1356372CcF2cfcD2F3D')); // DAI
chainlinkOracleMap.set(Address.fromString('0x7ec26842f195c852fa843bb9f6d8b583a274a157'), Address.fromString('0x440A341bbC9FA86aA60A195e2409a547e48d4C0C')); // ENJ
chainlinkOracleMap.set(Address.fromString('0x7ceb23fd6bc0add59e62ac25578270cff1b9f619'), Address.fromString('0xF9680D99D6C9589e2a93a78A04A279e509205945')); // WETH
chainlinkOracleMap.set(Address.fromString('0x385eeac5cb85a38a9a07a70c73e0a3271cfb54a7'), Address.fromString('0xDD229Ce42f11D8Ee7fFf29bDB71C7b81352e11be')); // GHST
chainlinkOracleMap.set(Address.fromString('0x5fe2b58c013d7601147dcdd68c143a77499f5531'), Address.fromString('0x3FabBfb300B1e2D7c9B84512fe9D30aeDF24C410')); // GRT
chainlinkOracleMap.set(Address.fromString('0x53e0bca35ec356bd5dddfebbd1fc0fd03fabad39'), Address.fromString('0xd9FFdb71EbE7496cC440152d43986Aae0AB76665')); // LINK
chainlinkOracleMap.set(Address.fromString('0xa1c57f48f0deb89f569dfbe6e2b7f46d33606fd4'), Address.fromString('0xA1CbF3Fe43BC3501e3Fc4b573e822c70e76A7512')); // MANA
chainlinkOracleMap.set(Address.fromString('0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270'), Address.fromString('0xAB594600376Ec9fD91F8e885dADF0CE036862dE0')); // MATIC
chainlinkOracleMap.set(Address.fromString('0x831753dd7087cac61ab5644b308642cc1c33dc13'), Address.fromString('0xa058689f4bCa95208bba3F265674AE95dED75B6D')); // QUICK
chainlinkOracleMap.set(Address.fromString('0xBbba073C31bF03b8ACf7c28EF0738DeCF3695683'), Address.fromString('0x3D49406EDd4D52Fb7FFd25485f32E073b529C924')); // SAND
chainlinkOracleMap.set(Address.fromString('0x50b728d8d964fd00c2d0aad81718b71311fef68a'), Address.fromString('0xbF90A5D9B6EE9019028dbFc2a9E50056d5252894')); // SNX
chainlinkOracleMap.set(Address.fromString('0x0b3f868e0be5597d5db7feb59e1cadbb0fdda50a'), Address.fromString('0x49B0c695039243BBfEb8EcD054EB70061fd54aa0')); // SUSHI
chainlinkOracleMap.set(Address.fromString('0x2e1ad108ff1d8c782fcbbb89aad783ac49586756'), Address.fromString('0x7C5D415B64312D38c56B54358449d0a4058339d2')); // TUSD
chainlinkOracleMap.set(Address.fromString('0xb33eaad8d922b1083446dc23f610c2567fb5180f'), Address.fromString('0xdf0Fb4e4F928d2dCB76f438575fDD8682386e13C')); // UNI
chainlinkOracleMap.set(Address.fromString('0x2791bca1f2de4661ed88a30c99a7a9449aa84174'), Address.fromString('0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7')); // USDC
chainlinkOracleMap.set(Address.fromString('0xc2132d05d31c914a87c6611c10748aeb04b58e8f'), Address.fromString('0x0A6513e40db6EB1b165753AD52E80663aeA50545')); // USDT
chainlinkOracleMap.set(Address.fromString('0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6'), Address.fromString('0xDE31F8bFBD8c84b5360CFACCa3539B938dd78ae6')); // WBTC
chainlinkOracleMap.set(Address.fromString('0xda537104d6a5edd53c6fbba9a898708e465260b6'), Address.fromString('0x9d3A43c111E7b2C6601705D9fcF7a70c95b1dc55')); // YFI
chainlinkOracleMap.set(Address.fromString('0x5559edb74751a0ede9dea4dc23aee72cca6be3d5'), Address.fromString('0x6EA4d89474d9410939d429B786208c74853A5B47')); // ZRX

const CHAINLINK_DECIMAL = BigDecimal.fromString('100000000'); //10e8

function getPriceFromPairWithUSDBase(tokenAddress: Address, pairAddress: Address): BigDecimal {
    const pair = ConveyorV2Pair.bind(pairAddress);
    const reserves = pair.getReserves();
    const reserve0 = reserves.value0.toBigDecimal();
    const reserve1 = reserves.value1.toBigDecimal();
    const token0Dec = BigInt.fromI32(ERC20.bind(pair.token0()).decimals()).toBigDecimal();
    const token1Dec = BigInt.fromI32(ERC20.bind(pair.token1()).decimals()).toBigDecimal();
    if (tokenAddress.toHexString() == pair.token0().toHexString()) {
        return reserve0.div(reserve1).div(token0Dec.div(token1Dec));
    } else if (tokenAddress.toHexString() == pair.token1().toHexString()) {
        return reserve1.div(reserve0).div(token1Dec.div(token0Dec));
    }
    log.warning('Unable to obtain price for {}', [tokenAddress.toHexString()]);
    return BigDecimal.zero();
}

function getValueFromPriceAndToken(price: BigDecimal, amount: BigInt, tokenAddress: Address): BigDecimal {
    const undividedValue = price.times(amount.toBigDecimal());
    const tokenContract = ERC20.bind(tokenAddress);
    const tokenDecimals = BigInt.fromI32(10).pow(u8(tokenContract.decimals())).toBigDecimal();
    return undividedValue.div(tokenDecimals);
}

// Given a token address and amount denominated in the token's decimal value, get the USD value
export function getTokenUSDValue(tokenAddress: Address, amount: BigInt): BigDecimal {
    const tokenAddressStr = tokenAddress.toHexString().toLowerCase();
    // See if we already know the price
    if (priceCache.has(tokenAddressStr)) {
        log.debug('price cache hit for {}', [tokenAddressStr]);
        const price = priceCache.get(tokenAddressStr);
        return getValueFromPriceAndToken(price, amount, tokenAddress);
    }

    // Default handling for ATA
    if (tokenAddress.toHexString() == ATA_ADDRESS.toHexString()) {
        log.debug('Checking ATA price.', []);
        const ataPrice = getPriceFromPairWithUSDBase(ATA_ADDRESS, ATA_USDT_PAIR);
        priceCache.set(tokenAddressStr, ataPrice);
        log.debug('ataPrice: {}.', [ataPrice.toString()]);
        return getValueFromPriceAndToken(ataPrice, amount, tokenAddress);
    }

    // Handling using chainlink
    if (chainlinkOracleMap.has(tokenAddress)) {
        log.debug('Checking using chainlink.', []);
        const oracleAddress = chainlinkOracleMap.get(tokenAddress);
        const priceOracle = AggregatorV3Interface.bind(oracleAddress);
        let price = priceOracle.latestRoundData().value1.toBigDecimal();
        priceCache.set(tokenAddressStr, price);
        const undividedValue = price.times(amount.toBigDecimal());
        const tokenContract = ERC20.bind(tokenAddress);
        const tokenDecimals = BigInt.fromI32(10 ** tokenContract.decimals());
        return undividedValue.div(tokenDecimals.toBigDecimal()).div(CHAINLINK_DECIMAL);
    }

    log.debug('Unable to find token price for [{}]. Returning 0 value.', [tokenAddressStr]);
    return BigDecimal.zero();
}

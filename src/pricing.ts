import {Address, BigDecimal, BigInt, log} from "@graphprotocol/graph-ts";
import {ERC20} from "../generated/templates/ERC20/ERC20";
import {AggregatorV3Interface} from "../generated/ConveyorV2Router01/AggregatorV3Interface";
import {ConveyorV2Pair} from "../generated/ConveyorV2Router01/ConveyorV2Pair";

// -------- Network specific price settings ---------------- //
const ATA_ADDRESS = Address.fromString('0xa2120b9e674d3fc3875f415a7df52e382f141225'); //Because no chainlink oracle for this.
const ATA_USDT_PAIR = Address.fromString('0x69e7dca6d62d9152dd4e0fb3f520cd26f4bf7774');

const priceCache = new Map<Address, BigDecimal>();
priceCache.set(Address.fromString('0x55d398326f99059ff775485246999027b3197955'), BigDecimal.fromString('1')); // USDT
priceCache.set(Address.fromString('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'), BigDecimal.fromString('1')); // USDC
priceCache.set(Address.fromString('0xe9e7cea3dedca5984780bafc599bd69add087d56'), BigDecimal.fromString('1')); // BUSD

const chainlinkOracleMap = new Map<Address,Address>();
chainlinkOracleMap.set(Address.fromString('0x3ee2200efb3400fabb9aacf31297cbdd1d435d47'), Address.fromString('0xa767f745331D267c7751297D982b050c93985627')); // ADA
chainlinkOracleMap.set(Address.fromString('0x8fF795a6F4D97E7887C79beA79aba5cc76444aD'), Address.fromString('0x43d80f616DAf0b0B42a928EeD32147dC59027D41')); // BCH
chainlinkOracleMap.set(Address.fromString('0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82'), Address.fromString('0xB6064eD41d4f67e353768aA239cA86f4F73665a1')); // CAKE
chainlinkOracleMap.set(Address.fromString('0x1af3f329e8be154074d8769d1ffa4ee058b1dbc'), Address.fromString('0x132d3C0B1D2cEa0BC552588063bdBb210FDeecfA')); // DAI
chainlinkOracleMap.set(Address.fromString('0xba2ae424d960c26247dd6c32edc70b295c744c4'), Address.fromString('0x3AB0A0d137D4F946fBB19eecc6e92E64660231C8')); // DOGE
chainlinkOracleMap.set(Address.fromString('0x7083609fce4d1d8dc0c979aab8c869ea2c87340'), Address.fromString('0xC333eb0086309a16aa7c8308DfD32c8BBA0a2592')); // DOT
chainlinkOracleMap.set(Address.fromString('0x2170ed0880ac9a755fd29b2688956bd959f933f8'), Address.fromString('0x9ef1B8c0E4F7dc8bF5719Ea496883DC6401d5b2e')); // ETH
chainlinkOracleMap.set(Address.fromString('0x0d8ce2a99bb6e3b7db580ed848240e4a0f9ae153'), Address.fromString('0xE5dbFD9003bFf9dF5feB2f4F445Ca00fb121fb83')); // FIL
chainlinkOracleMap.set(Address.fromString('0xf8a0bf9cf54bb92f17374d9e9a321e6a111a51bd'), Address.fromString('0xca236E327F629f9Fc2c30A4E95775EbF0B89fac8')); // LINK
chainlinkOracleMap.set(Address.fromString('0x4338665cbb7b2485a8855a139b75d5e34ab0db94'), Address.fromString('0x74E72F37A8c415c8f1a98Ed42E78Ff997435791D')); // LTC
chainlinkOracleMap.set(Address.fromString('0xcc42724c6683b7e57334c4e856f4c9965ed682bd'), Address.fromString('0x7CA57b0cA6367191c94C8914d7Df09A57655905f')); // MATIC
chainlinkOracleMap.set(Address.fromString('0x947950BcC74888a40Ffa2593C5798F11Fc9124C4'), Address.fromString('0xa679C72a97B654CFfF58aB704de3BA15Cde89B07')); // SUSHI
chainlinkOracleMap.set(Address.fromString('0xbf5140a22578168fd562dccf235e5d43a02ce9b1'), Address.fromString('0xb57f259E7C24e56a1dA00F66b55A5640d9f9E7e4')); // UNI
chainlinkOracleMap.set(Address.fromString('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'), Address.fromString('0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE')); // WBNB

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

// Given a token address and amount denominated in the token's decimal value, get the USD value
export function getTokenUSDValue(tokenAddress: Address, amount: BigInt): BigDecimal {

    // See if we already know the price
    if (priceCache.has(tokenAddress)) {
        return priceCache.get(tokenAddress);
    }

    // Default handling for ATA
    if (tokenAddress.toHexString() == ATA_ADDRESS.toHexString()) {
        const ataPrice = getPriceFromPairWithUSDBase(ATA_ADDRESS, ATA_USDT_PAIR);
        const undividedValue = ataPrice.times(amount.toBigDecimal());
        const tokenContract = ERC20.bind(tokenAddress);
        const tokenDecimals = BigInt.fromI32(10 ** tokenContract.decimals());
        const usdValue = undividedValue.div(tokenDecimals.toBigDecimal());
        priceCache.set(tokenAddress, usdValue);
        return usdValue;
    }

    // Handling using chainlink
    if (chainlinkOracleMap.has(tokenAddress)) {
        const oracleAddress = chainlinkOracleMap.get(tokenAddress);
        const priceOracle = AggregatorV3Interface.bind(oracleAddress);
        const undividedValue = priceOracle.latestRoundData().value1.times(amount).toBigDecimal();
        const tokenContract = ERC20.bind(tokenAddress);
        const tokenDecimals = BigInt.fromI32(10 ** tokenContract.decimals());
        const usdValue = undividedValue.div(tokenDecimals.toBigDecimal()).div(CHAINLINK_DECIMAL);
        priceCache.set(tokenAddress, usdValue);
        return usdValue;
    }

    log.debug('Unable to find token price for [{}]. Returning 0 value.', [tokenAddress.toHexString()]);
    return BigDecimal.zero();
}
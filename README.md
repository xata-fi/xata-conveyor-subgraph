# xata-conveyor-subgraph
This is the subgraph for information about XATA's meta transactions on the DEX.

It indexes these information into overall and daily buckets.
* Amount of unused slippage in each trade, per user, and across protocol.
* USD quantity of gas paid per user and across protocol
* Amount of USD swapped per user, and across protocol

This is the source code for the subgraph hosted at:

|Network|URL|
|-------|---|
|BSC|https://thegraph.com/hosted-service/subgraph/r2d2-rmbl/xata-bsc-conveyor|
|MATIC|TBC|

## Network specific settings
1. subgraph.yaml (search for 'network')
2. package.json (check 'deploy' command)
3. Hard-coded addresses in various .ts files.


## Deploying the subgraph
1. `yarn install`
2. `yarn codegen`
3. `yarn deploy`

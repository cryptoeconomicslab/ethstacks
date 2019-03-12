# Plasma Chamber

[![Build Status](https://travis-ci.org/cryptoeconomicslab/plasma-chamber.svg?branch=master)](https://travis-ci.org/cryptoeconomicslab/plasma-chamber)

[![Coverage Status](https://coveralls.io/repos/github/cryptoeconomicslab/plasma-chamber/badge.svg?branch=master)](https://coveralls.io/github/cryptoeconomicslab/plasma-chamber?branch=master)

**This is experimental software, don't run in a production yet.**

## Overview
Plasma Chamber is Cryptoeconomics Lab's first product that generates a specific Plasma infrastructure from Plasma specific language. Our implementation used Plasma Cash model as its basis, but support more complex transactions for each decentralized applicaiton without sacrificing security.
Plasma is a 2nd layer scaling solution focused on throughput inprovement rather than quick finality. Plasma is not an EVM based, but UTXO-model based scaling solution inheritating Ethereum blockchain's security. In other words, it aims to give a perfect fund safety, a transaction compresssion, and no guarantee of stability. Plasma is often times expected to be applied to several kinds of Dapps such as games, asset exchanges, etc. However, it requires production teams to employ expertised Plasma researchers since careful security analysis is necessary to prepare its infrastructure. This causes duplicated research for each project, and security insights would not be shared sufficiently and efficiently among the projects. Hence, Plasma Chamber is implemented to be a Dapp building framework without requiring domain-specific Plasma for each project.

## Plasma Chamber Design 
This section descrives the protocol design used by Plasma Chamber, Cryptoeconomics Lab's first Plasma-based implementation. Plasma Cash model is the basis for the implemenation, but several modifications proposed later in Plasma Cashflow design are incorporated.
Plasma Chamber's architecture enables service providers and its users to take advantage of lower transaction costs and higher throughput without sacrificing security derived from the rootchain. This is acomplished by process of compacting multiple transaction data on a child chain block and submitting it to a root chain (Ethereum blockchain in our case). The diagram below illustrates the connection between the wallets of service probider/ users and Plasma Chamber on top of Ethreum blockchain as its root chain.<br>

Plasma Chamber has 3 key features and security guarantees listed below.<br>

### Features
1. ##### Fast Finality: Allows customers to have better user experience of transaction confirmation.<br>
2. ##### Checkpoint: Reduces the transaction history that each end user has to hold<br>
3. ##### Custom Transaction: Enables plapps-developers to build decentralized application that has more function than just a transfer transaction.<br>

### Security Guarantee
1. ##### Simple Exit Game: With this simple exit game security model, it does not allow any single malicious exit. Unlike PlasmaMVP chain-wide mass exit via uncheallengeable exit doesn't exist, and so economically scalable than any other sidechain design. And still keeping non-interactive exit game. Multi round challenge-response isn't needed, instead, coin-wise priority queue secures you fund from the operator.<br>
2. ##### Exit Game for Custom Transaction: Various UTXO Contracts are permitted on this Plasma childchain, so the inputs and outputs of a Tx is can be multiple unlike pure Plasma Cash. For example, swap, multisig, or escrow are the popular example of UTXO contracts, and how to develop these contracts will be described at [Custom transaction and state verifier](https://scrapbox.io/cryptoeconimicslab/Custom_transaction_and_state_verifier).<br>
3. ##### Longer Online Requiremet: We can choose long exit period. Even with a long exit period, users can withdraw funds immediately as long as they can prove the history of the asset being exited by [Simple Fast Withdrawals](https://ethresear.ch/t/simple-fast-withdrawals/2128). On the other hand, the history that the client should have increases in proportion to the long exit period.<br>

These properties are implemented as a Plasma Cash Variant which supports fungibility of coins via range support. This range is implemented via sum merkle tree. Each leaves have a unique id. This design focuses on maximally utilizing the security of Plasma Cash's robost security model.<br>

[![Image](https://gyazo.com/69e8f115f253c6af0840eabad473d8f8/thumb/1000)](https://gyazo.com/69e8f115f253c6af0840eabad473d8f8)<br>

Please refer to ```Key Features``` section below for more details of each property.<br>

### Key Features
These are several key features of our design, which are incorporated into the basis of our implemenation, Plasma Cash design.<br>

#### 1. Fast Finality
``Finality``<br>
Finality means that once a transaction has been processed in a certain block, it will forever stay in history and nothing can revert that operation. This immutability of state transition will be especially important in the fincance filed.<br>

Fast Finality function will only be available to limited third party service providers who hold wallets and controll to transfer token values to users' wallets. Service clients can confirm their transaction's finality faster when the service providers buy Fast Finality Token from the operator (in this case, service providers are indpendent from the operator) and make a deal with them to include the transaction in a timely manner. In other words, the fast finality bandwidth is sold via merchandiser-wallet. If anything goes wrong within the network, service providers can challenge operators on the Fast Finality contract, claiming that the transaction was not included in the corresponding block.<br>
See [Fast Finality](https://github.com/cryptoeconomicslab/plasma-chamber/wiki/Plasma-Fast-Finality) section for the source code of this Fast Finality contract. The rough specification is in [Learn Plasma - Research](https://www.learnplasma.org/en/research/). The detailed specification is to be described in upcoming our whitepaper although, we've implemented it thus you can check it up.<br>

#### 2. Simple Exit Game
Inspired by [simpler-exit-game-for-plasma-cash](https://ethresear.ch/t/a-simpler-exit-game-for-plasma-cash/4917).<br>
Simple Exit Game is non-interactive Exit Game that was proposed to make Plasma Chamber relisient to attacks combining withholding and invalid exit attempts. The feature of Chamber's Simple Exit Game is that it is a non-interactive Exit Game that can handle range chunking.<br>

See [Simple Exit Game](https://github.com/cryptoeconomicslab/plasma-chamber/wiki/Exit-Game) section for the source code.<br>

#### 3. Checkpoint
Checkpoint reduces the amount of history data that each user need to keep on wallet, inheritating from [Plasma XT](https://ethresear.ch/t/plasma-xt-plasma-cash-with-much-less-per-user-data-checking/1926). Adding this to fungible Plasma Cash require careful analysis in order not to remain chain-wide mass exit probability. Via this checkpointing, we don't need to wait for the implementation of trusted setup RSA Accumulator nor trustless setup zk-STARKs.<br>
See [Checkpoint](https://github.com/cryptoeconomicslab/plasma-chamber/wiki/Plasma-Checkpoint) section for the source code.<br>

#### 4. Defragmentation
Plasma Chamber has intra-chain atomic swap and force inclusion property. These properties are implemented for the fragmentation of the [segment](https://scrapbox.io/cryptoeconimicslab/segment) of the coins. Defragmentation requires the intra-chain atomic swap first, then securing the safety of the exit game. The [force inclusion](https://hackmd.io/DgzmJIRjSzCYvl4lUjZXNQ?view#Atomic-Swap-Force-Include)(and see also [our docs](https://github.com/cryptoeconomicslab/plasma-chamber/wiki/Exit-Game#force-inclusionsegment-tx-proof-sigs-sigsindex)) is required as mitigation of newly introduced atomic swap feature. Current limitation requires end users to be online for atomic swap. By making the operator as the broker of swap request matching, end users' online requirement would be mitigated. This update doesn't spoil fund security of Plasma, and the operator has the incentive to maintain the chain non fragmented.<br>
See [Defragmentation](https://scrapbox.io/cryptoeconimicslab/Defragmentation)<br>

#### 5. Custom Transaction
The operator is able to set adhoc transaction verifiers and state verifiers. By this immutably appendable modules, Chamber is to be [#plapps](https://scrapbox.io/cryptoeconimicslab/plapps) framework in order to develop more than simple payment.<br>

#### Summary of this section
We implemented Plasma Cash as the basis of our security model and extend it to Plasma Chamber adding some key features listed above.<br>
- We use fungble token on Plasma childchain.
- The fast finality bandwidth is sold via Merchant PoS wallet.
- Custom transactions are immutably appendable by the operator, and would be available for plapps developers.

## Archtecture
### Root chain contract
#### Sum Merkle Tree

#### Deposits
Any Ethereum address may deposit Eth or other fungible token into the root chain contract. Then such deposits sends the equivalent amount of pseudo Eth/ERC20 to the child chain contract. Those deposited funds are recognized as a single UTXO on the child cain. Such UTXO can then be both spent on the child chain or exited to the root chain by users after a challenge period ends without successful challenge.<br>

#### Exits
As users request to withdraw their funds deposited on the root chain, child chain gives the equivalent amount of pseudo coins deposited on the child to the root chain, submitting the existence proof of the transaction to the root chain. This procedure is called ‘exit.’ Existence proof is consists of 3 different piece of information; Merkle Hash of Merkle Tree, which the exiting transaction was included in, Merkle proof, and the block height of the transaction.<br>

Please see  [Simple Exit Game](https://github.com/cryptoeconomicslab/plasma-chamber/wiki/Exit-Game) for the details of Exit and Challenge, including Exit games.<br>

#### Challenge


### Child chain contract
#### Basic Features
1. Child chain contract uses UTXO model to transfer the value of pseudo coins<br>
2. Enables a PoA network centrally controlled by a single party or entity called ‘operator.’ This enables high transaction throughput, while deriving the security robustness from the root chain.<br>


## Demo Gadjets
Those are interface programs that will improve the usability of Plasma Chamber and predicted to be implemented soon.<br>
- UI of Escrow<br>
- Cloud KeyStore<br>
- SDK of Escrow Verifier<br>
- Start from DAI and use LCETH:JPY<br>
- Fee Model<br>
    - - head-body Tx structure
    - - Only merge&swapTx can be ZeroFee.
    - - GasToken based flat fee (gastoken.io)

## User Generated Contracts Tasks
After we release our first demo, we would like t
- MerchantWallet<br>
- BlockExplorer<br>
- Deployer: must return SDK and Documentation<br>
- UserExperienceTarget: 5 days for deploy<br>


## Source codes 
Vyper contracts and core module are [here](https://github.com/cryptoeconomicslab/chamber-packages).
https://github.com/cryptoeconomicslab/chamber-packages

### chamber-operator

chamber-operator is operating application for Plasma chain.

## Getting Started

### Requirements

* Node.JS v8.11.3 or higher
* ganache-cli latest versionc
* vyper 0.1.0b8

### Deploy contracts

Run ganache with test mnemonic
```sh
ganache-cli --mnemonic 'candy maple cake sugar pudding cream honey rich smooth crumble sweet treat'
```

deploy contracts.

```sh
npm i lerna -g
npm i yarn -g
git clone https://github.com/cryptoeconomicslab/chamber-packages
lerna bootstrap
cd packages/chamber-contracts
yarn build
truffle migrate --network local
```

### Run plasma chain

```sh
git clone https://github.com/cryptoeconomicslab/plasma-chamber
lerna bootstrap
mkdir .db
yarn start
```

### Run wallet

```sh
git clone https://github.com/cryptoeconomicslab/plasma-wallet
yarn install
yarn start
```

Open http://localhost:1234 in browser.

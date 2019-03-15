
# Plasma Chamber

[![Build Status](https://travis-ci.org/cryptoeconomicslab/plasma-chamber.svg?branch=master)](https://travis-ci.org/cryptoeconomicslab/plasma-chamber)

[![Coverage Status](https://coveralls.io/repos/github/cryptoeconomicslab/plasma-chamber/badge.svg?branch=master)](https://coveralls.io/github/cryptoeconomicslab/plasma-chamber?branch=master)

Plasma Chamber is a toolset that guarantees security, scalability, and versatility of Dapps development on Plasma. 


**IMPORTANT NOTICE:** <br>
* **This is an experimental software, does not run in a production yet.**

* **Vyper contracts and core modules are [here](https://github.com/cryptoeconomicslab/chamber-packages).**
<br />

**Table of Contents** 

* [Introduction](#introduction)

* [Overview](#overview)

* [Getting Started](#getting-started) 

* [Architecture](#architecture) 

    * [Root Chain Contracts](#root-chain-contracts)
        * Sum Merkle Tree 
        * Deposit 
        * Exit 
        * Challenge 
    
    * [Child Chain](#child-chain)  
        * Tx Collection 
        * Tx Verification
        * Plasma Block Generation and Submit

    * [Wallet](#wallet) 
        * History Verification
        * Transaction Generator
        * Transaction Inspector 

* [Plasma Chamber Implementation Design](#plasma-chamber-implementation-design) 
	* [Key Features](#key-features)
		* Defragmentation 
		* Fast Finality 
		* Checkpoint 
		* Custom Transaction 
        
	* [Security Guarantees](#security-guarantees)
		* Simple Exit Game
		* Specific Exit Game for Custom Transaction 
		* Longer Online Requirement 

* [Implementation Schedule](#implementation-schedule) 
	* Demo Gadgets 
	* User Generated Contracts

# Introduction
Plasma Chamber is Cryptoeconomics Lab's first product that enables to generate General Purpose Plasma. Our implementation used Plasma Cash design as its basis, but support more complex transactions for each decentralized application without sacrificing its security.

# Overview
Plasma is a 2nd layer scaling solution focusing on throughput improvement rather than quick finality. Plasma is not an EVM based, but a UTXO-model based scaling solution inheriting Ethereum blockchain's security. In other words, it aims to give a perfect fund safety, a transaction compression. Plasma is often times expected to be applied to several kinds of Dapps such as games, asset exchanges, etc. However, it requires production teams to employ expert Plasma researchers for careful security analysis in order to prepare their infrastructure. This causes duplicated research for each project, and security insights would not be shared sufficiently and efficiently amongst the projects. Hence, in order to solve this problem, Plasma Chamber is implemented to be a Dapp building framework without requiring domain-specific Plasma for each project.

# Getting Started

## Requirements

* Node.JS v8.11.3 or higher
* ganache-cli latest versionc
* vyper 0.1.0b8

## Deploy contracts

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

## Run plasma chain

```sh
cd packages/operator
node -r dotenv/config lib/entry
```

Or you can install global module.

```sh
npm i @layer2/operator -g
ROOTCHAIN_ENDPOINT=http://127.0.0.1:8545 ROOTCHAIN_ADDRESS=0xeec918d74c746167564401103096d45bbd494b74 OPERATOR_PRIVATE_KEY=0xc87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3 layer2-operator
```

Or use docker image.

```sh
docker run -e 'ROOTCHAIN_ADDRESS='{root chain address}' -e 'OPERATOR_PRIVATE_KEY={private key}' -e 'ROOTCHAIN_ENDPOINT='{endpoint}' -v /path/to/db:/var/plasmadb  -itd -u node cryptoeconomicslab/plasma-chamber:development
```

You need envs described [here](https://github.com/cryptoeconomicslab/chamber-packages/tree/master/packages/operator#environment-variables)


## Run wallet

```sh
git clone https://github.com/cryptoeconomicslab/plasma-wallet
yarn install
cp .env.example .env
yarn start
```

Open http://localhost:1234 in browser.

# Architecture

Plasma Chamber's architecture enables service providers and its users to take advantage of lower transaction costs and higher throughput without sacrificing security derived from the rootchain. This is accomplished by process of compacting multiple transaction data on a child chain block and submitting it to a root chain (Ethereum blockchain in our case). The diagram below illustrates the connection between the wallets of service provider/ users and Plasma Chamber on top of Ethereum blockchain as its root chain.<br>
[![Image](https://gyazo.com/69e8f115f253c6af0840eabad473d8f8/thumb/1000)](https://gyazo.com/69e8f115f253c6af0840eabad473d8f8)<br>

## Root Chain Contracts
### Sum Merkle Tree

### Deposit
Any Ethereum address may deposit Eth or other fungible token into the root chain contract. Then such deposits send the equivalent amount of pseudo Eth/ERC20 to the child chain contract. Those deposited funds are recognized as a single UTXO on the child cain. Such UTXO can then be both spent on the child chain or exited to the root chain by users after a challenge period ends without a successful challenge completion.<br>

### Exit
As users request to withdraw their funds deposited on the root chain, child chain gives the equivalent amount of pseudo coins deposited on the child to the root chain, submitting the existence proof of the transaction to the root chain. This procedure is called ‘exit.’ Existence proof is consists of 3 different piece of information; Merkle Hash of Merkle Tree, in which the exiting transaction was included, Merkle proof, and the block height of the transaction.<br>

Please see  [Simple Exit Game](https://github.com/cryptoeconomicslab/plasma-chamber/wiki/Exit-Game) section for the details of our Exit and Challenge design, including Exit games.<br>

### Challenge
When transactions are in the process of exit requested by a user, another use can invalidate the transaction by "Challenge" action, presenting other transaction with true ownership. When the challenge was approved by the contract, then the exit get blocked. 

## Child Chain 
1. Uses UTXO model to transfer pseudo fungible coins with a unique id. <br>
2. Enables a PoA network, which is centrally controlled by a single party or entity called ‘operator.’ This enables high transaction throughput, while deriving the security robustness from the root chain.<br>

### Tx Collection
### Tx Verification
### Plasma Block Generation and Submit

## Wallet 
### History Verification
### Transaction Generator
### Transaction Inspector

# Plasma Chamber Implementation Design 
This section describes the feature of Plasma Chamber's protocol design.Plasma Cash model is the basis for our implementation, but several modifications proposed later in Plasma Cashflow and Plasma Prime design are incorporated. <br>

**Plasma Chamber has 4 key features and 3 security guarantees listed below.**

## Key Features
### 1. Defragmentation 
Plasma Chamber has intra-chain atomic swap and force inclusion property. These properties are implemented for the fragmentation of the [segment](https://scrapbox.io/cryptoeconimicslab/segment) of the coins. Defragmentation requires the intra-chain atomic swap first, then securing the safety of the exit game. The [Force Inclusion](https://hackmd.io/DgzmJIRjSzCYvl4lUjZXNQ?view#Atomic-Swap-Force-Include)function is required to mitigate newly introduced atomic swap feature. You can refer to [our docs](https://github.com/cryptoeconomicslab/plasma-chamber/wiki/Exit-Game#force-inclusionsegment-tx-proof-sigs-sigsindex) for more details of Force Inclusion function. 
Current limitation requires of the end users who are swapping the segments of the coins to be online simultaneously for atomic swap. By making the operator as the broker of swap request matching, end users' online requirement would be mitigated. This update doesn't lower the fund security of Plasma, and incentivize the operator to maintain the chain defragmented.<br>
Please also see more of our documents on Defragmentation form [here](https://scrapbox.io/cryptoeconimicslab/Defragmentation). <br>

### 2. Fast Finality
Allows customers to have better user experience of transaction confirmation.The fast finality bandwidth is sold via Merchant PoS wallet.<br>

``Finality``<br>
Finality means that once a transaction has been processed in a certain block, it will forever stay in history and nothing can revert that operation. This immutability of state transition will be especially important in the finance filed.<br>

Fast Finality function will only be available to limited third party service providers who hold wallets and control to transfer token values to users' wallets. Service clients can confirm their transaction's finality faster when the service providers buy Fast Finality Token from the operator (in this case, service providers are independent from the operator) and make a deal with them to include the transaction in a timely manner. In other words, the fast finality bandwidth is sold via merchandiser-wallet. If anything goes wrong within the network, service providers can challenge operators on the Fast Finality contract, claiming that the transaction was not included in the corresponding block.<br>
See [Fast Finality](https://github.com/cryptoeconomicslab/plasma-chamber/wiki/Plasma-Fast-Finality) section for the source code of this Fast Finality contract. The rough specification is in [Learn Plasma - Research](https://www.learnplasma.org/en/research/). <br>

### 3. Checkpoint
Reduces the transaction history that each end user has to hold. <br>
Checkpoint reduces the amount of history data that each user need to keep on wallet, inheriting from [Plasma XT](https://ethresear.ch/t/plasma-xt-plasma-cash-with-much-less-per-user-data-checking/1926). Adding this to fungible Plasma Cash require careful analysis in order not to remain chain-wide mass exit probability. Via this checkpointing, we don't need to wait for the implementation of trusted setup RSA Accumulator nor trustless setup zk-STARKs.<br>
See [Checkpoint](https://github.com/cryptoeconomicslab/plasma-chamber/wiki/Plasma-Checkpoint) section for the source code.<br>

### 4. Custom Transaction
Enables plapps-developers to build decentralized application that has more function than just a transfer transaction.<br>
The operator is able to set adhoc transaction verifiers and state verifiers. By this immutably appendable modules, Chamber is to be [#plapps](https://scrapbox.io/cryptoeconimicslab/plapps) framework in order to develop more than simple payment.<br>

## Security Guarantees
These properties are implemented as a Plasma Cash variant which supports fungibility of coins with range feature implemented by Sum Merkle Tree. At the same time, this design focuses on to utilize the security of original Plasma Cash design's robost security model to the maximum level.<br>

### 1.Simple Exit Game
Our simple exit game, a non-intereactive security model was implemented inspired by [simpler-exit-game-for-plasma-cash](https://ethresear.ch/t/a-simpler-exit-game-for-plasma-cash/4917), which does not allow any randome patter of malicious exit and Mass Exit problem. It make Plasma Chamber resilient to attacks combining withholding and invalid exit attempts. Since multi round challenge-response is not required anymore, coin-wise priority queue secures each end user's fund from the operator. Also, our Simple Exit Game can be compatible with Range Chunking feature. <br>
See [Simple Exit Game](https://github.com/cryptoeconomicslab/plasma-chamber/wiki/Exit-Game) section for the source code.<br>

### 2. Exit Game for Custom Transaction
Since various UTXO contracts are permitted on this Plasma childchain, the inputs and outputs of a tx can be more than one set unlike the original Plasma Cash design. For instance, swap, multisig, or escrow functions are the popular example of UTXO contracts. How to develop these contracts will be described in [Custom transaction and state verifier](https://scrapbox.io/cryptoeconimicslab/Custom_transaction_and_state_verifier).<br>

### 3. Longer Online Requirement
Developers can choose to implement longer exit period. Even with a longer exit period, end users can withdraw their funds immediately as long as they can provide the history of the asset by the [Simple Fast Withdrawals](https://ethresear.ch/t/simple-fast-withdrawals/2128) function and verify themselves. On the other hand, clients will have to hold their history incrementing in proportion to the longer exit period.<br>


# Implementation Schedule 
## Demo Gadgets
Those are interface programs predicted to be implemented soon to improve the usability of Plasma Chamber.<br>
- UI of Escrow<br>
- Cloud KeyStore<br>
- SDK of Escrow Verifier<br>
- Start from DAI and use LCETH:JPY<br>
- Fee Model<br>
    - head-body Tx structure
    - Only merge&swapTx can be ZeroFee.
    - GasToken based flat fee (gastoken.io)

## User Generated Contracts Tasks
After we release our first demo, we would like ask Dapps developers across the world to implement these functions through open-source contribution here. <br>
- MerchantWallet<br>
- BlockExplorer<br>
- Deployer: must return SDK and Documentation<br>
- UserExperienceTarget: 5 days for deploy<br>




# Plasma Chamber

[![Build Status](https://travis-ci.org/cryptoeconomicslab/plasma-chamber.svg?branch=master)](https://travis-ci.org/cryptoeconomicslab/plasma-chamber)

[![Coverage Status](https://coveralls.io/repos/github/cryptoeconomicslab/plasma-chamber/badge.svg?branch=master)](https://coveralls.io/github/cryptoeconomicslab/plasma-chamber?branch=master)

**This is experimental software, don't run in production.**

## Overview

Plasma is a 2nd layer scaling solution focusing on transaction's throughput per second scaling rather than quick finality. Plasma isn't EVM scaling solution but Ethereum security inheritance solution to UTXO transaction, In other words, it aims to give a perfect fund safety, a transaction compresssion, and no guarantee of stability. We often apply Plasma toward several kinds of dapps, like games, asset exchanges, etc. But it requires a team to employee rare and talented Plasma researchers, and so very careful security analysis is needed for each domain specific Plasma. This causes duplicated research for each project, and security insights wouldn't be shared enough. Our solution is coined "Plasma Chamber", it generates a specific Plasma implementation from Plasma specific language. It's a kind of extension of Plasma Cash, but support more complex transaction without security downside.

## Plasma Spec

Simple exit game, Plasma Fast Finality, Checkpoint and Custom Transaction.
https://github.com/cryptoeconomicslab/plasma-chamber/wiki

## Packages

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

# Plasma Chamber

[![Build Status](https://travis-ci.org/cryptoeconomicslab/plasma-chamber.svg?branch=master)](https://travis-ci.org/cryptoeconomicslab/plasma-chamber)

[![Coverage Status](https://coveralls.io/repos/github/cryptoeconomicslab/plasma-chamber/badge.svg?branch=master)](https://coveralls.io/github/cryptoeconomicslab/plasma-chamber?branch=master)

**This is experimental software, don't run in production.**

## Overview

Plasma is a 2nd layer scaling solution focusing on transaction's throughput per second scaling rather than quick finality. Plasma isn't EVM scaling solution but Ethereum security inheritance solution to UTXO transaction, In other words, it aims to give a perfect fund safety, a transaction compresssion, and no guarantee of stability. We often apply Plasma toward several kinds of dapps, like games, asset exchanges, etc. But it requires a team to employee rare and talented Plasma researchers, and so very careful security analysis is needed for each domain specific Plasma. This causes duplicated research for each project, and security insights wouldn't be shared enough. Our solution is coined "Plasma Chamber", it generates a specific Plasma implementation from Plasma specific language. It's a kind of extension of Plasma Cash, but support more complex transaction without security downside.


## Folder Structure

### core
The core module of Plasma.
The definition of Transaction and Block.
Utilities for Plasma core logic.

### rootchain
Solidity contract for deposit, submit, exit, challenge, withdraw and verification of application specific state transition.

### childchain
Child chain implementation using the core module.
Collect transactions, verify these, generate a block and submit.

### wallet
Wallet implementation.
Responsibilities of wallet are calculating UTXOs,
the interface of some methods for root chain(deposit, startExit, and challenge), and history verification.

## Development

### Install

```
git clone https://github.com/cryptoeconomicslab/plasma-chamber.git
cd plasma-chamber
mkdir .db
yarn
yarn bootstrap
yarn build
```

### Test

Run all tests.

```
yarn build //if you've been back from long vacation, because test runs for built sources :)
yarn test
```

### Test run


Launch child chain.

```
yarn run start
```

You can use child chain's JSON RPC from a sample app.

https://github.com/cryptoeconomicslab/plasma-sample-app


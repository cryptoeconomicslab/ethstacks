import {
  ChamberWallet,
  JsonRpcClient,
  PlasmaClient,
  WalletMQTTClient
} from '@layer2/wallet'
import { FileStorage } from './storage'
import program from 'commander'
import fs from 'fs'
import path from 'path'
import { utils } from 'ethers'

function getPrivateKey(): string {
  const privateKey = process.env.PRIVATE_KEY
  if (privateKey) {
    return privateKey
  } else {
    throw new Error('private key nor defined')
  }
}

const childChainEndpoint =
  process.env.CHILDCHAIN_ENDPOINT || 'http://localhost:3000'
const jsonRpcClient = new JsonRpcClient(childChainEndpoint)
const client = new PlasmaClient(
  jsonRpcClient,
  new WalletMQTTClient(
    process.env.CHILDCHAIN_PUBSUB_ENDPOINT || childChainEndpoint
  )
)
const privateKey = getPrivateKey()
const address = utils.computeAddress(privateKey)
const options = {
  // kovan
  // initialBlock: 10000000,
  initialBlock: process.env.INITIAL_BLOCK || 1,
  interval: 10000,
  confirmation: process.env.CONFIRMATION || 0,
  OwnershipPredicate: '0x9FBDa871d559710256a2502A2517b794B482Db40'
}
const basePath = path.join(__dirname, './.clidb')
const persnalPath = path.join(basePath, address)
if (!fs.existsSync(basePath)) {
  fs.mkdirSync(basePath)
}
if (!fs.existsSync(persnalPath)) {
  fs.mkdirSync(persnalPath)
}
const storage = new FileStorage(persnalPath)
const wallet = ChamberWallet.createWalletWithPrivateKey(
  client,
  process.env.ROOTCHAIN_ENDPOINT || 'http://127.0.0.1:8545',
  process.env.ROOTCHAIN_ADDRESS || '0xb9A219631Aed55eBC3D998f17C3840B7eC39C0cc',
  storage,
  privateKey,
  options
)

program.version('0.0.37').parse(process.argv)

program.command('balance').action(async function(options) {
  await balance()
})

program
  .command('deposit')
  .option('-v, --value <value>', 'amount to deposit')
  .action(async function(options) {
    await deposit(options.value)
    console.log('finished')
  })

program
  .command('transfer')
  .option('-t, --to <toAddress>', 'to address')
  .option('-v, --value <value>', 'amount to transfer')
  .action(async function(options) {
    await transfer(options.to, options.value)
    console.log('finished')
  })

program.command('merge').action(async function(options) {
  await merge()
})

program.parse(process.argv)

async function deposit(amount: string) {
  await wallet.init()
  console.log('wallet initialized')
  const result = await wallet.deposit(amount)
  console.log(result)
  await waitUpdate()
  const balanceResult = await wallet.getBalance()
  console.log('balance=', balanceResult.toNumber())
  finalize()
}

async function transfer(to: string, amount: string) {
  console.log(to, amount)
  await wallet.init()
  console.log('wallet initialized')
  await wallet.syncChildChain()
  console.log('wallet synced')
  const result = await wallet.transfer(to, 0, amount)
  console.log(result)
  console.log(`transfered ${amount} GWEI to ${to}.`)
  await waitUpdate()
  const balanceResult = await wallet.getBalance()
  console.log('balance=', balanceResult.toNumber())
  finalize()
}

async function balance() {
  wallet.on('updated', async e => {
    const result = await e.wallet.getBalance()
    console.log('balance=', result.toNumber())
  })
  await wallet.init()
  console.log('wallet initialized')
  await wallet.syncChildChain()
  console.log('wallet synced')
  const result = await wallet.getBalance()
  console.log('balance=', result.toNumber())
}

async function waitUpdate() {
  return new Promise(resolve => {
    const timeout = setTimeout(() => {
      resolve(wallet)
    }, 15000)
    wallet.on('updated', async e => {
      clearTimeout(timeout)
      resolve(e.wallet)
    })
  })
}

async function waitSent() {
  return new Promise(resolve => {
    wallet.on('send', async e => {
      resolve(e.wallet)
    })
  })
}

async function merge() {
  await wallet.init()
  console.log('wallet initialized')
  const result = await wallet.merge()
  console.log(result)
  finalize()
}

function finalize() {
  console.log('finalize')
  wallet.cancelPolling()
  process.exit(0)
}

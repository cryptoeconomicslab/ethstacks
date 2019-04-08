import {
  ChamberWallet,
  JsonRpcClient,
  PlasmaClient,
  WalletMQTTClient
} from '@layer2/wallet'
import { FileStorage } from './storage'
import fs from 'fs'
import path from 'path'
import { utils } from 'ethers'

function getPrivateKey(): string {
  const privateKey = process.env.PRIVATE_KEY
  if(privateKey) {
    return privateKey
  } else {
    throw new Error('private key nor defined')
  }
}

const childChainEndpoint = process.env.CHILDCHAIN_ENDPOINT || 'http://localhost:3000'
const jsonRpcClient = new JsonRpcClient(childChainEndpoint)
const client = new PlasmaClient(jsonRpcClient, new WalletMQTTClient(process.env.CHILDCHAIN_PUBSUB_ENDPOINT || childChainEndpoint))
const privateKey = getPrivateKey()
const address = utils.computeAddress(privateKey)
const options = {
  // kovan
  // initialBlock: 10000000,
  initialBlock: process.env.INITIAL_BLOCK || 1,
  interval: 20000,
  confirmation: process.env.CONFIRMATION || 0
}
const basePath = path.join(__dirname, './.clidb', address)
if (!fs.existsSync(basePath)) {
  fs.mkdirSync(basePath);
}
const storage = new FileStorage(basePath)
const wallet = ChamberWallet.createWalletWithPrivateKey(
  client,
  process.env.ROOTCHAIN_ENDPOINT || 'http://127.0.0.1:8545',
  process.env.ROOTCHAIN_ADDRESS || '0xeec918d74c746167564401103096D45BbD494B74',
  storage,
  privateKey,
  options
)

const cmd = process.argv[2]

if(cmd) {
  if(cmd == 'balance') {
    balance().then(() => {
      console.log('finished')
    })
  }else if(cmd == 'deposit') {
    deposit().then(() => {
      console.log('finished')
    })
  }else if(cmd == 'transfer') {
    const to = process.argv[3]
    transfer(to, '100').then(() => {
      console.log('finished')
    })
  }
}

async function deposit() {
  await wallet.init()
  console.log('wallet initialized')
  const result = await wallet.deposit('1.0')
  console.log(result)
}

async function transfer(to: string, amount: string) {
  await wallet.init()
  console.log('wallet initialized')
  await wallet.syncChildChain()
  console.log('wallet synced')
  await wallet.transfer(to, 0, amount)
  console.log(`transfered ${amount} GWEI to ${to}.`)
  wallet.on('send', async (e) => {
    const result = await wallet.getBalance()
    console.log('sent')
    console.log(result.toNumber())
  })
}

async function balance() {
  wallet.on('updated', async (e) => {
    const result = await e.wallet.getBalance()
    console.log(result.toNumber())
  })
  await wallet.init()
  console.log('wallet initialized')
  await wallet.syncChildChain()
  console.log('wallet synced')
  const result = await wallet.getBalance()
  console.log(result.toNumber())
}

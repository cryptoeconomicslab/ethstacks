const path = require('path')
require('dotenv').config({path: path.resolve(process.cwd(), './test/.env.test')})
import { describe, it } from "mocha"
import WalletFactory from '../src/factory'
import { assert } from "chai"

const privateKey:string|undefined = process.env.PRIVATE_KEY || ''

describe('WalletFactory', () => {
  it('should create wallet on NodeJS', async () => {
    try {
      const factory = new WalletFactory(
        process.env.CHILDCHAIN_ENDPOINT,
        process.env.CHILDCHAIN_PUBSUB_ENDPOINT,
        0,
        1,
        process.env.OWNERSHIP_PREDICATE || '',
        process.env.ROOTCHAIN_ENDPOINT || '',
        process.env.ROOTCHAIN_ADDRESS || ''
      );
      let wallet = await factory.createWallet({privateKey: privateKey})
      assert.equal(!!wallet, true)
    } catch(e) { 
      throw new Error(e)
    }
  })
})
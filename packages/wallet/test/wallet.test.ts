import { describe, it } from "mocha"
import {
  ChamberWallet
} from '../src'
import {
  INetworkClient,
  IPubsubClient,
  PlasmaClient,
  SubscribeHandler
} from '../src/client'

import { assert } from "chai"
import { constants, utils } from "ethers"
import { MockStorage } from "../src/storage/MockStorage";

class MockNetworkClient implements INetworkClient {
  request(methodName: string, args: any) {
    return Promise.resolve({})
  }
}

class MockPubsubClient implements IPubsubClient {
  publish(topic: string, message: string) {
    return true
  }
  subscribe(
    topic: string,
    event: SubscribeHandler
  ): void {
  }
  unsubscribe(
    topic: string,
    handler: SubscribeHandler
  ): void {
  }
}


describe('ChamberWallet', () => {

  const AlicePrivateKey = '0xe88e7cda6f7fae195d0dcda7ccb8d733b8e6bb9bd0bc4845e1093369b5dc2257'
  const AliceAddress = utils.computeAddress(AlicePrivateKey)
  const ContractAddress = '0xfb88de099e13c3ed21f80a7a1e49f8caecf10df6'
  const mockClient = new MockNetworkClient()
  const client = new PlasmaClient(mockClient, new MockPubsubClient())
  let storage = new MockStorage()

  beforeEach(() => {
    storage = new MockStorage()
  })

  it('should create wallet', () => {
    const wallet = ChamberWallet.createWalletWithPrivateKey(
      client,
      'http://127.0.0.1:8545',
      ContractAddress,
      storage,
      AlicePrivateKey,
    )
    assert.equal(wallet.getBalance().toNumber(), 0)
  })


  describe('handleDeposit', () => {

    const wallet = ChamberWallet.createWalletWithPrivateKey(
      client,
      'http://127.0.0.1:8545',
      ContractAddress,
      storage,
      AlicePrivateKey,
    )

    it('should handleDeposit', () => {
      wallet.handleDeposit(
        AliceAddress,
        utils.bigNumberify(0),
        utils.bigNumberify(0),
        utils.bigNumberify(10000000),
        utils.bigNumberify(2)
      )
      assert.equal(wallet.getBalance().toNumber(), 10000000)
    })
    
  })

  describe('getExits', () => {

    const wallet = ChamberWallet.createWalletWithPrivateKey(
      client,
      'http://127.0.0.1:8545',
      ContractAddress,
      storage,
      AlicePrivateKey,
    )

    it('should getExit', () => {
      const blkNum = utils.bigNumberify(2)
      const depositTx = wallet.handleDeposit(
        AliceAddress,
        utils.bigNumberify(0),
        utils.bigNumberify(0),
        utils.bigNumberify(10000000),
        blkNum
      )

      wallet.handleExit(
        utils.bigNumberify(1),
        depositTx.getOutput().withBlkNum(blkNum).hash(),
        utils.bigNumberify(1520700),
        utils.bigNumberify(10000000)
      )
      
      assert.equal(wallet.getExits().length, 1)
    })
    
  })
  
  describe('transfer', () => {

    const wallet = ChamberWallet.createWalletWithPrivateKey(
      client,
      'http://127.0.0.1:8545',
      ContractAddress,
      storage,
      AlicePrivateKey,
    )

    it('should transfer', async () => {
      wallet.handleDeposit(
        AliceAddress,
        utils.bigNumberify(0),
        utils.bigNumberify(0),
        utils.bigNumberify(10000000),
        utils.bigNumberify(2)
      )
      await wallet.transfer(
        AliceAddress,
        1,
        '2000000'
      )
    })
    
  })
  

})

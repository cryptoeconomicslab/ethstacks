import { describe, it } from 'mocha'
import {
  INetworkClient,
  IPubsubClient,
  PlasmaClient,
  SubscribeHandler
} from '../../src/client'
import { assert } from 'chai'
import { utils } from 'ethers'
import { ChamberOk, ChamberError } from '@layer2/core'
import { Block } from '@layer2/core/src'

class MockNetworkClient implements INetworkClient {
  request(methodName: string, args: any) {
    switch (methodName) {
      case 'getBlock':
        const block = new Block(1)
        block.setBlockNumber(args[0])
        return Promise.resolve({ result: block.serialize() })
      default:
        return Promise.resolve({})
    }
  }
}

class MockPubsubClient implements IPubsubClient {
  publish(topic: string, message: string) {
    return true
  }
  subscribe(topic: string, event: SubscribeHandler): void {}
  unsubscribe(topic: string, handler: SubscribeHandler): void {}
}

describe('PlasmaClient', () => {
  const mockClient = new MockNetworkClient()
  const client = new PlasmaClient(mockClient, new MockPubsubClient())

  beforeEach(() => {})

  it('deserialize ok', () => {
    const ok = new ChamberOk('ok')
    const okString = PlasmaClient.deserialize<string>(
      { result: ok.ok() },
      result => result
    )
    assert.equal(okString.ok(), 'ok')
  })

  it('deserialize error', () => {
    const error = new ChamberError(100, 'error')
    const deserializedError = PlasmaClient.deserialize<string>(
      error.serialize(),
      result => result
    )
    assert.isTrue(deserializedError.isError())
    assert.equal(deserializedError.error().code, 100)
  })

  it('getBlock', async () => {
    const block = await client.getBlock(10)
    assert.isTrue(block.isOk())
    assert.equal(block.ok().number, 10)
  })
})

import { describe, it } from 'mocha'
import {
  EventWatcher,
  DefaultEventWatcherStorage,
  IETHEventAdaptor
} from '../src'

import { assert } from 'chai'
import { utils, providers } from 'ethers'

export class MockEventAdaptor implements IETHEventAdaptor {
  parseLog(e: providers.Log): utils.LogDescription {
    return {
      name: 'mock',
      signature: '',
      decode: () => {},
      topic: '',
      values: []
    }
  }

  async getLatestBlockNumber() {
    return 1
  }

  async getLogs(
    fromBlockNumber: number,
    blockNumber: number,
    confirmation: number
  ): Promise<providers.Log[]> {
    return [
      {
        address: '',
        transactionHash: 'mock-transactionHash',
        topics: [],
        data: ''
      }
    ]
  }
}

describe('EventWatcher', () => {
  let eventWatcher: EventWatcher
  let storage: DefaultEventWatcherStorage

  beforeEach(() => {
    storage = new DefaultEventWatcherStorage()
    eventWatcher = new EventWatcher(new MockEventAdaptor(), storage, {
      initialBlock: 1,
      interval: 10000,
      confirmation: 0
    })
  })

  it('should success to addEvent', done => {
    let handlerCalled = false
    eventWatcher.addEvent('mock', e => {
      assert.equal(e.name, 'mock')
      handlerCalled = true
    })
    eventWatcher.polling(0, 1, () => {
      assert.isTrue(handlerCalled)
      assert.isTrue(storage.getSeen('mock-transactionHash'))
      done()
    })
  })
})

import { describe, it } from 'mocha'
import { SegmentHistoryManager } from '../src/history/SegmentHistory'
import { MockStorage } from '../src/storage/MockStorage'
import {
  INetworkClient,
  IPubsubClient,
  PlasmaClient,
  SubscribeHandler
} from '../src/client'
import { assert } from 'chai'
import { constants, utils } from 'ethers'
import { createTransfer, AlicePrivateKey, BobPrivateKey } from './TestUtil'
import {
  PredicatesManager,
  Segment,
  Block,
  OwnershipPredicate
} from '@layer2/core'
import { WaitingBlockWrapper } from '../src/models'

class MockNetworkClient implements INetworkClient {
  request(methodName: string, args: any) {
    return Promise.resolve({})
  }
}

class MockPubsubClient implements IPubsubClient {
  publish(topic: string, message: string) {
    return true
  }
  subscribe(topic: string, event: SubscribeHandler): void {}
  unsubscribe(topic: string, handler: SubscribeHandler): void {}
}

describe('SegmentHistoryManager', () => {
  let storage = new MockStorage()
  const mockClient = new MockNetworkClient()
  const client = new PlasmaClient(mockClient, new MockPubsubClient())
  const AliceAddress = utils.computeAddress(AlicePrivateKey)
  const BobAddress = utils.computeAddress(BobPrivateKey)
  const predicate = constants.AddressZero
  const predicateManager = new PredicatesManager()
  predicateManager.addPredicate(predicate, 'OwnershipPredicate')
  const segment1 = Segment.ETH(
    utils.bigNumberify(0),
    utils.bigNumberify(1000000)
  )
  const segment2 = Segment.ETH(
    utils.bigNumberify(1000000),
    utils.bigNumberify(2000000)
  )
  const blkNum3 = utils.bigNumberify(3)
  const blkNum5 = utils.bigNumberify(5)
  const blkNum6 = utils.bigNumberify(6)
  const blkNum8 = utils.bigNumberify(8)
  const blkNum10 = utils.bigNumberify(10)
  const block6 = new Block(1)
  block6.setBlockNumber(6)
  const block8 = new Block(1)
  block8.setBlockNumber(8)
  const block10 = new Block(1)
  block10.setBlockNumber(10)
  const depositTx1 = OwnershipPredicate.create(
    segment1,
    blkNum3,
    predicate,
    AliceAddress
  )
  const depositTx2 = OwnershipPredicate.create(
    segment2,
    blkNum5,
    predicate,
    BobAddress
  )
  const tx61 = createTransfer(
    AlicePrivateKey,
    predicate,
    segment1,
    blkNum6,
    BobAddress
  )
  const tx62 = createTransfer(
    BobPrivateKey,
    predicate,
    segment2,
    blkNum6,
    AliceAddress
  )
  block6.appendTx(tx61)
  block6.appendTx(tx62)

  const tx82 = createTransfer(
    AlicePrivateKey,
    predicate,
    segment2,
    blkNum8,
    BobAddress
  )
  block8.appendTx(tx82)

  const tx101 = createTransfer(
    BobPrivateKey,
    predicate,
    segment1,
    blkNum10,
    AliceAddress
  )
  const tx102 = createTransfer(
    AlicePrivateKey,
    predicate,
    segment2,
    blkNum10,
    BobAddress
  )
  block10.appendTx(tx101)
  block10.appendTx(tx102)
  block6.setSuperRoot(constants.HashZero)
  block8.setSuperRoot(constants.HashZero)
  block10.setSuperRoot(constants.HashZero)

  beforeEach(() => {
    storage = new MockStorage()
  })

  it('should verify history', async () => {
    const segmentHistoryManager = new SegmentHistoryManager(
      storage,
      client,
      predicateManager
    )
    segmentHistoryManager.appendDeposit(depositTx1)
    segmentHistoryManager.appendDeposit(depositTx2)
    segmentHistoryManager.appendBlockHeader(
      new WaitingBlockWrapper(blkNum6, block6.getRoot())
    )
    segmentHistoryManager.appendBlockHeader(
      new WaitingBlockWrapper(blkNum8, block8.getRoot())
    )
    segmentHistoryManager.appendBlockHeader(
      new WaitingBlockWrapper(blkNum10, block10.getRoot())
    )

    segmentHistoryManager.init('key', segment1)
    // check inclusion
    await segmentHistoryManager.appendSegmentedBlock(
      'key',
      block6.getSegmentedBlock(segment1)
    )
    // check exclusion
    await segmentHistoryManager.appendSegmentedBlock(
      'key',
      block8.getSegmentedBlock(segment1)
    )
    // check inclusion
    await segmentHistoryManager.appendSegmentedBlock(
      'key',
      block10.getSegmentedBlock(segment1)
    )

    const utxo = await segmentHistoryManager.verifyHistory('key')
    assert.equal(utxo[0].getBlkNum().toNumber(), blkNum10.toNumber())
    assert.deepEqual(utxo[0].getOwner(), AliceAddress)
    assert.equal(
      utxo[0]
        .getSegment()
        .toBigNumber()
        .toNumber(),
      segment1.toBigNumber().toNumber()
    )
  })
})

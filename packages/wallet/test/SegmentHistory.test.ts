import { describe, it } from "mocha"
import {
  SegmentHistoryManager
} from '../src/history/SegmentHistory'
import { MockStorage } from "../src/storage/MockStorage";
import {
  INetworkClient,
  IPubsubClient,
  PlasmaClient,
  SubscribeHandler
} from '../src/client'
import { assert } from "chai"
import { constants, utils } from "ethers"
import { DepositTransaction, Segment, SignedTransaction, Block, SplitTransaction } from "@layer2/core";
import { WaitingBlockWrapper } from "../src/models";
import { BigNumber } from 'ethers/utils';

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

describe('SegmentHistoryManager', () => {

  let storage = new MockStorage()
  const mockClient = new MockNetworkClient()
  const client = new PlasmaClient(mockClient, new MockPubsubClient())
  const AlicePrivateKey = '0xe88e7cda6f7fae195d0dcda7ccb8d733b8e6bb9bd0bc4845e1093369b5dc2257'
  const BobPrivateKey = '0xae6ae8e5ccbfb04590405997ee2d52d2b330726137b875053c36d94e974d162f'
  const AliceAddress = utils.computeAddress(AlicePrivateKey)
  const BobAddress = utils.computeAddress(BobPrivateKey)
  const segment1 = Segment.ETH(utils.bigNumberify(0), utils.bigNumberify(1000000))
  const segment2 = Segment.ETH(utils.bigNumberify(1000000), utils.bigNumberify(2000000))
  const blkNum3 = utils.bigNumberify(3)
  const blkNum5 = utils.bigNumberify(5)
  const blkNum6 = utils.bigNumberify(6)
  const blkNum8 = utils.bigNumberify(8)
  const block6 = new Block(6)
  block6.setBlockNumber(6)
  const block8 = new Block(8)
  block8.setBlockNumber(8)
  const depositTx1 = new DepositTransaction(AliceAddress, segment1)
  const depositTx2 = new DepositTransaction(BobAddress, segment2)
  const tx61 = createTransfer(
    AlicePrivateKey, AliceAddress, segment1, blkNum3, BobAddress)
  const tx62 = createTransfer(BobPrivateKey, BobAddress, segment2, blkNum5, AliceAddress)
  block6.appendTx(tx61)
  block6.appendTx(tx62)
  const tx81 = createTransfer(
    AlicePrivateKey, AliceAddress, segment2, blkNum6, BobAddress)
  const tx82 = createTransfer(BobPrivateKey, BobAddress, segment1, blkNum6, AliceAddress)
  block8.appendTx(tx81)
  block8.appendTx(tx82)
  block6.setSuperRoot(constants.HashZero)
  block8.setSuperRoot(constants.HashZero)

  beforeEach(() => {
    storage = new MockStorage()
  })

  it('should verify history', async () => {
    const segmentHistoryManager = new SegmentHistoryManager(storage, client)
    segmentHistoryManager.appendDeposit(blkNum3.toNumber(), depositTx1)
    segmentHistoryManager.appendDeposit(blkNum5.toNumber(), depositTx2)
    segmentHistoryManager.appendBlockHeader(new WaitingBlockWrapper(
      blkNum6,
      block6.getRoot()
    ))
    segmentHistoryManager.appendBlockHeader(new WaitingBlockWrapper(
      blkNum8,
      block8.getRoot()
    ))
    segmentHistoryManager.init('key', segment1)
    await segmentHistoryManager.appendSegmentedBlock("key", block6.getSegmentedBlock(segment1))
    await segmentHistoryManager.appendSegmentedBlock("key", block8.getSegmentedBlock(segment1))

    const utxo = await segmentHistoryManager.verifyHistory('key')
    assert.equal(utxo[0].getBlkNum().toNumber(), blkNum8.toNumber())
    assert.deepEqual(utxo[0].getOwners(), [AliceAddress])
    assert.equal(utxo[0].getSegment(0).toBigNumber().toNumber(), segment1.toBigNumber().toNumber())
  })

})

function createTransfer(privKey: string, from: string, seg: Segment, blkNum: BigNumber, to: string) {
  const tx= new SignedTransaction([SplitTransaction.Transfer(from, seg, blkNum, to)])
  tx.sign(privKey)
  return tx
}

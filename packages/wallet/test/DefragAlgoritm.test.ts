import { describe, it } from "mocha"
import {
  DefragAlgorithm
} from '../src/storategy/defrag'
import { Block, OwnershipPredicate, PredicatesManager, Segment, SignedTransaction } from "@layer2/core"
import { assert } from "chai"
import { constants, utils } from "ethers"
import BigNumber = utils.BigNumber

describe('DefragAlgorithm', () => {

  const AlicePrivateKey = '0xe88e7cda6f7fae195d0dcda7ccb8d733b8e6bb9bd0bc4845e1093369b5dc2257'
  const BobPrivateKey = '0xae6ae8e5ccbfb04590405997ee2d52d2b330726137b875053c36d94e974d162f'
  const AliceAddress = utils.computeAddress(AlicePrivateKey)
  const BobAddress = utils.computeAddress(BobPrivateKey)
  const predicate = constants.AddressZero
  const predicateManager = new PredicatesManager()
  predicateManager.addPredicate(predicate, 'OwnershipPredicate')
  const segment1 = Segment.ETH(utils.bigNumberify(0), utils.bigNumberify(1000000))
  const segment2 = Segment.ETH(utils.bigNumberify(1000000), utils.bigNumberify(2000000))
  const segment3 = Segment.ETH(utils.bigNumberify(2000000), utils.bigNumberify(3000000))
  const blkNum4 = utils.bigNumberify(4)
  const blkNum6 = utils.bigNumberify(6)
  const blkNum8 = utils.bigNumberify(8)
  const block6 = new Block(6)
  block6.setBlockNumber(6)
  const block8 = new Block(8)
  block8.setBlockNumber(8)
  const tx1 = createTransfer(BobPrivateKey, predicate, segment1, blkNum4, AliceAddress)
  const tx2 = createTransfer(BobPrivateKey, predicate, segment2, blkNum4, AliceAddress)
  const tx3 = createTransfer(BobPrivateKey, predicate, segment3, blkNum4, AliceAddress)
  block6.appendTx(tx1)
  block6.appendTx(tx2)
  block6.appendTx(tx3)
  block6.setSuperRoot(constants.HashZero)

  beforeEach(() => {
  })

  it('searchMergable', async () => {
    const signedTx1 = block6.getSignedTransactionWithProof(tx1.hash())[0]
    const signedTx2 = block6.getSignedTransactionWithProof(tx2.hash())[0]
    const signedTx3 = block6.getSignedTransactionWithProof(tx3.hash())[0]
    const mergable = DefragAlgorithm.searchMergable([signedTx1, signedTx2, signedTx3], utils.bigNumberify(10), predicate, AliceAddress)
    assert.isNotNull(mergable)
    if(mergable) {
      assert.equal(mergable.getSegment().start.toString(), segment2.start.toString())
      assert.equal(mergable.getSegment().end.toString(), segment3.end.toString())
    }
  })

  it('makeSwapRequest', async () => {
    const signedTx1 = block6.getSignedTransactionWithProof(tx1.hash())[0]
    const signedTx3 = block6.getSignedTransactionWithProof(tx3.hash())[0]
    const swapRequest = DefragAlgorithm.makeSwapRequest(
      [signedTx1, signedTx3])
    assert.isNotNull(swapRequest)
    if(swapRequest) {
      assert.equal(swapRequest.segment.start.toString(), segment3.start.toString())
      assert.equal(swapRequest.getNeighbor().start.toString(), segment1.start.toString())
    }
  })

})

function createTransfer(privKey: string, predicate: string, seg: Segment, blkNum: BigNumber, to: string) {
  const stateUpdate = OwnershipPredicate.create(seg, blkNum, predicate, to)
  const tx= new SignedTransaction([stateUpdate])
  tx.sign(privKey)
  return tx
}

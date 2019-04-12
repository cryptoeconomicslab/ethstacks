import { describe, it } from "mocha"
import {
  TransferAlgorithm
} from '../src/storategy/transfer'
import { Block, OwnershipPredicate, PredicatesManager, Segment, SignedTransaction } from "@layer2/core"
import { assert } from "chai"
import { constants, utils } from "ethers"
import BigNumber = utils.BigNumber

describe('TransferAlgorithm', () => {

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

  it('searchUtxo', async () => {
    const signedTx1 = block6.getSignedTransactionWithProof(tx1.hash())[0]
    const signedTx2 = block6.getSignedTransactionWithProof(tx2.hash())[0]
    const signedTx3 = block6.getSignedTransactionWithProof(tx3.hash())[0]
    const transferTx = TransferAlgorithm.searchUtxo(
      [signedTx1, signedTx2, signedTx3],
      10,
      predicate,
      AliceAddress,
      0,
      utils.bigNumberify(100),
      BobAddress,
      utils.bigNumberify(10))
    assert.isNotNull(transferTx)
    if(transferTx) {
      assert.equal(transferTx.getStateUpdate(0).getSegment().getAmount().toNumber(), 100)
      const transferSegment = transferTx.getStateUpdate(0).getSegment()
      assert.isTrue(segment3.isContain(transferSegment))
    }
  })

})

function createTransfer(privKey: string, predicate: string, seg: Segment, blkNum: BigNumber, to: string) {
  const stateUpdate = OwnershipPredicate.create(seg, blkNum, predicate, to)
  const tx= new SignedTransaction([stateUpdate])
  tx.sign(privKey)
  return tx
}

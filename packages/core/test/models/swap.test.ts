import { describe, it } from 'mocha'
import { SwapRequest } from '../../src/models/swap'
import { Segment } from '../../src/segment'
import { assert } from 'chai'
import { constants, utils } from 'ethers'
import { AlicePrivateKey, BobPrivateKey } from '../testdata'
import { OwnershipPredicate } from '../../src/StateUpdate'
import { DecoderUtility } from '../../src/utils/Decoder'

describe('SwapRequest', () => {
  const AliceAddress = utils.computeAddress(AlicePrivateKey)
  const BobAddress = utils.computeAddress(BobPrivateKey)
  const blkNum = constants.One
  const segment1 = Segment.ETH(
    utils.bigNumberify('1000000'),
    utils.bigNumberify('2000000')
  )
  const segment2 = Segment.ETH(
    utils.bigNumberify('2000000'),
    utils.bigNumberify('3000000')
  )
  const segment3 = Segment.ETH(
    utils.bigNumberify('4000000'),
    utils.bigNumberify('5000000')
  )
  const targetBlock = utils.bigNumberify(0)
  const predicate = AliceAddress

  it('check', () => {
    const swapRequest = new SwapRequest(
      AliceAddress,
      blkNum,
      segment3,
      blkNum,
      segment1
    )
    assert.isTrue(swapRequest.check(segment2))
  })

  it('getSignedSwapTx', () => {
    const swapRequest = new SwapRequest(
      AliceAddress,
      blkNum,
      segment1,
      blkNum,
      segment3
    )
    swapRequest.setTarget(
      OwnershipPredicate.create(segment2, targetBlock, predicate, BobAddress)
    )
    const tx = swapRequest.getSignedSwapTx(targetBlock, predicate)
    assert.notEqual(tx, undefined)
    if (tx) {
      const swapTx1 = tx.getStateUpdate(0)
      const swapTx2 = tx.getStateUpdate(1)
      assert.equal(DecoderUtility.getAddress(swapTx1.state), AliceAddress)
      assert.equal(DecoderUtility.getAddress(swapTx2.state), BobAddress)
    }
  })
})

import { describe, it } from 'mocha'
import {
  Segment,
  StateUpdate,
  PredicatesManager,
  OwnershipPredicate
} from '../src'
import { DecoderUtility } from '../src/utils/Decoder'
import { assert } from 'chai'
import { utils } from 'ethers'
import { AlicePrivateKey, BobPrivateKey } from './testdata'

describe('StateUpdate', () => {
  const AliceAddress = utils.computeAddress(AlicePrivateKey)
  const BobAddress = utils.computeAddress(BobPrivateKey)
  const blkNum3 = utils.bigNumberify('3')
  const blkNum4 = utils.bigNumberify('4')
  const segment = Segment.ETH(
    utils.bigNumberify('2000000'),
    utils.bigNumberify('3000000')
  )
  const subSegment = Segment.ETH(
    utils.bigNumberify('2000000'),
    utils.bigNumberify('2600000')
  )

  const predicate = AliceAddress
  const predicateManager = new PredicatesManager()
  predicateManager.addPredicate(predicate, 'OwnershipPredicate')

  it('serialize and deserialize', () => {
    const stateUpdate = OwnershipPredicate.create(
      segment,
      blkNum3,
      predicate,
      BobAddress
    )
    const encoded = stateUpdate.serialize()
    const decoded = StateUpdate.deserialize(encoded)
    assert.equal(DecoderUtility.getAddress(decoded.state), BobAddress)
    assert.equal(
      decoded
        .getSegment()
        .toBigNumber()
        .toHexString(),
      segment.toBigNumber().toHexString()
    )
  })

  it('getRemainingState', () => {
    const stateUpdate1 = OwnershipPredicate.create(
      segment,
      blkNum3,
      predicate,
      BobAddress
    )
    const stateUpdate2 = OwnershipPredicate.create(
      subSegment,
      blkNum4,
      predicate,
      BobAddress
    )
    const left = stateUpdate1.getRemainingState(stateUpdate2)
    assert.equal(left.length, 1)
    assert.equal(left[0].getSegment().start.toString(), '2600000')
    assert.equal(left[0].getSegment().end.toString(), '3000000')
  })
})

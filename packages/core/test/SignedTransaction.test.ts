import { describe, it } from 'mocha'
import {
  Segment,
  SignedTransaction,
  PredicatesManager,
  OwnershipPredicate,
  PaymentChannelPredicate
} from '../src'
import { assert } from 'chai'
import { utils } from 'ethers'
import { AlicePrivateKey, BobPrivateKey } from './testdata'

describe('SignedTransaction', () => {
  const AliceAddress = utils.computeAddress(AlicePrivateKey)
  const BobAddress = utils.computeAddress(BobPrivateKey)
  const segment = Segment.ETH(
    utils.bigNumberify('2000000'),
    utils.bigNumberify('3000000')
  )
  const blkNum = utils.bigNumberify('1')
  const splitSegment = Segment.ETH(
    utils.bigNumberify('2000000'),
    utils.bigNumberify('2600000')
  )

  const segment1 = Segment.ETH(
    utils.bigNumberify('5000000'),
    utils.bigNumberify('6000000')
  )
  const segment2 = Segment.ETH(
    utils.bigNumberify('6000000'),
    utils.bigNumberify('7000000')
  )
  const blkNum1 = utils.bigNumberify('50')
  const blkNum2 = utils.bigNumberify('52')
  const predicate = AliceAddress
  const predicateManager = new PredicatesManager()
  predicateManager.addPredicate(predicate, 'OwnershipPredicate')

  describe('SignedTransaction', () => {
    it('serialize and deserialize', () => {
      const stateUpdate = OwnershipPredicate.create(
        segment,
        blkNum,
        predicate,
        BobAddress
      )
      const signedTx = new SignedTransaction([stateUpdate])
      signedTx.sign(AlicePrivateKey)
      const serialized = signedTx.serialize()
      const deserialized = SignedTransaction.deserialize(serialized)
      assert.equal(deserialized.getTxHash(), signedTx.getTxHash())
      assert.equal(
        deserialized.getTransactionWitness(),
        signedTx.getTransactionWitness()
      )
    })

    it('getSignatures', () => {
      const stateUpdate = OwnershipPredicate.create(
        segment,
        blkNum,
        predicate,
        BobAddress
      )
      const signedTx = new SignedTransaction([stateUpdate])
      signedTx.sign(AlicePrivateKey)
      const signature = signedTx.getTransactionWitness()
      assert.equal(
        utils.recoverAddress(signedTx.hash(), signature),
        AliceAddress
      )
    })

    it('succeed to verifyDeprecation', () => {
      const stateUpdate = OwnershipPredicate.create(
        segment,
        blkNum,
        predicate,
        AliceAddress
      )
      const newStateUpdate = OwnershipPredicate.create(
        segment,
        blkNum,
        predicate,
        BobAddress
      )
      const signedTx = new SignedTransaction([newStateUpdate])
      signedTx.sign(AlicePrivateKey)
      const isVerifyDEprecation = stateUpdate.verifyDeprecation(
        signedTx.hash(),
        newStateUpdate,
        signedTx.getTransactionWitness(),
        predicateManager
      )
      assert.isTrue(isVerifyDEprecation)
    })

    it('fail to verifyDeprecation', () => {
      const stateUpdate = OwnershipPredicate.create(
        segment,
        blkNum,
        predicate,
        AliceAddress
      )
      const newStateUpdate = OwnershipPredicate.create(
        segment,
        blkNum,
        predicate,
        BobAddress
      )
      const signedTx = new SignedTransaction([newStateUpdate])
      signedTx.sign(AlicePrivateKey)
      const isVerifyDeprecation = stateUpdate.verifyDeprecation(
        signedTx.hash(),
        newStateUpdate,
        signedTx.getTransactionWitness(),
        predicateManager
      )
      assert.isTrue(isVerifyDeprecation)
    })

    it('verify swap transaction', () => {
      const swapSegment1 = Segment.ETH(
        utils.bigNumberify('5000000'),
        utils.bigNumberify('5700000')
      )
      const swapSegment2 = Segment.ETH(
        utils.bigNumberify('6000000'),
        utils.bigNumberify('7000000')
      )
      const id = utils.keccak256(
        utils.hexlify(
          utils.concat([
            utils.arrayify(swapSegment1.toBigNumber()),
            utils.arrayify(swapSegment2.toBigNumber()),
            utils.arrayify(AliceAddress),
            utils.arrayify(BobAddress)
          ])
        )
      )
      const stateUpdate1 = OwnershipPredicate.create(
        swapSegment1,
        blkNum1,
        predicate,
        AliceAddress
      )
      const stateUpdate2 = OwnershipPredicate.create(
        swapSegment2,
        blkNum1,
        predicate,
        BobAddress
      )
      const newStateUpdate1 = PaymentChannelPredicate.create(
        swapSegment1,
        blkNum2,
        predicate,
        id,
        AliceAddress,
        BobAddress,
        1
      )
      const newStateUpdate2 = PaymentChannelPredicate.create(
        swapSegment2,
        blkNum2,
        predicate,
        id,
        AliceAddress,
        BobAddress,
        2
      )
      const signedTx = new SignedTransaction([newStateUpdate1, newStateUpdate2])
      const signA = signedTx.justSign(AlicePrivateKey)
      const signB = signedTx.justSign(BobPrivateKey)
      const isVerifyDeprecation1 = stateUpdate1.verifyDeprecation(
        signedTx.hash(),
        newStateUpdate1,
        signA,
        predicateManager
      )
      const isVerifyDeprecation2 = stateUpdate2.verifyDeprecation(
        signedTx.hash(),
        newStateUpdate2,
        signB,
        predicateManager
      )
      assert.isTrue(isVerifyDeprecation1)
      assert.isTrue(isVerifyDeprecation2)
    })
  })
})

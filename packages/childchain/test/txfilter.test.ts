import { describe, it } from 'mocha'
import { assert } from 'chai'
import { constants, utils, ethers } from 'ethers'
import { TxFilter } from '../src/txfilter'
import {
  OwnershipPredicate,
  PredicatesManager,
  Segment,
  SignedTransaction
} from '@layer2/core'

describe('TxFilter', () => {
  const AlicePrivateKey =
    '0xe88e7cda6f7fae195d0dcda7ccb8d733b8e6bb9bd0bc4845e1093369b5dc2257'
  const BobPrivateKey =
    '0x855364a82b6d1405211d4b47926f4aa9fa55175ab2deaf2774e28c2881189cff'
  const AliceAddress = utils.computeAddress(AlicePrivateKey)
  const BobAddress = utils.computeAddress(BobPrivateKey)

  const predicate = AliceAddress
  const predicateManager = new PredicatesManager()
  predicateManager.addPredicate(predicate, 'OwnershipPredicate')

  const tx1 = OwnershipPredicate.create(
    Segment.ETH(
      ethers.utils.bigNumberify(0),
      ethers.utils.bigNumberify(10000000)
    ),
    ethers.utils.bigNumberify(5),
    predicate,
    BobAddress
  )
  const tx2 = OwnershipPredicate.create(
    Segment.ETH(
      ethers.utils.bigNumberify(10000000),
      ethers.utils.bigNumberify(20000000)
    ),
    ethers.utils.bigNumberify(7),
    predicate,
    BobAddress
  )
  const tx3 = OwnershipPredicate.create(
    Segment.ETH(
      ethers.utils.bigNumberify(5000000),
      ethers.utils.bigNumberify(15000000)
    ),
    ethers.utils.bigNumberify(7),
    predicate,
    BobAddress
  )

  it('should succeed to checkAndInsertTx', async () => {
    const txFilter = new TxFilter()
    const signedTx1 = new SignedTransaction([tx1])
    const signedTx2 = new SignedTransaction([tx2])
    signedTx1.sign(AlicePrivateKey)
    signedTx2.sign(AlicePrivateKey)
    assert.isTrue(txFilter.checkAndInsertTx(signedTx1).isOk())
    assert.isTrue(txFilter.checkAndInsertTx(signedTx2).isOk())
  })

  it('should fail to checkAndInsertTx', async () => {
    const txFilter = new TxFilter()
    const signedTx1 = new SignedTransaction([tx1])
    const signedTx3 = new SignedTransaction([tx3])
    signedTx1.sign(AlicePrivateKey)
    signedTx3.sign(AlicePrivateKey)
    assert.isTrue(txFilter.checkAndInsertTx(signedTx1).isOk())
    assert.isTrue(txFilter.checkAndInsertTx(signedTx3).isError())
  })
})

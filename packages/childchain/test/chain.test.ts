import { describe, it } from 'mocha'
import chai = require('chai')
import { assert } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { constants, utils, ethers } from 'ethers'
import { Chain, IChainDb } from '../src/chain'
import {
  PredicatesManager,
  Segment,
  SignedTransaction,
  OwnershipPredicate
} from '@layer2/core'

class MockChainDb implements IChainDb {
  public contains(key: string): Promise<boolean> {
    return Promise.resolve(true)
  }
  public insert(key: string, value: string): Promise<boolean> {
    return Promise.resolve(true)
  }
  public get(key: string): Promise<string> {
    return Promise.resolve('')
  }
  public delete(key: string): Promise<boolean> {
    return Promise.resolve(true)
  }
}

describe('Chain', () => {
  const AlicePrivateKey =
    '0xe88e7cda6f7fae195d0dcda7ccb8d733b8e6bb9bd0bc4845e1093369b5dc2257'
  const BobPrivateKey =
    '0x855364a82b6d1405211d4b47926f4aa9fa55175ab2deaf2774e28c2881189cff'
  const AliceAddress = utils.computeAddress(AlicePrivateKey)
  const BobAddress = utils.computeAddress(BobPrivateKey)
  const predicate = AliceAddress
  const options = {
    OwnershipPredicate: predicate
  }

  before(() => {
    chai.use(chaiAsPromised)
  })

  it('should generateBlock', async () => {
    const chain = new Chain(new MockChainDb(), options)
    const segment = Segment.ETH(
      ethers.utils.bigNumberify(0),
      ethers.utils.bigNumberify(10000000)
    )
    const depositTx = OwnershipPredicate.create(
      segment,
      ethers.utils.bigNumberify(3),
      predicate,
      AliceAddress
    )
    chain.segmentChecker.insertDepositTx(depositTx)
    const tx = OwnershipPredicate.create(
      segment,
      ethers.utils.bigNumberify(5),
      predicate,
      BobAddress
    )
    const signedTx = new SignedTransaction([tx])
    signedTx.sign(AlicePrivateKey)
    chain.appendTx(signedTx)
    const root = await chain.generateBlock()
    assert.equal(root.ok().length, 66)
  })

  it('should fail to generateBlock by no input', async () => {
    const chain = new Chain(new MockChainDb(), options)
    const tx = OwnershipPredicate.create(
      Segment.ETH(
        ethers.utils.bigNumberify(0),
        ethers.utils.bigNumberify(10000000)
      ),
      ethers.utils.bigNumberify(5),
      predicate,
      BobAddress
    )
    const signedTx = new SignedTransaction([tx])
    signedTx.sign(AlicePrivateKey)
    chain.appendTx(signedTx)
    const result = await chain.generateBlock()
    assert.isTrue(result.isError())
    assert.equal(result.error().message, 'no valid transactions')
  })

  it('should generateBlock but segment duplecated', async () => {
    const chain = new Chain(new MockChainDb(), options)
    const segment = Segment.ETH(
      ethers.utils.bigNumberify(0),
      ethers.utils.bigNumberify(10000000)
    )
    const depositTx = OwnershipPredicate.create(
      segment,
      ethers.utils.bigNumberify(5),
      predicate,
      AliceAddress
    )
    chain.segmentChecker.insertDepositTx(depositTx)

    const tx = OwnershipPredicate.create(
      segment,
      ethers.utils.bigNumberify(5),
      predicate,
      BobAddress
    )

    const signedTx = new SignedTransaction([tx])
    signedTx.sign(AlicePrivateKey)
    chain.appendTx(signedTx)
    const result = chain.appendTx(signedTx)
    assert.isTrue(result.isError())
    assert.equal(result.error().message, 'already sent')
    // segment duplecated will be occurred, but block generate root correctly
    const root = await chain.generateBlock()
    assert.equal(root.ok().length, 66)
  })
})

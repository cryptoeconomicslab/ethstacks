import { describe, it } from 'mocha'
import { ExitableRangeManager } from '../../src/utils/exitable'
import { assert } from 'chai'
import { utils } from 'ethers'

describe('ExitableRangeManager', () => {
  const bn0 = utils.bigNumberify('0')
  const bn1000000 = utils.bigNumberify('1000000')
  const bn1500000 = utils.bigNumberify('1500000')
  const bn2000000 = utils.bigNumberify('2000000')
  const bn3000000 = utils.bigNumberify('3000000')

  it('shoud be succeeded to extendRight', () => {
    const exitableRangeManager = new ExitableRangeManager()
    exitableRangeManager.extendRight(bn1000000)
    exitableRangeManager.extendRight(bn2000000)
    assert.equal(
      exitableRangeManager.getExitableEnd(bn0, bn1000000).toString(),
      bn2000000.toString()
    )
    assert.equal(
      exitableRangeManager.getExitableEnd(bn0, bn1500000).toString(),
      bn2000000.toString()
    )
    assert.equal(
      exitableRangeManager.getExitableEnd(bn0, bn2000000).toString(),
      bn2000000.toString()
    )
  })

  it('shoud be succeeded to remove left', () => {
    const exitableRangeManager = new ExitableRangeManager()
    exitableRangeManager.extendRight(bn1000000)
    exitableRangeManager.extendRight(bn2000000)
    exitableRangeManager.extendRight(bn3000000)
    exitableRangeManager.remove(bn0, bn0, bn1000000)
    assert.equal(
      exitableRangeManager.getExitableEnd(bn1000000, bn1500000).toString(),
      bn3000000.toString()
    )
    assert.throws(() => {
      exitableRangeManager.getExitableEnd(bn0, bn1000000)
    }, 'exitable ranges not found')
  })

  it('shoud be succeeded to remove right', () => {
    const exitableRangeManager = new ExitableRangeManager()
    exitableRangeManager.extendRight(bn1000000)
    exitableRangeManager.extendRight(bn2000000)
    exitableRangeManager.extendRight(bn3000000)
    exitableRangeManager.remove(bn0, bn1000000, bn2000000)
    assert.equal(
      exitableRangeManager.getExitableEnd(bn0, bn1000000).toString(),
      bn1000000.toString()
    )
    assert.throws(() => {
      exitableRangeManager.getExitableEnd(bn1000000, bn1500000)
    }, 'exitable ranges not found')
  })

  it('shoud success to remove whole', () => {
    const exitableRangeManager = new ExitableRangeManager()
    exitableRangeManager.extendRight(bn1000000)
    exitableRangeManager.extendRight(bn2000000)
    exitableRangeManager.remove(bn0, bn0, bn2000000)
    assert.throws(() => {
      exitableRangeManager.getExitableEnd(bn1000000, bn1500000)
    }, 'exitable ranges not found')
  })

  it('shoud be succeeded to insert', () => {
    const exitableRangeManager = new ExitableRangeManager()
    exitableRangeManager.extendRight(bn1000000)
    exitableRangeManager.extendRight(bn2000000)
    exitableRangeManager.extendRight(bn3000000)
    exitableRangeManager.remove(bn0, bn1000000, bn2000000)
    exitableRangeManager.insert(bn0, bn1000000, bn1500000)
    assert.equal(
      exitableRangeManager.getExitableEnd(bn1000000, bn1500000).toString(),
      bn1500000.toString()
    )
  })

  it('shoud be succeeded to insert and remove multiple times', () => {
    const exitableRangeManager = new ExitableRangeManager()
    exitableRangeManager.extendRight(bn1000000)
    exitableRangeManager.extendRight(bn2000000)
    exitableRangeManager.extendRight(bn3000000)
    exitableRangeManager.remove(bn0, bn1000000, bn2000000)
    exitableRangeManager.extendRight(utils.bigNumberify('5000000'))
    try {
      exitableRangeManager.remove(bn0, bn1000000, bn2000000)
    } catch (e) {}
    exitableRangeManager.remove(bn0, bn2000000, bn3000000)
    assert.equal(
      exitableRangeManager
        .getExitableEnd(bn3000000, utils.bigNumberify('3100000'))
        .toString(),
      utils.bigNumberify('5000000').toString()
    )
  })

  it('shoud be succeeded to serialize and deserialize', () => {
    const exitableRangeManager = new ExitableRangeManager()
    exitableRangeManager.extendRight(bn1000000)
    exitableRangeManager.extendRight(bn2000000)
    exitableRangeManager.extendRight(bn3000000)
    exitableRangeManager.remove(bn0, bn1000000, bn2000000)
    exitableRangeManager.insert(bn0, bn1000000, bn1500000)
    const deserialized = ExitableRangeManager.deserialize(
      exitableRangeManager.serialize()
    )
    assert.equal(
      deserialized.getExitableEnd(bn1000000, bn1500000).toString(),
      bn1500000.toString()
    )
    assert.equal(
      deserialized.getExitableEnd(bn2000000, bn3000000).toString(),
      bn3000000.toString()
    )
  })
})

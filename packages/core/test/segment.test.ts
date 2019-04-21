import { describe, it } from 'mocha'
import { Segment } from '../src'
import { assert } from 'chai'
import { utils } from 'ethers'

describe('Segment', () => {
  it('encode', () => {
    const segment = new Segment(
      utils.bigNumberify('0'),
      utils.bigNumberify('1000000'),
      utils.bigNumberify('2000000')
    )
    const hex = segment.encode()
    assert.equal(hex, '0xc900830f4240831e8480')
  })

  it('decode', () => {
    const segment = Segment.decode('0xc900830f4240831e8480')
    assert.equal(segment.start.toString(), '1000000')
  })

  it('segment1 is added to segment2', () => {
    const segment1 = new Segment(
      utils.bigNumberify('0'),
      utils.bigNumberify('1000000'),
      utils.bigNumberify('2000000')
    )
    const segment2 = new Segment(
      utils.bigNumberify('0'),
      utils.bigNumberify('2000000'),
      utils.bigNumberify('2500000')
    )
    const segment_pattern1 = segment1.add(segment2)
    const segment_pattern2 = segment2.add(segment1)
    assert.equal(segment_pattern1.getAmount().toNumber(), 1500000)
    assert.equal(segment_pattern2.getAmount().toNumber(), 1500000)
  })

  it('small segment2 is subsctacted from segment1', () => {
    const segment1 = new Segment(
      utils.bigNumberify('0'),
      utils.bigNumberify('1000000'),
      utils.bigNumberify('2000000')
    )
    const segment2 = new Segment(
      utils.bigNumberify('0'),
      utils.bigNumberify('1000000'),
      utils.bigNumberify('1200000')
    )
    const segment = segment1.sub(segment2)[0]
    assert.equal(segment.getAmount().toNumber(), 800000)
  })

  it('large segment2 is subsctacted from segment1', () => {
    const segment1 = new Segment(
      utils.bigNumberify('0'),
      utils.bigNumberify('1000000'),
      utils.bigNumberify('2000000')
    )
    const segment2 = new Segment(
      utils.bigNumberify('0'),
      utils.bigNumberify('0'),
      utils.bigNumberify('3000000')
    )
    assert.equal(segment1.sub(segment2).length, 0)
  })
})

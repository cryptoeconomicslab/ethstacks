import { describe, it } from 'mocha'
import { DecoderUtility } from '../../src/utils/Decoder'
import { assert } from 'chai'
import { utils } from 'ethers'
import { AlicePrivateKey } from '../testdata'

describe('DecoderUtility', () => {
  const AliceAddress = utils.computeAddress(AlicePrivateKey)

  it('encode and decode', () => {
    const hexList = [
      utils.bigNumberify(50).toHexString(),
      utils.bigNumberify(120).toHexString()
    ]
    const encoded = DecoderUtility.encode(hexList)
    const decoded = DecoderUtility.decode(encoded)
    assert.isTrue(utils.bigNumberify(decoded[0]).eq(50))
    assert.isTrue(utils.bigNumberify(decoded[1]).eq(120))
  })

  it('getAddress', () => {
    const encoded = DecoderUtility.encode([AliceAddress])
    const decoded = DecoderUtility.decode(encoded)
    const address = DecoderUtility.getAddress(decoded[0])
    assert.equal(address, AliceAddress)
  })
})

import { describe, it } from 'mocha'
import { ChamberOk, ChamberResultError, ChamberError } from '../../src/index'
import { assert } from 'chai'

describe('ChamberResult', () => {
  it('shoud be ok', () => {
    const result = new ChamberOk<string>('Hello')
    assert.isTrue(result.isOk())
    assert.equal(result.ok(), 'Hello')
  })

  it('shoud be error', () => {
    const result = new ChamberResultError<string>(
      new ChamberError(0, 'Test Error')
    )
    assert.isTrue(result.isError())
    assert.equal(result.error().message, 'Test Error')
  })
})

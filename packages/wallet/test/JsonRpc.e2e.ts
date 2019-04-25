import { describe, it } from "mocha"
import { JsonRpcClient } from '../src/client'
import { assert } from "chai"
import CDP from 'chrome-remote-interface'

const injectScript = `
const JsonRpcClient = ${JsonRpcClient}
const client = new JsonRpcClient('https://kovan.infura.io/v3/12abea2d0fff436184cd78750a4e1966')
const methodName = 'eth_blockNumber'
const args = []
let { result: blkHex } = await client.request(methodName, args)
return blkHex
`

describe('JsonRpcClient', () => {
  it('should run eth_blockNumber on CommonJS', async () => {
    try {
      if(process.env.NODE_ENV !== 'ci'){
        const { Runtime } = await CDP()
        const {result, exceptionDetails} = await Runtime.evaluate({
          awaitPromise: true,
          expression: `(async () => { ${injectScript} })()`
        });
        if(exceptionDetails) throw new Error(exceptionDetails)
        assert.equal(parseInt(result.value) > 0, true)
      } else {
        console.log('This test only works on local for now...')        
      }
    } catch(e) { 
      throw new Error(e.message)
    }
  }).timeout(10000)
  it('should run eth_blockNumber on NodeJS', async () => {
    try {
      const client = new JsonRpcClient('https://kovan.infura.io/v3/12abea2d0fff436184cd78750a4e1966')
      const methodName = 'eth_blockNumber'
      const args = []
      let { result: blkHex } = await client.request(methodName, args)
      assert.equal(parseInt(blkHex) > 0, true)
    } catch(e) { 
      throw new Error(e.message)
    }
  })
})
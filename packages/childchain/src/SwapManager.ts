import { SwapRequest, SignedTransaction } from '@layer2/core'

export class SwapManager {
  public requests: SwapRequest[]
  public responds: Map<string, SignedTransaction>

  constructor() {
    this.requests = []
    this.responds = new Map<string, SignedTransaction>()
  }

  public requestSwap(swapReq: SwapRequest) {
    this.requests.push(swapReq)
    if (this.requests.length > 10) {
      this.requests.shift()
    }
  }

  public respondRequestSwap(owner: string, swapTx: SignedTransaction) {
    this.responds.set(owner, swapTx)
  }

  public clearRespond(owner: string) {
    this.responds.delete(owner)
  }

  public getRequests() {
    return this.requests
  }

  public getRespond(owner: string) {
    return this.responds.get(owner)
  }
}

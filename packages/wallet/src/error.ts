import { ChamberError } from '@layer2/core'

export class WalletErrorFactory {
  public static InvalidReceipt() {
    return new ChamberError(1200, 'invalid receipt')
  }
  public static ExitNotFound() {
    return new ChamberError(1220, 'exit not found')
  }
  public static TooLargeAmount() {
    return new ChamberError(1230, 'too large amount')
  }
  public static SwapRequestError() {
    return new ChamberError(1240, 'swap request error')
  }
}

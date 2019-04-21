import { ChamberError } from '@layer2/core'

export class ChainErrorFactory {
  public static BlockNotFound() {
    return new ChamberError(1000, 'block not found')
  }
  public static InvalidTransaction() {
    return new ChamberError(1010, 'invalid transaction')
  }
  public static AlreadySent() {
    return new ChamberError(1011, 'already sent')
  }
  public static SegmentDuplicated() {
    return new ChamberError(1011, 'segment duplicated')
  }
  public static UnknownError() {
    return new ChamberError(1020, 'unknown Error')
  }
  public static NoValidTransactions() {
    return new ChamberError(1030, 'no valid transactions')
  }
}

import {
  ChamberResult,
  ChamberResultError,
  SignedTransaction,
  Segment,
  ChamberOk
} from '@layer2/core'
import { ChainErrorFactory } from './error'

export class TxFilter {
  public txHashes: Map<string, boolean>
  public segments: Segment[]

  constructor() {
    this.txHashes = new Map<string, boolean>()
    this.segments = []
  }

  public checkAndInsertTx(tx: SignedTransaction): ChamberResult<boolean> {
    /*
    if(!tx.verify()) {
      throw new Error('invalid transaction')
    }
    */
    if (this.txHashes.get(tx.hash()) !== undefined) {
      return new ChamberResultError(ChainErrorFactory.AlreadySent())
    }
    if (
      tx.getStateUpdates().filter(input => {
        const target = input.getSegment()
        return (
          this.segments.filter(segment => {
            return target.start.lt(segment.end) && target.end.gt(segment.start)
          }).length > 0
        )
      }).length > 0
    ) {
      return new ChamberResultError(ChainErrorFactory.SegmentDuplicated())
    }
    this.txHashes.set(tx.hash(), true)
    this.segments = this.segments.concat(tx.getSegments())
    return new ChamberOk(true)
  }

  public clear() {
    this.txHashes.clear()
    this.segments = []
  }
}

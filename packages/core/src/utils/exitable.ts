import { utils } from 'ethers';
import BigNumber = utils.BigNumber
import { Segment } from '../segment';

export class ExitableRangeManager {
  ranges: Segment[]

  constructor() {
    this.ranges = []
    this.ranges.push(ExitableRangeManager.emptyRange())
  }

  withRanges(ranges: Segment[]) {
    this.ranges = ranges
    if(this.ranges.length == 0) {
      // if ranges has no item, push empty range
      this.ranges.push(ExitableRangeManager.emptyRange())
    }
    return this
  }

  static emptyRange() {
    return new Segment(
      utils.bigNumberify(0),
      utils.bigNumberify(0),
      utils.bigNumberify(0))
  }

  static deserialize(arr: any[]) {
    return new ExitableRangeManager().withRanges(arr.map(s => Segment.deserialize(s)))
  }

  serialize() {
    return this.ranges.map(range => range.serialize())
  }

  insert(tokenId: BigNumber, start: BigNumber, end: BigNumber) {
    this.ranges.push(new Segment(tokenId, start, end))
    this.ranges.sort((a, b) => {
      if(a.tokenId.gt(b.tokenId)) return 1
      else if(a.tokenId.lt(b.tokenId)) return -1
      else {
        if(a.start.gt(b.start)) return 1
        else if(a.start.lt(b.start)) return -1
        else return 0
      }
    })
  }

  extendRight(newEnd: BigNumber) {
    const leftMostRange = this.ranges[this.ranges.length - 1]
    leftMostRange.end = newEnd
  }

  remove(tokenId: BigNumber, start: BigNumber, end: BigNumber) {
    const exitableRange = this.getExitableRange(start, end)
    if(exitableRange.start.lt(start)) {
      this.insert(tokenId, exitableRange.start, start)
    }
    if(exitableRange.end.gt(end)) {
      exitableRange.start = end
    }else{
      this.removeItem(start, end)
    }
    this.sort()
  }

  private removeItem(start: BigNumber, end: BigNumber) {
    this.ranges = this.ranges.filter(r => {
      return !(r.start.lte(start) && r.end.gte(end))
    })
  }

  private sort() {
    this.ranges.sort((a, b) => {
      if(a.start.gt(b.start)) return 1
      else if(a.start.lt(b.start)) return -1
      else return 0
    })
  }

  getExitableRange(start: BigNumber, end: BigNumber) {
    const ranges = this.ranges.filter(r => {
      return r.start.lte(start) && r.end.gte(end)
    })
    if(ranges.length != 1) {
      throw new Error('exitable ranges not found')
    }
    return ranges[0]
  }
  
  getExitableEnd(start: BigNumber, end: BigNumber): BigNumber {
    return this.getExitableRange(start, end).end
  }

}

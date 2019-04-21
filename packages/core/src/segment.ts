import { utils } from 'ethers'
import { RLPItem } from './helpers/types'
import { MASK8BYTES, TOTAL_AMOUNT } from './helpers/constants'
import BigNumber = utils.BigNumber
import RLP = utils.RLP

/**
 * Segment class is one segment of deposited value on Plasma
 */
export class Segment {
  public static ETH(start: BigNumber, end: BigNumber) {
    return new Segment(utils.bigNumberify(0), start, end)
  }

  public static fromGlobal(start: BigNumber, end: BigNumber) {
    const tokenId = start.div(TOTAL_AMOUNT)
    return new Segment(
      tokenId,
      start.sub(tokenId.mul(TOTAL_AMOUNT)),
      end.sub(tokenId.mul(TOTAL_AMOUNT))
    )
  }

  public static fromBigNumber(bn: BigNumber): Segment {
    const tokenId = bn.div(MASK8BYTES).div(MASK8BYTES)
    const start = bn
      .sub(tokenId.mul(MASK8BYTES).mul(MASK8BYTES))
      .div(MASK8BYTES)
    const end = bn
      .sub(tokenId.mul(MASK8BYTES).mul(MASK8BYTES))
      .sub(start.mul(MASK8BYTES))
    return new Segment(tokenId, start, end)
  }

  public static fromTuple(tuple: RLPItem[]): Segment {
    return new Segment(
      utils.bigNumberify(tuple[0]),
      utils.bigNumberify(tuple[1]),
      utils.bigNumberify(tuple[2])
    )
  }

  public static decode(bytes: string): Segment {
    return Segment.fromTuple(RLP.decode(bytes))
  }

  public static deserialize(data: string[]): Segment {
    return new Segment(
      utils.bigNumberify(data[0]),
      utils.bigNumberify(data[1]),
      utils.bigNumberify(data[2])
    )
  }
  public tokenId: BigNumber
  public start: BigNumber
  public end: BigNumber

  /**
   * Segment
   * @param tokenId
   * @param start
   * @param end
   */
  constructor(tokenId: BigNumber, start: BigNumber, end: BigNumber) {
    this.tokenId = tokenId
    this.start = start
    this.end = end
  }

  public getTokenId() {
    return this.tokenId
  }

  public getAmount() {
    return this.end.sub(this.start)
  }

  public getGlobalStart() {
    return this.start.add(this.tokenId.mul(TOTAL_AMOUNT))
  }

  public getGlobalEnd() {
    return this.end.add(this.tokenId.mul(TOTAL_AMOUNT))
  }

  public toBigNumber(): BigNumber {
    return this.tokenId
      .mul(MASK8BYTES)
      .mul(MASK8BYTES)
      .add(this.start.mul(MASK8BYTES).add(this.end))
  }

  public toTuple(): BigNumber[] {
    return [this.tokenId, this.start, this.end]
  }

  public encode(): string {
    return RLP.encode(this.toTuple())
  }

  public serialize(): string[] {
    return [this.tokenId.toString(), this.start.toString(), this.end.toString()]
  }

  public isContain(segment: Segment) {
    return (
      this.getTokenId().eq(segment.getTokenId()) &&
      this.start.lte(segment.start) &&
      this.end.gte(segment.end)
    )
  }

  /**
   * isHit
   * @description check collision of segments
   * @param segment target segment
   */
  public isHit(segment: Segment) {
    return (
      this.getTokenId().eq(segment.getTokenId()) &&
      this.start.lt(segment.end) &&
      this.end.gt(segment.start)
    )
  }

  public add(segment: Segment): Segment {
    if (this.end.eq(segment.start)) {
      return new Segment(this.tokenId, this.start, segment.end)
    } else if (this.start.eq(segment.end)) {
      return new Segment(this.tokenId, segment.start, this.end)
    } else {
      throw new Error('segments are not neighbor')
    }
  }

  public sub(segment: Segment) {
    const s1 = new Segment(this.tokenId, this.start, segment.start)
    const s2 = new Segment(this.tokenId, segment.end, this.end)
    return [s1, s2].filter(s => s.getAmount().gt(0))
  }

  public clone() {
    return Segment.deserialize(this.serialize())
  }

  public pretty() {
    return {
      tokenId: this.tokenId.toNumber(),
      start: this.start.toNumber(),
      end: this.end.toNumber()
    }
  }
}

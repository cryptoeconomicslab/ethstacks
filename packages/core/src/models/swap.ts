import { Segment } from '../segment'
import { Address } from '../helpers/types'
import * as ethers from 'ethers'
import BigNumber = ethers.utils.BigNumber
import { SignedTransaction } from '../SignedTransaction'
import { StateUpdate, OwnershipPredicate } from '../StateUpdate'

export class SwapRequest {
  public static deserialize(data: any) {
    return new SwapRequest(
      data.owner,
      ethers.utils.bigNumberify(data.blkNum),
      Segment.deserialize(data.segment),
      ethers.utils.bigNumberify(data.neightborBlkNum),
      Segment.deserialize(data.neighbor)
    )
  }
  public owner: Address
  public blkNum: BigNumber
  public segment: Segment
  public neightborBlkNum: BigNumber
  public neighbor: Segment
  public target?: StateUpdate

  constructor(
    owner: Address,
    blkNum: BigNumber,
    segment: Segment,
    neightborBlkNum: BigNumber,
    neighbor: Segment
  ) {
    this.owner = owner
    this.blkNum = blkNum
    this.segment = segment
    this.neighbor = neighbor
    this.neightborBlkNum = neightborBlkNum
  }

  public getOwner() {
    return this.owner
  }

  public getBlkNum() {
    return this.blkNum
  }

  public getNeighbor() {
    return this.neighbor
  }

  public getNeighborBlkNum() {
    return this.neightborBlkNum
  }

  public serialize() {
    return {
      owner: this.owner,
      blkNum: this.blkNum.toString(),
      segment: this.segment.serialize(),
      neightborBlkNum: this.neightborBlkNum.toString(),
      neighbor: this.neighbor.serialize()
    }
  }

  /**
   *
   * @param segment
   * segment - neightbor
   * or neightbor - segment
   */
  public check(segment: Segment) {
    return (
      this.neighbor.end.eq(segment.start) || this.neighbor.start.eq(segment.end)
    )
  }

  public setTarget(target: StateUpdate) {
    this.target = target
  }

  public getSignedSwapTx(targetBlock: BigNumber, predicate: Address) {
    if (this.target) {
      const txs = this.getSwapTx(
        this.target.state,
        targetBlock,
        this.target.getSegment(),
        predicate
      )
      if (txs) {
        return new SignedTransaction(txs)
      }
    } else {
      throw new Error('target not setted')
    }
  }

  /**
   *
   * @param owner
   * @param blkNum
   * @param segment
   * neighbor - segment - this.segment
   * case: segment >= this.segment
   *   segment:offset and this.segment
   * case: segment < this.segment
   * neighbor - segment - this.segment
   *   segment and this.segment:offset
   */
  private getSwapTx(
    owner: Address,
    blkNum: BigNumber,
    segment: Segment,
    predicate: Address
  ) {
    if (segment.getAmount().gte(this.segment.getAmount())) {
      // case: segment >= this.segment
      // swap segment:left and this.segment
      return [
        OwnershipPredicate.create(
          new Segment(
            segment.getTokenId(),
            segment.start,
            segment.start.add(this.segment.getAmount())
          ),
          blkNum,
          predicate,
          this.getOwner()
        ),
        OwnershipPredicate.create(this.segment, blkNum, predicate, owner)
      ]
    } else {
      // case: segment < this.segment
      // swap segment and this.segment:left
      return [
        OwnershipPredicate.create(segment, blkNum, predicate, this.getOwner()),
        OwnershipPredicate.create(
          new Segment(
            this.segment.getTokenId(),
            this.segment.end.sub(segment.getAmount()),
            this.segment.end
          ),
          blkNum,
          predicate,
          owner
        )
      ]
    }
  }
}

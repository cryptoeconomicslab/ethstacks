import {
  SignedTransaction,
  SignedTransactionWithProof
} from '../SignedTransaction'
import { StateUpdate, PredicatesManager } from '../StateUpdate'
import { Segment } from '../segment'
import { Hash } from '../helpers/types'

export interface IState {
  getSegment(): Segment
  verifyDeprecation(
    hash: Hash,
    newStateUpdate: StateUpdate,
    deprecationWitness: string,
    predicatesManager: PredicatesManager
  ): boolean
  getRemainingState(state: IState): IState[]
  getSubStateUpdate(newSegment: Segment): StateUpdate
  getStateHash(): Hash
  getRawState(): string
}

export class BaseStateManager {
  public predicatesManager: PredicatesManager
  public leaves: IState[]

  constructor(predicatesManager: PredicatesManager) {
    this.predicatesManager = predicatesManager
    this.leaves = []
  }

  public _isContain(
    hash: string,
    stateUpdate: IState,
    deprecationWitness: string
  ) {
    const targets = this.getLeavesInRange(stateUpdate.getSegment())
    return this.canDeprecation(targets, hash, stateUpdate, deprecationWitness)
  }

  public _spend(
    hash: string,
    stateUpdate: IState,
    deprecationWitness: string
  ): IState[] {
    const targets = this.getLeavesInRange(stateUpdate.getSegment())
    const canDeprecate = this.canDeprecation(
      targets,
      hash,
      stateUpdate,
      deprecationWitness
    )
    if (canDeprecate) {
      this.leaves = this.leaves.filter(l => {
        return targets.map(t => t.getStateHash()).indexOf(l.getStateHash()) < 0
      })
      targets.forEach(target => {
        target.getRemainingState(stateUpdate).forEach(newTxo => {
          this.leaves.push(newTxo)
        })
      })
      return targets
    } else {
      return []
    }
  }

  public _insert(newStateUpdate: IState) {
    const isContains = this.leaves.filter(l =>
      l.getSegment().isContain(newStateUpdate.getSegment())
    )
    if (isContains.length > 0) {
      return false
    } else {
      const index = this.getIndex(newStateUpdate)
      this.leaves.splice(index, 0, newStateUpdate)
      return true
    }
  }

  public startExit(segment: Segment) {
    this.leaves = this.leaves.filter(
      l =>
        !l
          .getSegment()
          .toBigNumber()
          .eq(segment.toBigNumber())
    )
  }

  public getLeaves() {
    return this.leaves
  }

  public toObject() {
    return this.leaves.map(l => {
      return {
        state: l.getRawState(),
        segment: l.getSegment().pretty()
      }
    })
  }

  /**
   * get available states in certain range
   * @param range
   */
  private getLeavesInRange(range: Segment) {
    return this.leaves.filter(l => range.isHit(l.getSegment()))
  }

  /**
   * check stateUpdate can deprecate targets or not.
   */
  private canDeprecation(
    targets: IState[],
    hash: string,
    stateUpdate: IState,
    deprecationWitness: string
  ) {
    return (
      targets.filter(l => {
        return l.verifyDeprecation(
          hash,
          stateUpdate.getSubStateUpdate(l.getSegment()),
          deprecationWitness,
          this.predicatesManager
        )
      }).length == targets.length && targets.length > 0
    )
  }

  private getIndex(stateUpdate: IState) {
    for (let i = 0; i < this.leaves.length; i++) {
      if (
        this.leaves[i].getSegment().start.gt(stateUpdate.getSegment().start)
      ) {
        return i
      }
    }
    return this.leaves.length
  }
}

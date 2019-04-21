import { Segment } from './segment'
import { BigNumber } from 'ethers/utils'
import { Address, RLPItem, Hash } from './helpers/types'
import { utils, constants } from 'ethers'
import RLP = utils.RLP
import { DecoderUtility } from './utils/Decoder'
import { IState } from './state/BaseStateManager'

export class StateUpdate implements IState {
  public static deserialize(data: string) {
    return StateUpdate.fromTupl(RLP.decode(data))
  }

  public static fromTupl(data: RLPItem[]) {
    return new StateUpdate(
      Segment.fromBigNumber(utils.bigNumberify(data[0])),
      utils.bigNumberify(data[1]),
      utils.getAddress(data[2]),
      data[3]
    )
  }
  public segment: Segment
  public blkNum: BigNumber
  public predicate: Address
  // hex string
  public state: string

  constructor(
    segment: Segment,
    blkNum: BigNumber,
    predicate: Address,
    state: string
  ) {
    this.segment = segment
    this.blkNum = blkNum
    this.predicate = predicate
    this.state = state
  }

  public getSegment(): Segment {
    return this.segment
  }

  public getBlkNum(): BigNumber {
    return this.blkNum
  }

  public getRawState() {
    return this.state
  }

  public serialize() {
    return RLP.encode(this.encodeToTuple())
  }

  public encodeToTuple(): RLPItem[] {
    return [this.segment.toBigNumber(), this.blkNum, this.predicate, this.state]
  }

  /**
   * for RootChain contract
   */
  public encode(): string {
    const predicate = utils.padZeros(utils.arrayify(this.predicate), 32)
    const blkNum = utils.padZeros(utils.arrayify(this.blkNum), 32)
    const segment = utils.padZeros(
      utils.arrayify(this.segment.toBigNumber()),
      32
    )
    const stateBytes = utils.arrayify(this.state)
    return utils.hexlify(utils.concat([predicate, blkNum, segment, stateBytes]))
  }

  public getStateHash() {
    return this.hash()
  }

  public hash(): string {
    return utils.keccak256(this.encode())
  }

  public getSubStateUpdate(newSegment: Segment): StateUpdate {
    if (this.segment.isContain(newSegment)) {
      return new StateUpdate(
        newSegment,
        this.blkNum,
        this.predicate,
        this.state
      )
    } else {
      return this
    }
  }

  public getRemainingState(state: StateUpdate): StateUpdate[] {
    const newSegments = this.getSegment().sub(state.getSegment())
    return newSegments.map(s => {
      return new StateUpdate(s, this.getBlkNum(), this.predicate, this.state)
    })
  }

  public verifyDeprecation(
    hash: Hash,
    newStateUpdate: StateUpdate,
    deprecationWitness: string,
    predicatesManager: PredicatesManager
  ): boolean {
    try {
      return predicatesManager.verifyDeprecation(
        this.predicate,
        hash,
        this,
        deprecationWitness,
        newStateUpdate
      )
    } catch (e) {
      console.warn("can't verify deprecation because", e)
      return false
    }
  }

  // spesific methods

  public isOwnedBy(owner: Address, predicatesManager: PredicatesManager) {
    return predicatesManager.isOwnedBy(this.predicate, owner, this)
  }

  public getOwner() {
    return DecoderUtility.getAddress(this.state)
  }
}

export class PredicatesManager {
  public predicates: Map<Address, string>
  public name2address: Map<string, Address>

  constructor() {
    this.predicates = new Map<Address, string>()
    this.name2address = new Map<string, Address>()
  }

  public addPredicate(predicateAddress: Address, nativePredicate: string) {
    this.predicates.set(predicateAddress, nativePredicate)
    this.name2address.set(nativePredicate, predicateAddress)
  }

  public getNativePredicate(nativePredicate: string) {
    const address = this.name2address.get(nativePredicate)
    if (address) {
      return address
    } else {
      throw new Error('unknown predicate name')
    }
  }

  public verifyDeprecation(
    predicate: Address,
    hash: string,
    stateUpdate: StateUpdate,
    deprecationWitness: string,
    nextStateUpdate: StateUpdate
  ) {
    const native = this.predicates.get(predicate)
    if (native == 'OwnershipPredicate') {
      return OwnershipPredicate.verifyDeprecation(
        hash,
        stateUpdate,
        deprecationWitness,
        nextStateUpdate
      )
    } else if (native == 'PaymentChannelPredicate') {
      return PaymentChannelPredicate.verifyDeprecation(
        hash,
        stateUpdate,
        deprecationWitness,
        nextStateUpdate
      )
    }
    return false
  }

  public isOwnedBy(
    predicate: Address,
    owner: Address,
    stateUpdate: StateUpdate
  ) {
    const native = this.predicates.get(predicate)
    if (native == 'OwnershipPredicate') {
      return OwnershipPredicate.isOwnedBy(owner, stateUpdate)
    }
    return false
  }
}

export class OwnershipPredicate {
  public static create(
    segment: Segment,
    blkNum: BigNumber,
    predicate: Address,
    owner: Address
  ) {
    return new StateUpdate(
      segment,
      blkNum,
      predicate,
      DecoderUtility.encode([owner])
    )
  }

  public static verifyDeprecation(
    hash: string,
    stateUpdate: StateUpdate,
    deprecationWitness: string,
    nextStateUpdate: StateUpdate
  ): boolean {
    const isContain = stateUpdate.segment.isContain(nextStateUpdate.segment)
    const isCorrectSig =
      utils.recoverAddress(hash, deprecationWitness) ==
      DecoderUtility.getAddress(stateUpdate.state)
    return isContain && isCorrectSig
  }

  public static isOwnedBy(owner: Address, stateUpdate: StateUpdate): boolean {
    const address32 = DecoderUtility.decode(stateUpdate.state)[0]
    return DecoderUtility.getAddress(address32) == utils.getAddress(owner)
  }
}

export class PaymentChannelPredicate {
  public static create(
    segment: Segment,
    blkNum: BigNumber,
    predicate: Address,
    hash: string,
    participant1: Address,
    participant2: Address,
    stateIndex: number
  ) {
    return new StateUpdate(
      segment,
      blkNum,
      predicate,
      DecoderUtility.encode([
        hash,
        participant1,
        participant2,
        utils.bigNumberify(stateIndex).toHexString()
      ])
    )
  }

  public static verifyDeprecation(
    hash: string,
    stateUpdate: StateUpdate,
    deprecationWitness: string,
    nextStateUpdate: StateUpdate
  ): boolean {
    const isContain = stateUpdate.segment.isContain(nextStateUpdate.segment)
    const decoded = DecoderUtility.decode(stateUpdate.state)
    const isCorrectSig1 =
      utils.recoverAddress(
        hash,
        utils.hexDataSlice(deprecationWitness, 0, 65)
      ) == DecoderUtility.getAddress(decoded[0])
    const isCorrectSig2 =
      utils.recoverAddress(
        hash,
        utils.hexDataSlice(deprecationWitness, 65, 130)
      ) == DecoderUtility.getAddress(decoded[1])
    return isContain && isCorrectSig1 && isCorrectSig2
  }

  public static isOwnedBy(owner: Address, stateUpdate: StateUpdate): boolean {
    const decoded = DecoderUtility.decode(stateUpdate.state)
    return decoded.map(d => utils.getAddress(d)).indexOf(owner) >= 0
  }
}

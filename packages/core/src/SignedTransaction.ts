import { utils, ethers } from 'ethers'
import { HexString, Signature, Hash, Address } from './helpers/types'
import { TOTAL_AMOUNT } from './helpers/constants'
import { keccak256, BigNumber } from 'ethers/utils'
import { SumMerkleProof, SumMerkleTree } from './merkle'
import { HexUtil } from './utils/hex'
import { Segment } from './segment'
import { StateUpdate, PredicatesManager } from './StateUpdate'
import { IState } from './state/BaseStateManager'

/**
 * SignedTransaction is the transaction and its signatures
 */
export class SignedTransaction {
  public static deserialize(data: any): SignedTransaction {
    return new SignedTransaction(
      data.states.map((state: any) => StateUpdate.deserialize(state))
    ).withRawSignatures(data.tw)
  }
  public stateUpdates: StateUpdate[]
  public transactionWitness: Signature[]

  constructor(stateUpdates: StateUpdate[]) {
    this.stateUpdates = stateUpdates
    this.transactionWitness = []
  }

  public withRawSignatures(sigs: Signature[]): SignedTransaction {
    this.transactionWitness = sigs
    return this
  }

  public getStateUpdate(stateIndex: number) {
    return this.stateUpdates[stateIndex]
  }

  public getStateUpdates() {
    return this.stateUpdates
  }

  /**
   * sign
   * @param pkey is hex string of private key
   */
  public sign(pkey: string) {
    this.transactionWitness.push(this.justSign(pkey))
  }

  public justSign(pkey: string) {
    const key = new utils.SigningKey(pkey)
    return utils.joinSignature(key.signDigest(this.getTxHash()))
  }

  public getTxBytes() {
    return HexUtil.concat(this.stateUpdates.map(tx => tx.encode()))
  }

  public hash() {
    return this.getTxHash()
  }

  public getTxHash() {
    return utils.keccak256(this.getTxBytes())
  }

  public getSegments() {
    const segments = this.stateUpdates.reduce(
      (segments: Segment[], StateUpdate) => {
        return segments.concat([StateUpdate.getSegment()])
      },
      []
    )
    segments.sort((a, b) => {
      if (a.start.gt(b.start)) {
        return 1
      } else if (a.start.lt(b.start)) {
        return -1
      } else {
        return 0
      }
    })
    return segments
  }

  /**
   *
   * @description txs[txIndex].getOutputs(outputIndex)
   */
  public getIndex(segment: Segment): any {
    let result
    this.stateUpdates.forEach((stateUpdate, txIndex) => {
      const s = stateUpdate.getSegment()
      if (s.start.eq(segment.start)) {
        result = {
          txIndex
        }
      }
    })
    if (!result) {
      throw new Error('error')
    }
    return result
  }

  public getTransactionWitness() {
    return HexUtil.concat(this.transactionWitness)
  }

  public getSigners(): Address[] {
    return this.transactionWitness.map(sig =>
      utils.recoverAddress(this.getTxHash(), sig)
    )
  }

  public serialize() {
    return {
      states: this.stateUpdates.map(stateUpdate => stateUpdate.serialize()),
      tw: this.transactionWitness
    }
  }
}

/**
 * SignedTransactionWithProof is the transaction and its signatures and proof
 */
export class SignedTransactionWithProof implements IState {
  public static deserialize(data: any): SignedTransactionWithProof {
    return new SignedTransactionWithProof(
      SignedTransaction.deserialize(data.tx),
      data.i,
      data.sr,
      data.r,
      utils.bigNumberify(data.ts),
      data.proofs.map((proof: any) => SumMerkleProof.deserialize(proof)),
      utils.bigNumberify(data.blkNum),
      StateUpdate.deserialize(data.stateUpdate)
    ).checkVerified(data.v)
  }
  public signedTx: SignedTransaction
  public stateIndex: number
  public proofs: SumMerkleProof[]
  public superRoot: Hash
  public root: Hash
  public timestamp: BigNumber
  public blkNum: BigNumber
  public confSigs: Signature[]
  public stateUpdate: StateUpdate
  public verifiedFlag: boolean

  constructor(
    tx: SignedTransaction,
    stateIndex: number,
    superRoot: Hash,
    root: Hash,
    timestamp: BigNumber,
    proofs: SumMerkleProof[],
    blkNum: BigNumber,
    stateUpdate?: StateUpdate
  ) {
    this.signedTx = tx
    this.stateIndex = stateIndex
    this.superRoot = superRoot
    this.root = root
    this.timestamp = timestamp
    this.proofs = proofs
    this.blkNum = blkNum
    this.confSigs = []
    if (stateUpdate) {
      this.stateUpdate = stateUpdate
    } else {
      this.stateUpdate = this.signedTx.getStateUpdate(this.stateIndex)
    }
    this.verifiedFlag = false
  }

  public checkVerified(verifiedFlag: boolean) {
    this.verifiedFlag = verifiedFlag
    return this
  }

  public getSignedTx(): SignedTransaction {
    return this.signedTx
  }

  public getTxBytes(): HexString {
    return this.getSignedTx().getTxBytes()
  }

  public getTxHash(): Hash {
    return this.getSignedTx().getTxHash()
  }

  public getStateBytes() {
    return this.getOutput().encode()
  }

  public getStateHash() {
    return this.getOutput().hash()
  }

  public getRawState() {
    return this.getOutput().getRawState()
  }

  public verifyDeprecation(
    hash: Hash,
    newStateUpdate: StateUpdate,
    deprecationWitness: string,
    predicatesManager: PredicatesManager
  ): boolean {
    return this.getOutput().verifyDeprecation(
      hash,
      newStateUpdate,
      deprecationWitness,
      predicatesManager
    )
  }

  public getSubStateUpdate(newSegment: Segment): StateUpdate {
    if (this.getSegment().isContain(newSegment)) {
      return this.getOutput().getSubStateUpdate(newSegment)
    } else {
      return this.getOutput()
    }
  }

  public getRemainingState(stateUpdate: StateUpdate): IState[] {
    return this.getOutput()
      .getRemainingState(stateUpdate)
      .map(newTxo => {
        return new SignedTransactionWithProof(
          this.signedTx,
          this.stateIndex,
          this.superRoot,
          this.root,
          this.timestamp,
          this.proofs,
          this.blkNum,
          newTxo
        )
      })
  }

  public getSegment() {
    return this.getOutput().getSegment()
  }

  public getOriginalSegment() {
    return this.proofs[this.stateIndex].segment
  }

  public getSuperRoot() {
    return this.superRoot
  }

  public getTimestamp(): BigNumber {
    return this.timestamp
  }

  public getRoot() {
    return this.root
  }

  public getProof(): SumMerkleProof {
    return this.proofs[this.stateIndex]
  }

  public isDeposit() {
    return false
  }

  /**
   * @description header structure
   *     numTx       2 bytes
   *     txIndex     2 bytes
   *     merkle root 32 bytes
   *     timestamp   8 bytes
   *     numNodes    2 bytes
   *   proofs
   *     txOffset    2 bytes
   *     txSize      2 bytes
   *     segment     32 bytes
   *     sig         65 bytes
   *     range       8 bytes
   *     proof body  n * 41 bytes
   */
  public getProofAsHex(): HexString {
    if (this.isDeposit()) {
      // In case of deposit
      return utils.hexlify(0)
    } else {
      const numTx = utils.padZeros(
        utils.arrayify(utils.bigNumberify(this.proofs.length)),
        2
      )
      const txIndex = utils.padZeros(
        utils.arrayify(utils.bigNumberify(this.stateIndex)),
        2
      )
      const rootHeader = utils.arrayify(this.root)
      const timestampHeader = utils.padZeros(utils.arrayify(this.timestamp), 8)
      const proofLength = utils
        .bigNumberify(utils.hexDataLength(this.proofs[0].proof))
        .div(41)
      const numNodes = utils.padZeros(utils.arrayify(proofLength), 2)
      const proofs = this.proofs.map((proof, i) => {
        const txOffset = utils.padZeros(utils.arrayify(this.getTxOffset(i)), 2)
        const txSize = utils.padZeros(utils.arrayify(this.getTxSize(i)), 2)
        const segment = utils.padZeros(
          utils.arrayify(proof.segment.toBigNumber()),
          32
        )
        // get original range
        const range: BigNumber = this.getSignedTx()
          .getStateUpdate(i)
          .getSegment()
          .getAmount()
        const rangeHeader = utils.padZeros(utils.arrayify(range), 8)
        const body = utils.arrayify(proof.toHex())
        return utils.concat([txOffset, txSize, segment, rangeHeader, body])
      })
      return utils.hexlify(
        utils.concat(
          [numTx, txIndex, rootHeader, timestampHeader, numNodes].concat(proofs)
        )
      )
    }
  }

  public getSignatures() {
    return this.getTransactionWitness()
  }

  public getTransactionWitness(): HexString {
    return this.signedTx.getTransactionWitness()
  }

  public getOutput() {
    return this.stateUpdate
  }

  public merkleHash(): Hash {
    return keccak256(
      utils.hexlify(
        utils.concat([
          utils.arrayify(this.signedTx.hash()),
          utils.arrayify(this.superRoot)
        ])
      )
    )
  }

  public confirmMerkleProofs(pkey: string) {
    const key = new utils.SigningKey(pkey)
    const merkleHash = this.merkleHash()
    this.confSigs.push(utils.joinSignature(key.signDigest(merkleHash)))
  }

  public checkInclusion() {
    return (
      this.proofs.filter(proof => {
        return !SumMerkleTree.verify(
          this.getOutput()
            .getSegment()
            .getGlobalStart(),
          this.getOutput()
            .getSegment()
            .getGlobalEnd(),
          Buffer.from(this.getTxHash().substr(2), 'hex'),
          TOTAL_AMOUNT.mul(proof.numTokens),
          Buffer.from(this.root.substr(2), 'hex'),
          proof
        )
      }).length == 0
    )
  }

  public serialize() {
    return {
      tx: this.getSignedTx().serialize(),
      i: this.stateIndex,
      sr: this.superRoot,
      r: this.root,
      ts: this.timestamp.toString(),
      proofs: this.proofs.map(proof => proof.serialize()),
      blkNum: this.blkNum.toString(),
      confSigs: this.confSigs,
      stateUpdate: this.stateUpdate.serialize(),
      v: this.verifiedFlag
    }
  }

  /**
   * this.txIndex should be 0 or 1
   */
  private getTxOffset(index: number) {
    let offset = ethers.constants.Zero
    for (let i = 0; i < index; i++) {
      const size = this.getTxSize(i)
      offset = offset.add(size)
    }
    return offset
  }

  private getTxSize(i: number) {
    return utils.bigNumberify(
      utils.hexDataLength(this.signedTx.getStateUpdate(i).encode())
    )
  }
}

import { constants } from 'ethers'
import {
  SignedTransaction,
  SignedTransactionWithProof,
  StateUpdate,
  SumMerkleProof,
  PredicatesManager,
  BaseStateManager
} from '@layer2/core'

export class StateManager extends BaseStateManager {
  constructor(predicatesManager: PredicatesManager) {
    super(predicatesManager)
  }

  public isContain(tx: SignedTransactionWithProof): boolean {
    return this._isContain(tx.getTxHash(), tx, tx.getTransactionWitness())
  }

  public spend(tx: SignedTransactionWithProof) {
    return this._spend(tx.getTxHash(), tx, tx.getTransactionWitness())
  }

  public insert(tx: SignedTransactionWithProof) {
    return this._insert(tx)
  }

  public insertDepositTx(depositTx: StateUpdate) {
    return this._insert(
      new SignedTransactionWithProof(
        new SignedTransaction([depositTx]),
        0,
        '0x',
        '0x',
        constants.Zero,
        // 0x00000050 is header. 0x0050 is size of deposit transaction
        [new SumMerkleProof(1, 0, depositTx.getSegment(), '', '0x00000050')],
        depositTx.getBlkNum()
      )
    )
  }

  public getSignedTransactionWithProofs(): SignedTransactionWithProof[] {
    return this.getLeaves() as SignedTransactionWithProof[]
  }

  public serialize() {
    const states: SignedTransactionWithProof[] = this.getLeaves() as SignedTransactionWithProof[]
    return states.map(l => l.serialize())
  }

  public deserialize(data: any[]) {
    this.leaves = data.map(d => {
      return SignedTransactionWithProof.deserialize(d)
    })
  }
}

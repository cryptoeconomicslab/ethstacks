import { SignedTransaction } from '../SignedTransaction'
import { StateUpdate, PredicatesManager } from '../StateUpdate'
import { BaseStateManager, IState } from './BaseStateManager'

export class StateManager extends BaseStateManager {
  constructor(predicatesManager: PredicatesManager) {
    super(predicatesManager)
  }

  public isContain(tx: SignedTransaction): boolean {
    return tx.getStateUpdates().reduce(
      (isContain, i) => {
        return (
          isContain &&
          this._isContain(tx.getTxHash(), i, tx.getTransactionWitness())
        )
      },
      true as boolean
    )
  }

  public spend(tx: SignedTransaction): IState[] {
    return tx.getStateUpdates().reduce<IState[]>((spentState, i) => {
      return spentState.concat(
        this._spend(tx.getTxHash(), i, tx.getTransactionWitness())
      )
    }, [])
  }

  public insert(tx: SignedTransaction) {
    return tx.getStateUpdates().map(o => {
      return this._insert(o)
    })
  }

  public insertDepositTx(deposit: StateUpdate) {
    return this._insert(deposit)
  }

  public getStateUpdates(): StateUpdate[] {
    return this.getLeaves() as StateUpdate[]
  }

  public serialize() {
    const states: StateUpdate[] = this.getLeaves() as StateUpdate[]
    return states.map(l => l.serialize())
  }

  public deserialize(data: any[]) {
    this.leaves = data.map(d => {
      return StateUpdate.deserialize(d)
    })
  }
}

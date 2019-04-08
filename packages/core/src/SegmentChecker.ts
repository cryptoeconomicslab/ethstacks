import {
  TransactionOutput,
  TransactionOutputDeserializer,
  DepositTransaction
} from './tx'
import { SignedTransaction } from './SignedTransaction'
import { BigNumber } from 'ethers/utils';

export class SegmentChecker {

  leaves: TransactionOutput[]

  constructor() {
    this.leaves = []
  }

  private _isContain(txo: TransactionOutput) {
    return this.leaves.filter(l => {
      return l.isSpent(txo)
    }).length > 0
  }

  private _spend(txo: TransactionOutput) {
    const target = this.leaves.filter(l => l.isSpent(txo))[0]
    this.leaves = this.leaves.filter(l => !(l.isSpent(txo)))
    if(target) {
      target.getRemainingState(txo).forEach(newTxo => {
        this.leaves.push(newTxo)
      })
      return true
    } else {
      return false
    }
  }

  private getIndex(txo: TransactionOutput) {
    for(let i=0; i < this.leaves.length;i++) {
      if(this.leaves[i].getSegment(0).start.gt(txo.getSegment(0).start)) {
        return i
      }
    }
    return this.leaves.length
  }

  private _insert(txo: TransactionOutput, blkNum: BigNumber) {
    const newTxo = txo.withBlkNum(blkNum)
    if(this._isContain(newTxo)) {
      return false
    } else {
      const index = this.getIndex(newTxo)
      this.leaves.splice(index, 0, newTxo)
      return true
    }
  }

  isContain(tx: SignedTransaction): boolean {
    return tx.getAllInputs().reduce((isContain, i) => {
      return isContain && this._isContain(i)
    }, <boolean>true)
  }

  spend(tx: SignedTransaction) {
    return tx.getAllInputs().map((i) => {
      return this._spend(i)
    })
  }

  insert(tx: SignedTransaction, blkNum: BigNumber) {
    return tx.getAllOutputs().map((o) => {
      return this._insert(o, blkNum)
    })
  }

  insertDepositTx(depositTx: DepositTransaction, blkNum: BigNumber) {
    return this._insert(depositTx.getOutput(), blkNum)
  }

  serialize() {
    return this.leaves.map(l => l.serialize())
  }

  deserialize(data: any[]) {
    this.leaves = data.map(d => {
      return TransactionOutputDeserializer.deserialize(d)
    })
  }

  toObject() {
    return this.leaves.map(l => l.toObject())
  }

}

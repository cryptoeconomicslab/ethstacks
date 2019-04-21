import { TxFilter } from './txfilter'
import {
  ChamberResult,
  ChamberOk,
  ChamberResultError,
  SignedTransaction,
  Block,
  PredicatesManager,
  OwnershipPredicate,
  Address,
  Segment,
  StateManager,
  SignedTransactionWithProof
} from '@layer2/core'
import { ChainErrorFactory } from './error'
import { constants, utils } from 'ethers'
import BigNumber = utils.BigNumber
import { SwapManager } from './SwapManager'

export interface IChainDb {
  contains(key: string): Promise<boolean>
  insert(key: string, value: string): Promise<boolean>
  get(key: string): Promise<string>
  delete(key: string): Promise<boolean>
}

export class Chain {
  public blockHeight: number
  public db: IChainDb
  public txQueue: SignedTransaction[]
  public txFilter: TxFilter
  public numTokens: number
  public swapManager: SwapManager
  public segmentChecker: StateManager
  public predicatesManager: PredicatesManager
  public ownershipPredicateAddress: Address

  constructor(db: IChainDb, options: any) {
    this.predicatesManager = new PredicatesManager()
    this.predicatesManager.addPredicate(
      options.OwnershipPredicate,
      'OwnershipPredicate'
    )
    this.ownershipPredicateAddress = this.predicatesManager.getNativePredicate(
      'OwnershipPredicate'
    )
    this.segmentChecker = new StateManager(this.predicatesManager)
    this.blockHeight = 0
    this.db = db
    this.txQueue = []
    this.txFilter = new TxFilter()
    this.numTokens = 1
    this.swapManager = new SwapManager()
  }

  public setNumTokens(numTokens: number) {
    this.numTokens = numTokens
  }

  public getSwapManager() {
    return this.swapManager
  }

  public getCurrentSegments() {
    return this.segmentChecker.toObject()
  }

  public appendTx(tx: SignedTransaction): ChamberResult<boolean> {
    try {
      const result = this.txFilter.checkAndInsertTx(tx)
      if (result.isError()) {
        return result
      }
      if (!this.segmentChecker.isContain(tx)) {
        return new ChamberResultError(ChainErrorFactory.InvalidTransaction())
      }
      this.txQueue.push(tx)
      return new ChamberOk(true)
    } catch (e) {
      console.warn(e)
      return new ChamberResultError(ChainErrorFactory.UnknownError())
    }
  }

  public async updateConfSig(tx: SignedTransactionWithProof) {
    const result = await this.getBlock(tx.blkNum)
    if (result.isOk()) {
      const block = result.ok()
      tx.confSigs.map(confSig => {
        block.appendConfSig(tx.getSignedTx(), confSig)
      })
      await this.writeToDb(block)
    }
  }

  public isEmpty() {
    return this.txQueue.length == 0
  }

  public async generateBlock(): Promise<ChamberResult<string>> {
    const numToken = await this.readNumToken()
    const block = new Block(numToken)
    if (this.txQueue.length == 0) {
      return new ChamberResultError(ChainErrorFactory.NoValidTransactions())
    }
    const tasks = this.txQueue.map(async tx => {
      if (this.segmentChecker.spend(tx).length > 0) {
        block.appendTx(tx)
      }
    })
    await Promise.all(tasks)
    if (block.getTransactions().length == 0) {
      return new ChamberResultError(ChainErrorFactory.NoValidTransactions())
    }
    // write to DB
    const root = block.getRoot()
    await this.writeWaitingBlock(root, block)
    await this.writeSnapshot()
    return new ChamberOk(root)
  }

  public clear() {
    this.txQueue = []
    this.txFilter.clear()
  }

  public async handleListingEvent(tokenId: BigNumber, tokenAddress: string) {
    this.numTokens = tokenId.toNumber() + 1
    await this.db.insert('numTokens', JSON.stringify(this.numTokens))
  }

  public async handleSubmit(
    superRoot: string,
    root: string,
    blkNum: BigNumber,
    timestamp: BigNumber
  ) {
    const block = await this.readWaitingBlock(root)
    block.txs.forEach(tx => {
      this.segmentChecker.insert(tx)
    })
    block.setBlockNumber(blkNum.toNumber())
    block.setBlockTimestamp(timestamp)
    block.setSuperRoot(superRoot)
    this.blockHeight = blkNum.toNumber()
    await this.writeToDb(block)
    await this.writeSnapshot()
  }

  public async handleDeposit(
    depositor: string,
    tokenId: BigNumber,
    start: BigNumber,
    end: BigNumber,
    blkNum: BigNumber
  ) {
    const depositTx = OwnershipPredicate.create(
      new Segment(tokenId, start, end),
      blkNum,
      this.ownershipPredicateAddress,
      depositor
    )
    const block = new Block()
    block.setBlockNumber(blkNum.toNumber())
    block.setDepositTx(depositTx)
    this.blockHeight = blkNum.toNumber()
    // write to DB
    this.segmentChecker.insertDepositTx(depositTx)
    await this.writeToDb(block)
    await this.writeSnapshot()
  }

  public async handleExit(
    exitor: string,
    segment: BigNumber,
    blkNum: BigNumber
  ) {
    this.segmentChecker.startExit(Segment.fromBigNumber(segment))
    await this.writeSnapshot()
  }

  public async getBlock(blkNum: BigNumber): Promise<ChamberResult<Block>> {
    try {
      const block = await this.readFromDb(blkNum)
      return new ChamberOk(block)
    } catch (e) {
      return new ChamberResultError(ChainErrorFactory.BlockNotFound())
    }
  }

  public async getUserTransactions(
    blkNum: BigNumber,
    owner: string
  ): Promise<ChamberResult<SignedTransactionWithProof[]>> {
    const block = await this.getBlock(blkNum)
    if (block.isOk()) {
      return new ChamberOk(
        block.ok().getUserTransactionAndProofs(owner, this.predicatesManager)
      )
    } else {
      return new ChamberResultError(block.error())
    }
  }

  public async writeWaitingBlock(root: string, block: Block) {
    await this.db.insert(
      'waitingblock.' + root,
      JSON.stringify(block.serialize())
    )
  }

  public async readWaitingBlock(root: string) {
    const str = await this.db.get('waitingblock.' + root)
    return Block.deserialize(JSON.parse(str))
  }

  public async writeToDb(block: Block) {
    await this.db.insert(
      'block.' + block.getBlockNumber().toString(),
      JSON.stringify(block.serialize())
    )
  }

  public async readFromDb(blkNum: BigNumber) {
    const str = await this.db.get('block.' + blkNum.toString())
    return Block.deserialize(JSON.parse(str))
  }

  public async writeSnapshot() {
    await this.db.insert(
      'snapshot',
      JSON.stringify(this.segmentChecker.serialize())
    )
  }

  public async readSnapshot() {
    const snapshot = await this.db.get('snapshot')
    this.segmentChecker.deserialize(JSON.parse(snapshot))
  }

  public async readNumToken() {
    const numTokens = await this.db.get('numTokens')
    try {
      this.numTokens = JSON.parse(numTokens)
    } catch (e) {
      this.numTokens = 1
    }
    return this.numTokens
  }

  public async syncBlocks() {
    await this.syncBlocksPart(utils.bigNumberify(3), false)
  }

  private async syncBlocksPart(blkNum: BigNumber, prevDoesExist: boolean) {
    const doesExist = await this.syncBlock(blkNum)
    // deposit block or submit block is exists
    if (prevDoesExist || doesExist) {
      await this.syncBlocksPart(blkNum.add(1), doesExist)
    }
  }

  private async syncBlock(blkNum: BigNumber) {
    const blockResult = await this.getBlock(blkNum)
    if (blockResult.isOk()) {
      const block = blockResult.ok()
      const tasks = block.txs.map(async tx => {
        await this.segmentChecker.spend(tx)
        await this.segmentChecker.insert(tx)
      })
      await Promise.all(tasks)
      return true
    } else {
      return false
    }
  }
}

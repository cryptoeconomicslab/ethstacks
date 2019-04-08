import {
  ExitableRangeManager,
  MapUtil,
  SignedTransactionWithProof
} from '@layer2/core'
import {
  IStorage
} from './IStorage'
import { Exit, TokenType, UserAction } from '../models';

export class WalletStorage {
  storage: IStorage
  private tokens: TokenType[]
  private utxos: Map<string, string>
  private exitList: Map<string, string>

  constructor(storage: IStorage) {
    this.storage = storage
    this.tokens = []
    this.utxos = new Map<string, string>()
    this.exitList = new Map<string, string>()
  }

  async init() {
    this.tokens = await this.loadTokens()
    this.utxos = await this.loadUTXO()
    this.exitList = await this.loadExits()
  }

  getStorage() {
    return this.storage
  }

  private async get(key: string, defaultValue: any): Promise<any> {
    try {
      const value = await this.storage.get(key)
      return JSON.parse(value)
    } catch(e) {
      return defaultValue
    }
  }

  private async set(key: string, value: any) {
    return this.storage.set(key, JSON.stringify(value))
  }

  async getLoadedPlasmaBlockNumber(): Promise<number> {
    return this.get('loadedBlockNumber', 0)
  }

  async setLoadedPlasmaBlockNumber(n: number) {
    await this.set('loadedBlockNumber', n)
  }

  addUTXO(tx: SignedTransactionWithProof) {
    this.utxos.set(tx.getOutput().hash(), JSON.stringify(tx.serialize()))
    this.storeMap('utxos', this.utxos)
  }

  /**
   * @ignore
   */
  private async loadTokens(): Promise<TokenType[]> {
    this.tokens = await this.get('tokens', [])
    return this.tokens
  }

  getTokens(): TokenType[] {
    return this.tokens
  }

  async addToken(id: number, address: string) {
    this.tokens[id] = {
      id: id,
      address: address
    }
    await this.set('tokens', this.tokens)
  }
  
  /**
   * @ignore
   */
  private async loadUTXO() {
    return this.loadMap<string>('utxos')
  }

  /**
   * @ignore
   */
  deleteUTXO(key: string) {
    this.utxos.delete(key)
    this.storeMap('utxos', this.utxos)
  }

  getUTXOList(): SignedTransactionWithProof[] {
    const arr: SignedTransactionWithProof[] = []
    this.utxos.forEach(value => {
      arr.push(SignedTransactionWithProof.deserialize(JSON.parse(value)))
    })
    return arr
  }

  setExit(exit: Exit) {
    this.exitList.set(exit.getId(), exit.serialize())
    this.storeMap('exits', this.exitList)    
  }
  
  deleteExit(id: string) {
    this.exitList.delete(id)
    this.storeMap('exits', this.exitList)
  }

  getExitList(): Exit[] {
    const arr: Exit[] = []
    this.exitList.forEach(value => {
      arr.push(Exit.deserialize(value))
    })
    return arr
  }
  
  getExit(exitId: string): Exit | null {
    const serialized = this.exitList.get(exitId)
    if(serialized)
      return Exit.deserialize(serialized)
    return null
  }

  /**
   * @ignore
   */
  private async loadExits() {
    return this.loadMap<string>('exits')
  }

  /**
   * @ignore
   */
  async loadExitableRangeManager() {
    const exitable = await this.get('exitable', [])
    return ExitableRangeManager.deserialize(exitable)
  }

  /**
   * @ignore
   */
  saveExitableRangeManager(
    exitableRangeManager: ExitableRangeManager
  ) {
    this.set('exitable', exitableRangeManager.serialize())
  }

  storeMap<T>(key: string, map: Map<string, T>) {
    this.set(key, MapUtil.serialize<T>(map))
  }
  
  async loadMap<T>(key: string) {
    return MapUtil.deserialize<T>(await this.get(key, {}))
  }

  async addUserAction(blkNum: number, action: UserAction) {
    await this.storage.addAction(action.id, blkNum, JSON.stringify(action))
  }

  async searchActions(blkNum: number): Promise<UserAction[]> {
    const data = await this.storage.searchActions(blkNum)
    return data.map(data => {
      const obj = JSON.parse(data.value)
      return {
        type: obj.type,
        id: obj.id,
        amount: obj.amount,
        address: obj.address,
        timestamp: obj.timestamp
      }
    })
  }

}

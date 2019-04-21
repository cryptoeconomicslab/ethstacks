import {
  ExitableRangeManager,
  MapUtil,
  SignedTransactionWithProof
} from '@layer2/core'
import { IStorage } from './IStorage'
import { Exit, TokenType, UserAction } from '../models'

export class WalletStorage {
  public storage: IStorage
  private tokens: TokenType[]
  private exitList: Map<string, string>

  constructor(storage: IStorage) {
    this.storage = storage
    this.tokens = []
    this.exitList = new Map<string, string>()
  }

  public async init() {
    this.tokens = await this.loadTokens()
    this.exitList = await this.loadExits()
  }

  public getStorage() {
    return this.storage
  }

  public async getLoadedPlasmaBlockNumber(): Promise<number> {
    return this.get('loadedBlockNumber', 0)
  }

  public async setLoadedPlasmaBlockNumber(n: number) {
    await this.set('loadedBlockNumber', n)
  }

  public getTokens(): TokenType[] {
    return this.tokens
  }

  public async addToken(id: number, address: string) {
    this.tokens[id] = {
      id,
      address
    }
    await this.set('tokens', this.tokens)
  }

  public async getState(): Promise<any> {
    return this.get('state', [])
  }

  public async setState(utxo: any) {
    this.set('state', utxo)
  }

  public setExit(exit: Exit) {
    this.exitList.set(exit.getId(), exit.serialize())
    this.storeMap('exits', this.exitList)
  }

  public deleteExit(id: string) {
    this.exitList.delete(id)
    this.storeMap('exits', this.exitList)
  }

  public getExitList(): Exit[] {
    const arr: Exit[] = []
    this.exitList.forEach(value => {
      arr.push(Exit.deserialize(value))
    })
    return arr
  }

  public getExit(exitId: string): Exit | null {
    const serialized = this.exitList.get(exitId)
    if (serialized) {
      return Exit.deserialize(serialized)
    }
    return null
  }

  /**
   * @ignore
   */
  public async loadExitableRangeManager() {
    const exitable = await this.get('exitable', [])
    return ExitableRangeManager.deserialize(exitable)
  }

  /**
   * @ignore
   */
  public saveExitableRangeManager(exitableRangeManager: ExitableRangeManager) {
    this.set('exitable', exitableRangeManager.serialize())
  }

  public storeMap<T>(key: string, map: Map<string, T>) {
    this.set(key, MapUtil.serialize<T>(map))
  }

  public async loadMap<T>(key: string) {
    return MapUtil.deserialize<T>(await this.get(key, {}))
  }

  public async addUserAction(blkNum: number, action: UserAction) {
    await this.storage.addAction(action.id, blkNum, JSON.stringify(action))
  }

  public async searchActions(blkNum: number): Promise<UserAction[]> {
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

  private async get(key: string, defaultValue: any): Promise<any> {
    try {
      const value = await this.storage.get(key)
      return JSON.parse(value)
    } catch (e) {
      return defaultValue
    }
  }

  private async set(key: string, value: any) {
    return this.storage.set(key, JSON.stringify(value))
  }

  /**
   * @ignore
   */
  private async loadTokens(): Promise<TokenType[]> {
    this.tokens = await this.get('tokens', [])
    return this.tokens
  }

  /**
   * @ignore
   */
  private async loadExits() {
    return this.loadMap<string>('exits')
  }
}

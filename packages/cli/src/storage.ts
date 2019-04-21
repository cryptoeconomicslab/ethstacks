import * as levelup from 'levelup'
import * as leveldown from 'leveldown'

import LevelUp = levelup.LevelUp
import { IStorage } from '@layer2/wallet'
import path from 'path'

export class FileStorage implements IStorage {
  public metaDb: LevelUp
  public proofDb: LevelUp
  public bhDb: LevelUp
  public path: string
  public actions: Map<number, string>

  constructor(basePath: string) {
    this.path = basePath
    const meta = leveldown.default(path.join(this.path, 'meta'))
    const proof = leveldown.default(path.join(this.path, 'proof'))
    const bh = leveldown.default(path.join(this.path, 'bh'))
    this.metaDb = levelup.default(meta)
    this.proofDb = levelup.default(proof)
    this.bhDb = levelup.default(bh)
    this.actions = new Map<number, string>()
  }

  public async set(key: string, value: string): Promise<boolean> {
    await this.metaDb.put(key, value)
    return true
  }
  public async get(key: string): Promise<string> {
    const value = await this.metaDb.get(key)
    if (value) {
      return String(value)
    } else {
      throw new Error(`key ${key} not found`)
    }
  }
  public async delete(key: string): Promise<boolean> {
    await this.metaDb.del(key)
    return true
  }
  public async addProof(
    key: string,
    blkNum: number,
    value: string
  ): Promise<boolean> {
    this.proofDb.put(key + '.' + blkNum, value)
    return Promise.resolve(true)
  }
  public async getProof(key: string, blkNum: number): Promise<string> {
    return this.proofDb.get(key + '.' + blkNum)
  }
  public async addBlockHeader(blkNum: number, value: string): Promise<boolean> {
    await this.bhDb.put(blkNum, value)
    return true
  }
  public async getBlockHeader(blkNum: number): Promise<string> {
    return this.bhDb.get(blkNum)
  }
  public async searchBlockHeader(
    fromBlkNum: number,
    toBlkNum: number
  ): Promise<Array<{ blkNum: number; value: string }>> {
    const blkNums = []
    for (let i = fromBlkNum; i < toBlkNum; i++) {
      blkNums.push(i)
    }
    const tasks = blkNums.map(async blkNum => {
      try {
        const blockHeader = await this.getBlockHeader(blkNum)
        return {
          blkNum,
          value: blockHeader
        }
      } catch (e) {
        return null
      }
    })
    const result = (await Promise.all(tasks)).filter(r => r != null)
    return result as (Array<{ blkNum: number; value: string }>)
  }
  public addAction(
    id: string,
    blkNum: number,
    value: string
  ): Promise<boolean> {
    this.actions.set(blkNum, value)
    return Promise.resolve(true)
  }
  public searchActions(
    blkNum: number
  ): Promise<Array<{ blkNum: number; value: string }>> {
    const arr: Array<{ blkNum: number; value: string }> = []
    this.actions.forEach((val, key) => {
      if (key >= blkNum) {
        arr.push({ blkNum: key, value: val })
      }
    })
    return Promise.resolve(arr)
  }
}

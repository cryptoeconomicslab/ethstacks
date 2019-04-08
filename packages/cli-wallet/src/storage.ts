import * as levelup from 'levelup'
import * as leveldown from 'leveldown'

import LevelUp = levelup.LevelUp
import { IStorage } from '@layer2/wallet'
import fs from 'fs'
import path from 'path'

export class FileStorage implements IStorage {
  db: LevelUp
  path: string
  data: Map<string, string>
  blockHeaders: Map<number, string>
  actions: Map<number, string>

  constructor(path: string) {
    this.path = path
    const down = leveldown.default(path)
    this.db = levelup.default(down)
    this.data = new Map<string, string>()
    this.blockHeaders = new Map<number, string>()
    this.actions = new Map<number, string>()
  }

  async set(key: string, value: string): Promise<boolean> {
    await this.db.put(key, value)
    return true
  }
  async get(key: string): Promise<string> {
    const value = await this.db.get(key)
    if(value) return String(value)
    else throw new Error(`key ${key} not found`)
  }
  async delete(key: string): Promise<boolean> {
    await this.db.del(key)
    return true
  }
  async addProof(key: string, blkNum: number, value: string): Promise<boolean> {
    this.data.set(key + '.' + blkNum, value)
    return Promise.resolve(true)
  }
  getProof(key: string, blkNum: number): Promise<string> {
    const value = this.data.get(key+ '.' + blkNum)
    if(value)
      return Promise.resolve(value)
    else
    return Promise.reject(new Error(`key ${key} not found`))
  }
  addBlockHeader(blkNum: number, value: string): Promise<boolean> {
    this.blockHeaders.set(blkNum, value)
    return Promise.resolve(true)
  }
  getBlockHeader(blkNum: number): Promise<string> {
    const value = this.blockHeaders.get(blkNum)
    if(value)
      return Promise.resolve(value)
    else
    return Promise.reject(new Error(`key ${blkNum} not found`))
  }
  searchBlockHeader(fromBlkNum: number, toBlkNum: number): Promise<{blkNum: number, value: string}[]> {
    const arr: {blkNum: number, value: string}[] = []
    this.blockHeaders.forEach((val, key) => {
      if(key >= fromBlkNum && key < toBlkNum)
        arr.push({blkNum: key, value: val})
    })
    return Promise.resolve(arr)
  }
  addAction(id: string, blkNum: number, value: string): Promise<boolean> {
    this.actions.set(blkNum, value)
    return Promise.resolve(true)
  }
  searchActions(blkNum: number): Promise<{blkNum: number, value: string}[]> {
    const arr: {blkNum: number, value: string}[] = []
    this.actions.forEach((val, key) => {
      if(key >= blkNum) {
        arr.push({blkNum: key, value: val})
      }
    })
    return Promise.resolve(arr)
  }

}
import { IStorage } from './IStorage'

export class BrowserStorage implements IStorage {
  public indexedDB: any
  public db: IDBDatabase | null = null

  constructor(dbName?: string) {
    this.indexedDB = window.indexedDB
    const request = window.indexedDB.open(dbName || 'proof', 3)
    request.onerror = event => {
      console.error('error at opening indexedDB', event)
    }
    request.onsuccess = event => {
      this.db = (event.target as IDBRequest).result
    }
    request.onupgradeneeded = event => {
      const db = (event.target as IDBRequest).result
      const PlasmaBlockHeaderStore = db.createObjectStore('PlasmaBlockHeader', {
        keyPath: 'id'
      })
      PlasmaBlockHeaderStore.createIndex('blkNum', 'blkNum', { unique: false })
      const proofStore = db.createObjectStore('proof', { keyPath: 'id' })
      proofStore.createIndex('utxoKey', 'utxoKey', { unique: false })
      const userActionStore = db.createObjectStore('UserAction', {
        keyPath: 'id'
      })
      userActionStore.createIndex('blkNum', 'blkNum', { unique: false })
    }
  }

  public set(key: string, item: string) {
    window.localStorage.setItem(key, item)
    return Promise.resolve(true)
  }

  public get(key: string) {
    const value = window.localStorage.getItem(key)
    if (value !== null) {
      return Promise.resolve(value)
    } else {
      throw new Error(`$key {key} not found`)
    }
  }

  public delete(key: string) {
    window.localStorage.deleteItem(key)
    return Promise.resolve(true)
  }

  public addProof(key: string, blkNum: number, value: string) {
    const storeName = 'proof'
    this.getDB()
      .transaction(storeName, 'readwrite')
      .objectStore(storeName)
      .add({
        id: key + '.' + blkNum,
        utxoKey: key,
        blkNum,
        value
      })
    return Promise.resolve(true)
  }

  public getProof(key: string, blkNum: number): Promise<string> {
    const storeName = 'proof'
    const request = this.getDB()
      .transaction(storeName, 'readwrite')
      .objectStore(storeName)
      .get(key + '.' + blkNum)
    return new Promise((resolve, reject) => {
      request.onerror = function(event) {
        reject(event)
      }
      request.onsuccess = function(event) {
        try {
          resolve(request.result.value)
        } catch (e) {
          reject(e)
        }
      }
    })
  }

  public addBlockHeader(blkNum: number, value: string) {
    const storeName = 'PlasmaBlockHeader'
    this.getDB()
      .transaction(storeName, 'readwrite')
      .objectStore(storeName)
      .add({
        id: blkNum,
        blkNum,
        value
      })
    return Promise.resolve(true)
  }

  public getBlockHeader(blkNum: number): Promise<string> {
    const storeName = 'PlasmaBlockHeader'
    const request = this.getDB()
      .transaction(storeName, 'readwrite')
      .objectStore(storeName)
      .get(blkNum)
    return new Promise((resolve, reject) => {
      request.onerror = function(event) {
        reject(event)
      }
      request.onsuccess = function(event) {
        resolve(request.result.value)
      }
    })
  }

  public searchBlockHeader(
    fromBlkNum: number,
    toBlkNum: number
  ): Promise<any[]> {
    const storeName = 'PlasmaBlockHeader'
    const range = IDBKeyRange.bound(fromBlkNum, toBlkNum)
    return new Promise((resolve, reject) => {
      const proofs: any[] = []
      this.getDB()
        .transaction(storeName, 'readonly')
        .objectStore(storeName)
        .index('blkNum')
        .openCursor(range).onsuccess = function(event) {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          proofs.push(cursor.value)
          cursor.continue()
        } else {
          resolve(
            proofs.map(p => {
              return { blkNum: p.blkNum, value: p.value }
            })
          )
        }
      }
    })
  }

  public addAction(id: string, blkNum: number, value: string) {
    const storeName = 'UserAction'
    this.getDB()
      .transaction(storeName, 'readwrite')
      .objectStore(storeName)
      .add({
        id,
        blkNum,
        value
      })
    return Promise.resolve(true)
  }

  public searchActions(blkNum: number): Promise<any[]> {
    const storeName = 'UserAction'
    const range = IDBKeyRange.lowerBound(blkNum)
    return new Promise((resolve, reject) => {
      const proofs: any[] = []
      this.getDB()
        .transaction(storeName, 'readonly')
        .objectStore(storeName)
        .index('blkNum')
        .openCursor(range).onsuccess = function(event) {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          proofs.push(cursor.value)
          cursor.continue()
        } else {
          resolve(
            proofs.map(p => {
              return { blkNum: p.blkNum, value: p.value }
            })
          )
        }
      }
    })
  }

  private getDB(): IDBDatabase {
    if (this.db) {
      return this.db
    } else {
      throw new Error('DB was not initilized')
    }
  }
}

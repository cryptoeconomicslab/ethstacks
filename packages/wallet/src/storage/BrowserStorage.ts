import { IStorage } from './IStorage'
import indexedDB from 'fake-indexeddb'
import localStorage from 'localStorage'

let _indexedDB, _localStorage:Storage;
if(typeof window !== 'undefined'){
  _indexedDB = window.indexedDB,
  _localStorage = window.localStorage
} else {
  _indexedDB = indexedDB
  _localStorage = localStorage
}


export class BrowserStorage implements IStorage {
  indexedDB: any
  db: IDBDatabase | null = null

  constructor(dbName?: string) {
    this.indexedDB = _indexedDB
    const request = this.indexedDB.open(dbName || 'proof', 3);
    request.onerror = (event) => {
      console.error('error at opening indexedDB', event);
    };
    request.onsuccess = (event) => {
      this.db = (<IDBRequest>event.target).result
    };
    request.onupgradeneeded = (event) => {
      const db = (<IDBRequest>event.target).result
      const PlasmaBlockHeaderStore = db.createObjectStore('PlasmaBlockHeader', { keyPath: 'id' })
      PlasmaBlockHeaderStore.createIndex('blkNum', 'blkNum', { unique: false })
      const proofStore = db.createObjectStore('proof', { keyPath: 'id' })
      proofStore.createIndex('utxoKey', 'utxoKey', { unique: false })
      const userActionStore = db.createObjectStore('UserAction', { keyPath: 'id' })
      userActionStore.createIndex('blkNum', 'blkNum', { unique: false })
    }

  }

  set(key: string, item: string) {
    _localStorage.setItem(key, item)
    return Promise.resolve(true)
  }

  get(key: string) {
    const value = _localStorage.getItem(key)
    if(value !== null) {
      return Promise.resolve(value)
    } else {
      throw new Error(`$key {key} not found`)
    }
  }

  delete(key: string) {
    _localStorage.deleteItem(key)
    return Promise.resolve(true)
  }

  private getDB(): IDBDatabase {
    if(this.db) {
      return this.db
    } else {
      throw new Error('DB was not initilized')
    }
  }

  addProof(key: string, blkNum: number, value: string) {
    const storeName = 'proof';
    this.getDB().transaction(storeName, 'readwrite')
      .objectStore(storeName)
      .add({
        id: key + '.' + blkNum,
        utxoKey: key,
        blkNum: blkNum,
        value: value
      });
    return Promise.resolve(true)
  }

  getProof(key: string, blkNum: number): Promise<string> {
    const storeName = 'proof'
    const request = this.getDB().transaction(storeName, 'readwrite')
      .objectStore(storeName)
      .get(key + '.' + blkNum);
    return new Promise((resolve, reject) => {
      request.onerror = function(event) {
        reject(event);
      };
      request.onsuccess = function(event) {
        try {
          resolve(request.result.value);
        } catch (e) {
          reject(e)
        }
      };
    });
  }

  addBlockHeader(blkNum: number, value: string) {
    const storeName = 'PlasmaBlockHeader';
    this.getDB().transaction(storeName, 'readwrite')
      .objectStore(storeName)
      .add({
        id: blkNum,
        blkNum: blkNum,
        value: value
      });
    return Promise.resolve(true)
  }

  getBlockHeader(blkNum: number): Promise<string> {
    const storeName = 'PlasmaBlockHeader'
    const request = this.getDB().transaction(storeName, 'readwrite')
      .objectStore(storeName)
      .get(blkNum);
    return new Promise((resolve, reject) => {
      request.onerror = function(event) {
        reject(event);
      };
      request.onsuccess = function(event) {
        resolve(request.result.value);
      };
    });
  }

  searchBlockHeader(fromBlkNum: number, toBlkNum: number): Promise<any[]> {
    const storeName = 'PlasmaBlockHeader';
    const range = IDBKeyRange.bound(fromBlkNum, toBlkNum);
    return new Promise((resolve, reject) => {
      let proofs: any[] = [];
      this.getDB().transaction(storeName, 'readonly')
        .objectStore(storeName)
        .index('blkNum')
        .openCursor(range).onsuccess = function(event) {
          var cursor = (<IDBRequest>event.target).result
          if (cursor) {
            proofs.push(cursor.value);
            cursor.continue();
          } else {
            resolve(proofs.map(p => {
              return {blkNum: p.blkNum, value: p.value}
            }));
          }
        };
    });
  }

  addAction(
    id: string,
    blkNum: number,
    value: string
  ) {
    const storeName = 'UserAction';
    this.getDB().transaction(storeName, 'readwrite')
      .objectStore(storeName)
      .add({
        id: id,
        blkNum: blkNum,
        value: value
      });
    return Promise.resolve(true)
  }

  searchActions(
    blkNum: number
  ): Promise<any[]> {
    const storeName = 'UserAction';
    const range = IDBKeyRange.lowerBound(blkNum);
    return new Promise((resolve, reject) => {
      let proofs: any[] = [];
      this.getDB().transaction(storeName, 'readonly')
        .objectStore(storeName)
        .index('blkNum')
        .openCursor(range).onsuccess = function(event) {
          var cursor = (<IDBRequest>event.target).result
          if (cursor) {
            proofs.push(cursor.value);
            cursor.continue();
          } else {
            resolve(proofs.map(p => {
              return {blkNum: p.blkNum, value: p.value}
            }));
          }
        };
    });
  }
  

}

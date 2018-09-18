const Trie = require('merkle-patricia-tree');
const levelup = require('levelup');
const leveldown = require('leveldown');

class Snapshot {
  
  constructor() {
  }
  setDB(db){
    this.db = db;
    this.contTrie = new Trie(db); 
  }

  /**
   * apply transaction to contract
   * @param {*} tx Transaction
   */
  applyTx(tx) {
    return Promise.all(tx.inputs.map((i) => {
      return this.contains(i);
    })).then((results) => {
      if(results.filter(b => !b).length < 0) {
        throw new Error('input not found');
      }
      return Promise.all(tx.outputs.map((i) => {
        return this.insertId(i);
      }));
    })
  }

  /**
   * contains contract or not
   * @param {*} id SnapshotId of contract
   */
  contains(id) {
    return new Promise((resolve, reject) => {
      this.contTrie.get(id, (err, value) => {
        if(err || value == null) {
          resolve(false);
        }else{
          resolve(true);
        }
      });
    })
  }

  /**
   * insert contract
   * @param {*} id SnapshotId of contract
   */
  insertId(id) {
    return new Promise((resolve, reject) => {
      this.contTrie.put(id, id, () => {
        resolve()
      });
    })
  }


}

module.exports = Snapshot



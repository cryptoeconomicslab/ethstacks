const Trie = require('merkle-patricia-tree');

class Snapshot {
  
  constructor() {
  }
  setDB(db){
    this.db = db;
    this.contTrie = new Trie(db); 
    this.contTrie.revert();
  }
  
  getRoot() {
    return this.contTrie.root.toString('hex');
  }
  
  setRoot(root) {
    this.contTrie = new Trie(this.db, Buffer.from(root, 'hex'));
  }

  /**
   * apply transaction to UTXO snapshot store
   * @param {*} tx Transaction
   */
  applyTx(tx, blkNum) {
    return Promise.all(tx.inputs.map((i) => {
      console.log('check', i.toJson(), i.hash());
      const id = i.hash();
      return this.contains(id);
    })).then((isContains) => {
      if(isContains.indexOf(false) >= 0) {
        throw new Error('input not found');
      }else{
        return Promise.all(tx.inputs.map((i) => {
          return this.deleteId(i.hash());
        }));
      }
    }).then(() => {
      return Promise.all(tx.outputs.map((o) => {
        console.log('insert', o.toJson(), blkNum, o.getBytes(blkNum).toString('hex'), o.hash(blkNum).toString('hex'));
        return this.insertId(o.hash(blkNum));
      }));
    }).then(() => {
      return Promise.resolve(tx);
    }).catch((e) => {
      console.error(e);
      return Promise.resolve(null);
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
   * delete contract
   * @param {*} id SnapshotId of contract
   */
  deleteId(id) {
    return new Promise((resolve, reject) => {
      this.contTrie.del(id, () => {
        resolve(true);
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
  
  commit() {
    return new Promise((resolve, reject) => {
      this.contTrie.checkpoint();
      this.contTrie.commit(() => {
        resolve();
      });
    })
  }

}

module.exports = Snapshot



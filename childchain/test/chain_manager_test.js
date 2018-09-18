const assert = require('assert');
const ChainManager = require('../lib/chain_manager');
const chainManager = new ChainManager();
const Block = require('../lib/block');
const Transaction = require('../lib/tx');
const levelup = require('levelup');
const leveldown = require('leveldown');


describe('ChainManager', function() {
  describe('start', function() {
    before(done=>{
      const blockDB = levelup(leveldown('./.blockdb'));
      const metaDB = levelup(leveldown('./.metadb'));
      const snapshotDB = levelup(leveldown('./.snapshotdb'));
      metaDB.put("blockHeight", "1")
      .then(_=> blockDB.put(1, JSON.stringify(new Block(1))) )
      .then(_=> metaDB.put("commitmentTxs", JSON.stringify([new Transaction()])) )
      .then(_=>{
        blockDB.close();
        metaDB.close();
        snapshotDB.close();
        done();
      })
    })
    it('should have properties', function(done) {
      chainManager.start().then(chain=>{
        assert(chain.id.length > 0);
        assert(chain.blockHeight > 0);
        assert(chain.block.number > 0);
        assert(chain.commitmentTxs.length >= 0);
        chainManager.stop();
        done();
      })
    }).timeout(2000);
  });
});

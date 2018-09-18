const Chain = require("./chain");
const Block = require("./block");
const Snapshot = require("./state/snapshot")
const levelup = require('levelup');
const leveldown = require('leveldown');

class ChainManager {
    constructor(){
        this.chain = null;
    }
    async start (){
        const blockDB = levelup(leveldown('./.blockdb'));
        const metaDB = levelup(leveldown('./.metadb'));
        const snapshotDB = levelup(leveldown('./.snapshotdb'));
        const childChain = new Chain();
        childChain.setMetaDB(metaDB);
        childChain.setBlockDB(blockDB);

        //DEBUG for making initial DB
        // childChain.blockHeight = 20;
        // await childChain.generateBlock()

        const snapshot = new Snapshot();
        snapshot.setDB(snapshotDB);
        childChain.setSnapshot(snapshot);
        await childChain.setChainID("NKJ23H3213WHKHSAL");
        await childChain.resume();
        this.chain = childChain;
        return childChain;
    }
    async stop(){
        this.chain.gracefulStop();
    }

}

module.exports = ChainManager

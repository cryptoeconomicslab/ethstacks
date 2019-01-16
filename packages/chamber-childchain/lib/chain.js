const Snapshot = require('./state/snapshot');
const {
  BufferUtils,
  Block,
  TransactionOutput,
  Transaction
} = require('@cryptoeconomicslab/chamber-core');
const RLP = require('rlp');
const ChainEvent = require('./chainevent');
const Verifier = require('./verifier');
const {
  OWN_STATE
} = require('./verifier/std');
const BigNumber = require('bignumber.js');
const StandardVerificator = 0;

class Chain {
  
  constructor() {
    this.id = null;
    this.block = null;
    this.commitmentTxs = []; // TxVM idiom. Eq pendingTx
    this.snapshot = new Snapshot();
    this.events = new ChainEvent(); // EventEmitter
    this.blockHeight = 0;
    this.seenEvents = {};
  }
  setMetaDB(metaDB){
    this.metaDB = metaDB;
  }
  setBlockDB(blockDB){
    this.blockDB = blockDB;
  }
  async setChainID(chainID){
    this.id = chainID;//eq with Operator's Address. See Rootchain.sol
    await this.metaDB.put("chainID", chainID);
  }
  setSnapshot(snapshot){
    this.snapshot = snapshot;
  }
  emit(eventName, payload){
    this.events.emit(eventName, payload)
  }

  /**
   * apply deposit event
   * @param {*} event event object of web3
   */
  async applyDeposit(event) {
    const returnValues = event.returnValues;
    const tx = this.createDepositTx(
      returnValues.depositor,
      returnValues.start,
      returnValues.end,
      returnValues.depositBlock
    );
    this.blockHeight++;
    const blkNum = this.blockHeight;
    await this.saveBlockHeight();
    const appliedTx = await this.snapshot.applyTx(tx, blkNum);
    if(appliedTx) {
      const newBlock = new Block(blkNum, true);
      newBlock.appendTx(tx)
      await this.saveBlock(newBlock);
  
      this.emit("Deposited", {
        type: "deposit",
        payload: tx
      });
      // this.emit("BlockGenerated", { payload: newBlock })
    }
  }
  
  createDepositTx(depositor, start, end, depositBlock) {
    const output = new TransactionOutput(
      [new Buffer(depositor.substr(2), 'hex')],
      [{start: BigNumber(start), end: BigNumber(end)}],
      [OWN_STATE]
    );
    const depositTx = new Transaction(
      StandardVerificator,
      0,        // label
      [],       // args
      0,        // nonce,
      [],       // inputs
      [output]  // outputs
    );
    return depositTx;
  }

  /**
   * exitStarted
   * @param {*} event ExitStarted event object of web3
   * Please see https://github.com/cryptoeconomicslab/plasma-chamber/blob/aa97f2ae1a99e919a10e25fe821ee55e40d29bfb/packages/chamber-rootchain/contracts/RootChain.sol#L30
   */
  async exitStarted(event) {
    const txo = exitTxoToTransactionOutput(event.returnValues);
    console.log(txo.toJson(), txo.getBytes().toString('hex'));
    await this.snapshot.deleteId(txo.hash());
  }

  /**
   * 
   * @param {ExitTxo} exitTxo JSON array style of exitTxo structure see https://github.com/cryptoeconomicslab/plasma-chamber/blob/aa97f2ae1a99e919a10e25fe821ee55e40d29bfb/packages/chamber-rootchain/contracts/RootChain.sol#L105
   * @return {TransactionOutput} see https://github.com/cryptoeconomicslab/plasma-chamber/blob/master/packages/chamber-core/src/tx.js#L6
   */
  static exitTxoToTransactionOutput(exitTxo) {
    // returnValues
    const valueArr = exitTxo.output[1];
    const values = [];
    for(var i = 0;i < valueArr.length;i += 2) {
      values.push({
        start: BigNumber(valueArr[i]),
        end: BigNumber(valueArr[i + 1])
      });
    }
    const state = RLP.decode(BufferUtils.hexToBuffer(exitTxo.output[2]));
    return new TransactionOutput(
      exitTxo.output[0],
      values,
      state.length == 0 ? [BufferUtils.bufferToNum(state)] : [BufferUtils.bufferToNum(state[0])].concat(state.slice(1)),
      parseInt(exitTxo.output[3]),
    );
  }

  createTx(txData) {
    // decode signedTx
    const tx = Transaction.fromBytes(new Buffer(txData, 'hex'));
    // check signatures
    // check state transition
    // TODO
    // applyTx to snapshot
    this.commitmentTxs.push(tx);
    return tx.hash();
  }
  
  /**
   * generate block
   */
  async generateBlock() {
    if(this.commitmentTxs.length == 0) {
      return;
    }
    const commitmentTxs = [].concat(this.commitmentTxs);
    this.commitmentTxs = []
    this.blockHeight++;
    await this.saveCommitmentTxs();
    await this.saveBlockHeight();

    const newBlock = new Block(this.blockHeight);
    const passedTxs = await Chain.checkTxs(
      commitmentTxs,
      this.snapshot,
      this.blockHeight
    );
    const appendedTxs = passedTxs
      .filter(tx => !!tx)
      .map((tx) => newBlock.appendTx(tx));
    
    if(appendedTxs.length === 0) {
      // TODO: revert
    }

    newBlock.setStateRoot(this.snapshot.getRoot());
    await this.saveBlock(newBlock); //async func

    this.emit("BlockGenerated", { payload: newBlock })
  }

  static async checkTxs(commitmentTxs, snapshot, blockHeight) {
    return Promise.all(commitmentTxs
      .filter((tx) => !!Verifier.verify(tx) )
      .map((tx) => {
        return snapshot.applyTx(tx, blockHeight);
      }));
  }

  /*
  * Fail-safe for sudden chain crash, resume functions
  * */
  async resume(){
    // leveldb stored string as buffer
    try {
      this.id = (await this.metaDB.get("chainID")).toString()
      this.blockHeight = parseInt((await this.metaDB.get("blockHeight")).toString())
      this.block = JSON.parse((await this.blockDB.get(this.blockHeight)).toString())
      if(this.block.stateRoot) {
        this.snapshot.setRoot(this.block.stateRoot);
      }
      this.seenEvents = JSON.parse((await this.metaDB.get("seenEvents")).toString());
      this.commitmentTxs = JSON.parse((await this.metaDB.get("commitmentTxs")).toString())
    } catch (err) {
      if(err.notFound) {
        this.blockHeight = 0;
        this.block = null;
        // there are no inflight transactions?
        this.commitmentTxs = [];
      }else{
        throw err;
      }
    }
  }
  async saveBlock(newBlock){
    await this.blockDB.put(newBlock.number, newBlock.toString());
  }
  async saveBlockHeight(){
    await this.metaDB.put("blockHeight", this.blockHeight);
  }
  async saveCommitmentTxs(){
    await this.metaDB.put("commitmentTxs", JSON.stringify(this.commitmentTxs));
  }
  async saveSeenEvents(seenEvents) {
    this.seenEvents = seenEvents;
    await this.metaDB.put("seenEvents", JSON.stringify(seenEvents));
  }
  getSeenEvents() {
    return this.seenEvents;
  }

  async getBlock(blockHeight) {
    const blockStr = await this.blockDB.get(blockHeight);
    return Block.fromString(blockStr).toJson();
  }

  gracefulStop(){
    return new Promise((resolve, reject) => {
      this.blockDB.close(_=>{
        this.metaDB.close(_=>{
          this.snapshot.db.close(_=>{
            resolve();
          });
        });
      });
    })
  }

}

module.exports = Chain

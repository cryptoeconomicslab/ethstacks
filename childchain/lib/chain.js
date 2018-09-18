const Block = require('./block');
const { VMHash } = require('../../vm/lib/operations/crypto');
const { assembleSource, PlasmaStateContract, PlasmaStateValue } = require('../../vm');
const Snapshot = require('./state/snapshot');
const Transaction = require('./tx');
const ChainEvent = require('./chainevent');

class Chain {
  
  constructor() {
    this.id = null;
    this.block = null;
    this.commitmentTxs = []; // TxVM idiom. Eq pendingTx
    this.snapshot = new Snapshot();
    this.events = new ChainEvent(); // EventEmitter
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
  applyDeposit(event) {
    const returnValues = event.returnValues;
    const tx = this.createDepositTx(
      returnValues.depositor,
      returnValues.amount,
      returnValues.depositBlock
    );
    this.commitmentTxs.push(tx);
    this.emit("TxAdded", {
      type: "deposit",
      payload: tx
    });
  }
  
  createDepositTx(depositor, amount, depositBlock) {
    const prog = assembleSource('[put [txid 1 roll get 0 checksig verify] yield]');
    const stack = [
      new PlasmaStateValue(amount, new Buffer('d073785d7dffc98c69ef62bbc6c8efde78a3286a848f570f8028695048a8f62d', 'hex', 'anchor')).encode(),
      depositor
    ];
    const contract = new PlasmaStateContract('C', 'contractseed', prog, stack);
    const encoded = contract.snapshot();
    const id = VMHash("SnapshotID", encoded[0]);
    this.snapshot.insertId(id);
    const depositTx = new Transaction();
    depositTx.outputs.push(id);
    return depositTx;
  }
  
  /**
   * generate block
   */
  async generateBlock() {
    this.blockHeight++;
    await this.saveBlockHeight(); //async func

    const newBlock = new Block(this.blockHeight);
    this.commitmentTxs
      .filter((tx) => !!this.snapshot.applyTx(tx) )
      .forEach((tx) => newBlock.appendTx(tx) );
    await this.saveBlock(newBlock); //async func

    this.commitmentTxs = []
    await this.saveCommitmentTxs();

    this.emit("BlockGenerated", { payload: newBlock })
  }

  /*
  * Fail-safe for sudden chain crash, resume functions
  * */
  async resume(){
    // leveldb stored string as buffer
    this.id = (await this.metaDB.get("chainID")).toString()
    this.blockHeight = parseInt((await this.metaDB.get("blockHeight")).toString())
    this.block = JSON.parse((await this.blockDB.get(this.blockHeight)).toString())
    console.log("Chain.resume}||||||||||||||||||||||",(await this.metaDB.get("commitmentTxs")).toString())
    this.commitmentTxs = JSON.parse((await this.metaDB.get("commitmentTxs")).toString())
  }
  async saveBlock(newBlock){
    await this.blockDB.put(this.blockHeight, newBlock.toString());
  }
  async saveBlockHeight(){
    await this.metaDB.put("blockHeight", this.blockHeight);
  }
  async saveCommitmentTxs(){
    await this.metaDB.put("commitmentTxs", JSON.stringify(this.commitmentTxs));
  }
  gracefulStop(){
    this.blockDB.close();
    this.metaDB.close();
    this.snapshot.db.close();
  }

}

module.exports = Chain

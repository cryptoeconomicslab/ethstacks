const assert = require('assert');
const ChainManager = require('../lib/chain_manager');
const Chain = require('../lib/chain');
const {
  TransactionOutput,
  Transaction
} = require('@cryptoeconomicslab/chamber-core');
const chainManager = new ChainManager();
const Snapshot = require('../lib/state/snapshot');
const Listener = require('@cryptoeconomicslab/chamber-listener');
const memdown = require('memdown');
const utils = require('ethereumjs-util');
const testData = require('./testdata');
const BigNumber = require('bignumber.js');

describe('Chain', function() {

  const depositor = '0x627306090abab3a6e1400e9345bc60c78a8bef57';
  const uid = new BigNumber(0x123);

  describe('applyDeposit()', function() {
    it('should apply deposit', function(done) {
      chainManager.start({
        blockdb: memdown(),
        metadb: memdown(),
        snapshotdb: memdown()
      }).then(chain=>{
        const initialBlockHeight = chain.blockHeight;

        chain.applyDeposit({
          returnValues: {
            depositor: depositor,
            start: 0,
            end: 2
          }
        })
  
        setTimeout(_=>{
          assert(initialBlockHeight + 1 === chain.blockHeight);
          chainManager.stop();
          done();
        }, 1500)
      })
    }).timeout(2000);
  });

  describe('getBlock()', function() {
    it('should getBlock', function(done) {
      chainManager.start({
        blockdb: memdown(),
        metadb: memdown(),
        snapshotdb: memdown()
      }).then(chain=>{
        chain.applyDeposit({
          returnValues: {
            depositor: depositor,
            start: 0,
            end: 2
          }
        }).then(() => {
          return chain.getBlock(chain.blockHeight);
        }).then(block => {
          assert(block.number === chain.blockHeight);
          assert(block.txs.length === 1);
          chainManager.stop();
          done();
        }).catch(e => {
          console.error(e)
        })
      })
    }).timeout(2000);
  });

  describe('checkTx()', function() {

    const coinId1 = {start:0, end:1};
    const privKey1 = testData.privKey1;
    const privKey2 = testData.privKey2;
    const testAddress1 = utils.privateToAddress(privKey1);
    const testAddress2 = utils.privateToAddress(privKey2);
    const standardVerificator = 0;
    const input = new TransactionOutput(
      [testAddress1],
      [coinId1],
      [0],
      1
    );
    const invalidInput = new TransactionOutput(
      [testAddress2],
      [coinId1],
      [0],
      1
    );
    const output = new TransactionOutput(
      [testAddress2],
      [coinId1],
      [0]
    );
    const depositTx = new Transaction(
      standardVerificator,
      0,    // label
      [testAddress2],  // args
      1,     // nonce,
      [],
      [input]
    );
    const tx = new Transaction(
      standardVerificator,
      0,    // label
      [testAddress2],  // args
      1,     // nonce,
      [input],
      [output]
    );
    const invalidTx = new Transaction(
      standardVerificator,
      0,    // label
      [testAddress2],  // args
      1,     // nonce,
      [invalidInput],
      [output]
    );
    const snapshot = new Snapshot();
    snapshot.setDB(memdown());

    beforeEach(async function () {
      await snapshot.applyTx(depositTx);
    });

    it('should chech transaction', async function() {
      const sign = tx.sign(privKey1);
      tx.sigs.push(sign);
      const commitmentTxs = [tx];
      const blkNum = 2;
      const passedTxs = await Chain.checkTxs(commitmentTxs, snapshot, blkNum);
      assert(Buffer.compare(passedTxs[0].hash(), tx.hash()) === 0);
    });

    it('should failed to check transaction', async function() {
      const sign = invalidTx.sign(privKey1);
      tx.sigs.push(sign);
      const commitmentTxs = [invalidTx];
      const blkNum = 2;
      const passedTxs = await Chain.checkTxs(commitmentTxs, snapshot, blkNum);
      assert(passedTxs.length == 0);
    });

  });

  describe('exitTxoToTransactionOutput()', function() {
    const segment = {start:0, end:100000};
    const privKey1 = testData.privKey1;
    const testAddress1 = utils.privateToAddress(privKey1);
    const output = new TransactionOutput(
      [testAddress1],
      [segment],
      [0]
    );
    const blkNum = 10;

    it('should success to get UTXO', async function() {
      const exitTxo = {
        output: [
          [testAddress1],
          ['0', '100000'],
          '0xc1',
          '10'
        ]
      };
      assert.equal(
        output.hash(blkNum).toString('hex'),
        Chain.exitTxoToTransactionOutput(exitTxo).hash().toString('hex')
      )
    });

  });

});

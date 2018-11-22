const { injectInTruffle } = require('sol-trace');
injectInTruffle(web3, artifacts);

const TxVerificationTest = artifacts.require('TxVerificationTest');

const {
  BufferUtils,
  Transaction,
  TransactionOutput
} = require('../../childchain/lib/tx');
const utils = require('ethereumjs-util');
const BigNumber = require('bignumber.js');
const RLP = require('rlp');

contract('TxVerificationTest', function ([user, owner, recipient, user4, user5]) {

  const privKey1 = new Buffer('c87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3', 'hex')
  const privKey2 = new Buffer('ae6ae8e5ccbfb04590405997ee2d52d2b330726137b875053c36d94e974d162f', 'hex')
  const testAddress1 = utils.privateToAddress(privKey1);
  const testAddress2 = utils.privateToAddress(privKey2);
  const CHUNK_SIZE = BigNumber('1000000000000000000');
  const coin1Id = {start: 0, end: CHUNK_SIZE.minus(1)};
  const gasLimit = 200000;

  beforeEach(async function () {
    this.txVerificationTest = await TxVerificationTest.new();
  });

  describe('verifyTransaction', function () {

    it('should verify transaction', async function () {
      const input = new TransactionOutput(
        [testAddress1],
        [coin1Id],
        [0],
        0
      );
      const output = new TransactionOutput(
        [testAddress2],
        [coin1Id],
        [0]
      );
      const tx = new Transaction(
        0,
        [testAddress2],
        new Date().getTime(),
        [input],
        [output]
      );
      let txBytes = tx.getBytes();
      const sign = tx.sign(privKey1)
      const result = await this.txVerificationTest.verifyTransaction(
        utils.bufferToHex(txBytes),
        utils.bufferToHex(sign),
        {from: user, gas: gasLimit});
      assert.equal(result, 0);
    });

    it('should verify split', async function () {
      const seg1 = {start: 0, end: CHUNK_SIZE};
      const seg2 = {start: 0, end: 100000};
      const seg3 = {start: 100000, end: CHUNK_SIZE};
      const input = new TransactionOutput(
        [testAddress1],
        [seg1],
        [0],
        0
      );
      const output1 = new TransactionOutput(
        [testAddress2],
        [seg2],
        [0]
      );
      const output2 = new TransactionOutput(
        [testAddress1],
        [seg3],
        [0]
      );
      const tx = new Transaction(
        1,
        [testAddress2, BufferUtils.numToBuffer(100000)],
        new Date().getTime(),
        [input],
        [output1, output2]
      );
      let txBytes = tx.getBytes();
      const sign = tx.sign(privKey1)
      const result = await this.txVerificationTest.verifyTransaction(
        utils.bufferToHex(txBytes),
        utils.bufferToHex(sign),
        {from: user, gas: gasLimit});
      assert.equal(result, 0);
    });


    it('should verify multisig', async function () {
      const seg1 = {start: 0, end: CHUNK_SIZE};
      const seg2 = {start: CHUNK_SIZE, end: CHUNK_SIZE.times(2)};
      const p1 = Buffer.from('12345678ab', 'hex');
      const p2 = Buffer.from('ab12345678', 'hex');
      const h1 = utils.sha3(p1);
      const h2 = utils.sha3(p2);
      const input1 = new TransactionOutput(
        [testAddress1],
        [seg1],
        [0],
        0
      );
      const input2 = new TransactionOutput(
        [testAddress2],
        [seg2],
        [0],
        0
      );
      const output = new TransactionOutput(
        [testAddress1, testAddress2],
        [seg1, seg2],
        [12, h1, h2]
      );
      const tx = new Transaction(
        12,
        [h1, h2],
        new Date().getTime(),
        [input1, input2],
        [output]
      );
      let txBytes = tx.getBytes();
      const sign1 = tx.sign(privKey1)
      const sign2 = tx.sign(privKey2)
      const result = await this.txVerificationTest.verifyTransaction(
        utils.bufferToHex(txBytes),
        utils.bufferToHex(Buffer.concat([sign1, sign2])),
        {from: user, gas: gasLimit});
      assert.equal(result, 0);
    });

    it('should verify game transaction', async function () {
      const input = new TransactionOutput(
        [testAddress1],
        [coin1Id],
        [testAddress1, testAddress2, BufferUtils.numToBuffer(3), BufferUtils.numToBuffer(0)],
        0,0,0
      );
      const output = new TransactionOutput(
        [testAddress2],
        [coin1Id],
        [testAddress2, testAddress1, BufferUtils.numToBuffer(4), BufferUtils.numToBuffer(0)]
      );
      const tx = new Transaction(
        100,
        [BufferUtils.numToBuffer(0), BufferUtils.numToBuffer(1)],
        new Date().getTime(),
        [input],
        [output]
      );
      let txBytes = tx.getBytes();
      const sign = tx.sign(privKey1)
      const result = await this.txVerificationTest.verifyTransaction(
        utils.bufferToHex(txBytes),
        utils.bufferToHex(sign),
        {from: user, gas: gasLimit});
      assert.equal(result, 0);
    });

  });


});

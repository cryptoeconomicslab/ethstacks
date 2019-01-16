const { injectInTruffle } = require('sol-trace');
injectInTruffle(web3, artifacts);

const MultisigGame = artifacts.require('MultisigGame');
const TxVerificationTest = artifacts.require('TxVerificationTest');

const {
  Constants,
  Transaction,
  TransactionOutput
} = require('@cryptoeconomicslab/chamber-core');
const utils = require('ethereumjs-util');
const {
  privKey1,
  privKey2
} = require('./TestData');

contract('MultisigGame', function ([user, owner, recipient, user4, user5]) {

  const testAddress1 = utils.privateToAddress(privKey1);
  const testAddress2 = utils.privateToAddress(privKey2);
  const CHUNK_SIZE = Constants.CHUNK_SIZE;
  const gasLimit = 300000;
  const StoneScissorPaperLabel = 21;
  const StoneScissorPaperRevealLabel = 22;

  beforeEach(async function () {
    this.multisigGame = await MultisigGame.new();
    this.txVerificationTest = await TxVerificationTest.new();
  });

  describe('multisig', function () {

    const seg1 = {start: 0, end: CHUNK_SIZE};
    const seg2 = {start: CHUNK_SIZE, end: CHUNK_SIZE.times(2)};
    const p1 = Buffer.from('12345678ab', 'hex');
    const p2 = Buffer.from('ab12345678', 'hex');
    const h1 = utils.keccak(p1);
    const h2 = utils.keccak(p2);

    it('should verify multisig', async function () {
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
        [StoneScissorPaperLabel, h1, h2]
      );
      const tx = new Transaction(
        this.multisigGame.address,
        StoneScissorPaperLabel,
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
        '0x',
        {from: user, gas: gasLimit});
      assert.equal(result, 0);
    });

    it('should verify reveal', async function () {
      const h1 = utils.keccak(p1);
      const h2 = utils.keccak(p2);
      const input = new TransactionOutput(
        [testAddress1, testAddress2],
        [seg1, seg2],
        [StoneScissorPaperLabel, h1, h2],
        1
      );
      const output1 = new TransactionOutput(
        [testAddress1],
        [seg1],
        [0],
        0
      );
      const output2 = new TransactionOutput(
        [testAddress2],
        [seg2],
        [0],
        0
      );
      const tx = new Transaction(
        this.multisigGame.address,
        StoneScissorPaperRevealLabel,
        [p1, p2],
        new Date().getTime(),
        [input],
        [output1, output2]
      );
      let txBytes = tx.getBytes();
      const sign1 = tx.sign(privKey1)
      const sign2 = tx.sign(privKey2)
      const result = await this.txVerificationTest.verifyTransaction(
        utils.bufferToHex(txBytes),
        utils.bufferToHex(Buffer.concat([sign1, sign2])),
        '0x',
        {from: user, gas: gasLimit});
      assert.equal(result, 0);
    });

  });

});

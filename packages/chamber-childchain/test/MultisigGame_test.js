const utils = require('ethereumjs-util');
const assert = require('assert');
const {
  Transaction,
  TransactionOutput
} = require('@cryptoeconomicslab/chamber-core');
const MultisigGame = require('../lib/verifier/MultisigGame');
const testData = require('./testdata');

describe('verifier.MultisigGame', function() {

  const segment1 = {start:2, end:3};
  const segment2 = {start:4, end:5};
  const privKey1 = testData.privKey1;
  const privKey2 = testData.privKey2;
  const testAddress1 = utils.privateToAddress(privKey1);
  const testAddress2 = utils.privateToAddress(privKey2);
  const MULTISIG_COMMIT = 21;
  const MULTISIG_REVEAL = 22;
  const multisigVerifier = '0x9fbda871d559710256a2502a2517b794b482db40';
  
  describe('commit', function() {
    const p1 = Buffer.from('12345678ab', 'hex');
    const p2 = Buffer.from('ab12345678', 'hex');
    const h1 = utils.sha3(p1);
    const h2 = utils.sha3(p2);
    const input1 = new TransactionOutput(
      [testAddress1],
      [segment1],
      [0],
      0
    );
    const input2 = new TransactionOutput(
      [testAddress2],
      [segment2],
      [0],
      0
    );
    const output = new TransactionOutput(
      [testAddress1, testAddress2],
      [segment1, segment2],
      [MULTISIG_COMMIT, h1, h2]
    );
    const tx = new Transaction(
      multisigVerifier,
      MULTISIG_COMMIT,    // label
      [h1, h2],  // args
      1,     // nonce,
      [input1, input2],
      [output]
    );

    it('should commit hash', function() {
      const sign1 = tx.sign(privKey1);
      const sign2 = tx.sign(privKey2);
      const outputs = MultisigGame.commit(tx.inputs, tx.args, [sign1, sign2], tx.hash());
      assert.equal(outputs.length, 1);
      assert.equal(outputs[0].owners[0], utils.toChecksumAddress(utils.bufferToHex(testAddress1)));
      assert.equal(outputs[0].owners[1], utils.toChecksumAddress(utils.bufferToHex(testAddress2)));
    });

    it('should reveal preimages', function() {
      const input = new TransactionOutput(
        [testAddress1, testAddress2],
        [segment1, segment2],
        [MULTISIG_COMMIT, h1, h2],
        1
      );
      const output1 = new TransactionOutput(
        [testAddress1],
        [segment1],
        [0]
      );
      const output2 = new TransactionOutput(
        [testAddress2],
        [segment2],
        [0]
      );
      const tx = new Transaction(
        multisigVerifier,
        MULTISIG_REVEAL,
        [p1, p2],  // args
        2,     // nonce,
        [input],
        [output1, output2]
      );
      const sign1 = tx.sign(privKey1);
      const sign2 = tx.sign(privKey2);
      
      const outputs = MultisigGame.reveal(
        tx.inputs,
        tx.args,
        [sign1, sign2],
        tx.hash());
      assert.equal(outputs.length, 2);
      assert.equal(outputs[0].owners[0], utils.toChecksumAddress(utils.bufferToHex(testAddress1)));
      assert.equal(outputs[1].owners[0], utils.toChecksumAddress(utils.bufferToHex(testAddress2)));
    });

  });

});

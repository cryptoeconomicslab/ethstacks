/**
 * state transition multisig game library
 */

const utils = require('ethereumjs-util');
const {
  checkSigs
} = require('./helper');
const {
  BufferUtils,
  TransactionOutput,
  Transaction
} = require('@cryptoeconomicslab/chamber-core');

const MULTISIG_COMMIT = 21;
const MULTISIG_REVEAL = 22;

function verify(tx) {
  if(tx.label == MULTISIG_COMMIT) {
    return commit(tx.inputs, tx.args, tx.getSigs(), tx.hash());
  }else if(tx.label == MULTISIG_REVEAL) {
    return reveal(tx.inputs, tx.args, tx.getSigs(), tx.hash());
  }
}

function commit(inputs, args, sigs, hash) {
  const h1 = args[0];
  const h2 = args[1];
  const owners = [inputs[0].owners[0], inputs[1].owners[0]];
  checkSigs(
    owners,
    sigs,
    hash
  )

  const output = new TransactionOutput(
    owners,
    [inputs[0].value[0], inputs[1].value[0]],
    [MULTISIG_COMMIT, h1, h2]
  );
  return [output];
}

function reveal(inputs, args, sigs, hash) {
  const h1 = inputs[0].state[1];
  const h2 = inputs[0].state[2];
  const p1 = args[0];
  const p2 = args[1];
  const userA = inputs[0].owners[0];
  const userB = inputs[0].owners[1];
  if(Buffer.compare(utils.sha3(p1), h1) != 0 || Buffer.compare(utils.sha3(p2), h2) != 0) {
    throw new Error('invalid preimage');
  }
  // p1 p2
  const r1 = BufferUtils.bufferToNum(p1) % 3;
  const r2 = BufferUtils.bufferToNum(p2) % 3;
  const output1 = new TransactionOutput(
    [userA],
    [inputs[0].value[0]],
    [0]
  );
  const output2 = new TransactionOutput(
    [userA],
    [inputs[0].value[1]],
    [0]
  );
  if(r1 > r2 || (r1 == 0 && r2 == 2)) {
    output1.owners[0] = userA;
    output2.owners[0] = userA;
  }else if(r1 == r2) {
    output1.owners[0] = userA;
    output2.owners[0] = userB;
  }else{
    output1.owners[0] = userB;
    output2.owners[0] = userB;
  }
  return [output1, output2];
}

module.exports = {
  verify,
  commit,
  reveal
}

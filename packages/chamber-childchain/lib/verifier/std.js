/**
 * state transition standard library
 */

const utils = require('ethereumjs-util');
const {
  BufferUtils,
  TransactionOutput,
  Transaction
} = require('@cryptoeconomicslab/chamber-core');
const {
  checkSigs
} = require('./helper');

const OWN_STATE = 0;

function transfer(inputs, args, sigs, hash) {
  checkSigs(
    inputs[0].owners,
    sigs,
    hash
  )

  const output = new TransactionOutput([args[0]], inputs[0].value, inputs[0].state);
  return [output];
}

function split(inputs, args, sigs, hash) {
  checkSigs(
    inputs[0].owners,
    sigs,
    hash
  )

  const amount = BufferUtils.bufferToNum(args[1]);
  const output1 = new TransactionOutput(
    [args[0]],
    [{
      start: inputs[0].value[0].start,
      end: inputs[0].value[0].start.plus(amount)
    }],
    inputs[0].state
  );
  const output2 = new TransactionOutput(
    inputs[0].owners,
    [{
      start: inputs[0].value[0].start.plus(amount),
      end: inputs[0].value[0].end
    }],
    inputs[0].state
  );
  return [output1, output2];
}

function exchange(inputs, args) {
  const output1 = inputs[0].clone();
  const output2 = inputs[1].clone();
  const swapValue = output1.value;
  output1.value = output2.value;
  output2.value = swapValue;
  return [output1, output2];
}

module.exports = {
  transfer,
  split,
  exchange,
  OWN_STATE
}

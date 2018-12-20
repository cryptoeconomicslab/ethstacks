pragma solidity ^0.4.24;

import "./lib/ByteUtils.sol";
import "./lib/ECRecovery.sol";
import "./lib/RLP.sol";
import "./TxDecoder.sol";

/**
 * @title TxVerification
 * @dev check tx
 */
library TxVerification {

  /*
   * application specific functions 
   */

  function verifyTransaction(
    TxDecoder.Tx transaction,
    bytes txBytes,
    bytes32 txHash,
    bytes32 merkleHash,
    bytes sigs,
    bytes confsigs
  )
    internal
    view
  {
    if(transaction.verifier == address(0)) {
      if(transaction.label == 0) {
        transfer(transaction, txHash, sigs);
      }else if(transaction.label == 1) {
        split(transaction, txHash, sigs);
      }else if(transaction.label == 2) {
        exchange(transaction);
      }
    } else {
      transaction.verifier.call(
        'verify',
        txBytes,
        txHash,
        merkleHash,
        sigs,
        confsigs);
    }
  }

  /**
   * @dev change owner
   */
  function transfer(TxDecoder.Tx transaction, bytes32 txHash, bytes sigs)
    internal
    pure
  {
    address counter = RLP.toAddress(transaction.args[0]);
    require(RLP.toUint(transaction.inputs[0].state[0]) == 0);
    require(transaction.inputs[0].owners[0] == ECRecovery.recover(txHash, sigs));
    require(transaction.outputs[0].owners[0] == counter);
  }

  /**
   * @dev split value
   */
  function split(TxDecoder.Tx transaction, bytes32 txHash, bytes sigs)
    internal
    pure
  {
    address counter = RLP.toAddress(transaction.args[0]);
    uint amount = RLP.toUint(transaction.args[1]);
    require(RLP.toUint(transaction.inputs[0].state[0]) == 0);
    require(transaction.inputs[0].owners[0] == ECRecovery.recover(txHash, sigs));
    require(transaction.outputs[0].owners[0] == counter);
    require(transaction.outputs[1].owners[0] == transaction.inputs[0].owners[0]);
    TxDecoder.Amount memory amount0 = transaction.outputs[0].value[0];
    TxDecoder.Amount memory amount1 = transaction.outputs[1].value[0];
    require(amount0.end - amount0.start == amount);
    require(amount0.start + amount == amount1.start);
    require(transaction.inputs[0].value[0].end == amount1.end);
  }

  function exchange(TxDecoder.Tx transaction)
    internal
    pure
  {
    TxDecoder.TxState memory preState1 = transaction.inputs[0];
    TxDecoder.TxState memory preState2 = transaction.inputs[1];
    TxDecoder.TxState memory afterState1 = transaction.outputs[0];
    TxDecoder.TxState memory afterState2 = transaction.outputs[1];

    require(preState1.owners[0] == afterState2.owners[0]);
    require(preState2.owners[0] == afterState1.owners[0]);
    require(preState1.value[0].start == afterState1.value[0].start);
    require(preState2.value[0].start == afterState2.value[0].start);
  }

}

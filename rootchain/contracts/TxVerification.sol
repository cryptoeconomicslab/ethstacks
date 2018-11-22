pragma solidity ^0.4.24;

import "./ByteUtils.sol";
import "./ECRecovery.sol";
import "./RLP.sol";

/**
 * @title TxVerification
 * @dev check tx
 */
library TxVerification {

  /*
   * standard structure
   */
  struct Amount {
    uint256 start;
    uint256 end;
  }

  struct TxState {
    address[] owners;
    Amount[] value;
    RLP.RLPItem[] state;
    bytes stateBytes;
    uint256 blkNum;
  }

  struct Tx {
    uint256 label;
    RLP.RLPItem[] args;
    TxState[] inputs;
    TxState[] outputs;
  }

  enum AppStateStd {
    AppStateStdOwn,
    AppStateStdMultiSig
  }

  struct AppStateStdOrderBook {
    address assetId;
    uint256 amount;
  }

  /*
   * application specific structure
   */
  struct AppStateTictactoe {
    address currentPlayer;
    address nextPlayer;
    uint256 map;
    uint256 winner;
  }

  /*
   * common functions
   */

  function checkSigs(address[] owners, bytes sigs, bytes32 txHash)
    internal
    pure
    returns (bool)
  {
    uint32 i = 0;
    for (uint256 offset = 0; offset < sigs.length; offset += 65) {
      bytes memory sig = ByteUtils.slice(sigs, offset, 65);
      if(owners[i] != ECRecovery.recover(txHash, sig)) {
        return false;
      }
      i = i + 1;
    }
    return true;
  }

  function getAmount(RLP.RLPItem memory amountItem)
    internal
    pure
    returns (Amount)
  {
    RLP.RLPItem[] memory amountList = RLP.toList(amountItem);
    return Amount({
      start: RLP.toUint(amountList[0]),
      end: RLP.toUint(amountList[1])
    });
  }

  /**
   * @dev tx input bytes to TxInput
   * @param txState txState
   */
  function getTxInput(RLP.RLPItem memory txState)
    internal
    pure
    returns (TxState)
  {
    RLP.RLPItem[] memory txStateList = RLP.toList(txState);
    RLP.RLPItem[] memory ownerList = RLP.toList(txStateList[0]);
    RLP.RLPItem[] memory valueList = RLP.toList(txStateList[1]);
    address[] memory owners = new address[](ownerList.length);
    Amount[] memory values = new Amount[](valueList.length);
    uint i = 0;
    for (i = 0; i < ownerList.length; i++) {
      owners[i] = RLP.toAddress(ownerList[i]);
    }
    for (i = 0; i < valueList.length; i++) {
      values[i] = getAmount(valueList[i]);
    }
    return TxState({
      owners: owners,
      value: values,
      state: RLP.toList(txStateList[2]),
      stateBytes: RLP.listAsBytes(txStateList[2]),
      blkNum: RLP.toUint(txStateList[3])
    });
  }

  /**
   * @dev txStateBytes to txState
   * @param txState txState
   */
  function getTxState(RLP.RLPItem memory txState)
    internal
    pure
    returns (TxState)
  {
    RLP.RLPItem[] memory txStateList = RLP.toList(txState);
    RLP.RLPItem[] memory ownerList = RLP.toList(txStateList[0]);
    RLP.RLPItem[] memory valueList = RLP.toList(txStateList[1]);
    address[] memory owners = new address[](ownerList.length);
    Amount[] memory values = new Amount[](valueList.length);
    uint i = 0;
    for (i = 0; i < ownerList.length; i++) {
      owners[i] = RLP.toAddress(ownerList[i]);
    }
    for (i = 0; i < valueList.length; i++) {
      values[i] = getAmount(valueList[i]);
    }
    return TxState({
      owners: owners,
      value: values,
      state: RLP.toList(txStateList[2]),
      stateBytes: RLP.listAsBytes(txStateList[2]),
      blkNum: 0
    });
  }

  /**
   * @dev txBytes to tx
   * @param txByte txByte
   */
  function getTx(bytes txByte)
    internal
    pure
    returns (Tx)
  {
    var txList = RLP.toList(RLP.toRlpItem(txByte));
    RLP.RLPItem[] memory inputList = RLP.toList(txList[3]);
    RLP.RLPItem[] memory outputList = RLP.toList(txList[4]);
    TxState[] memory inputs = new TxState[](inputList.length);
    TxState[] memory outputs = new TxState[](outputList.length);
    for (uint i = 0; i < inputList.length; i++) {
      inputs[i] = getTxInput(inputList[i]);
    }
    for (uint j = 0; j < outputList.length; j++) {
      outputs[j] = getTxState(outputList[j]);
    }
    return Tx({
      label: RLP.toUint(txList[1]),
      args: RLP.toList(txList[2]),
      inputs: inputs,
      outputs: outputs
    });
  }

  function getAppStateStd(RLP.RLPItem[] appStateList)
    internal
    pure
    returns (AppStateStd)
  {
    uint256 i = RLP.toUint(appStateList[0]);
    if(i == 0) {
      return AppStateStd.AppStateStdOwn;
    }else{
      return AppStateStd.AppStateStdMultiSig;
    }
  }

  function getAppStateStdOrderBook(RLP.RLPItem[] appStateList)
    internal
    pure
    returns (AppStateStdOrderBook)
  {
    return AppStateStdOrderBook({
      assetId: RLP.toAddress(appStateList[0]),
      amount: RLP.toUint(appStateList[1])
    });
  }

  function getAppStateTictactoe(RLP.RLPItem[] appStateList)
    internal
    pure
    returns (AppStateTictactoe)
  {
    return AppStateTictactoe({
      currentPlayer: RLP.toAddress(appStateList[0]),
      nextPlayer: RLP.toAddress(appStateList[1]),
      map: RLP.toUint(appStateList[2]),
      winner: RLP.toUint(appStateList[3])
    });
  }

  /*
   * application specific functions 
   */

  function verifyTransaction(Tx transaction, bytes32 txHash, bytes sigs)
    internal
    pure
  {
    // require(checkSigs(owners, sigs, txHash) == true);
    if(transaction.label == 0) {
      transfer(transaction, txHash, sigs);
    }else if(transaction.label == 1) {
      split(transaction, txHash, sigs);
    }else if(transaction.label == 2) {
      exchange(transaction);
    }else if(transaction.label == 100) {
      //updateReverseStatus(transaction);
    }
  }

  /**
   * @dev change owner
   */
  function transfer(Tx transaction, bytes32 txHash, bytes sigs)
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
  function split(Tx transaction, bytes32 txHash, bytes sigs)
    internal
    pure
  {
    address counter = RLP.toAddress(transaction.args[0]);
    uint amount = RLP.toUint(transaction.args[1]);
    require(RLP.toUint(transaction.inputs[0].state[0]) == 0);
    require(transaction.inputs[0].owners[0] == ECRecovery.recover(txHash, sigs));
    require(transaction.outputs[0].owners[0] == counter);
    require(transaction.outputs[1].owners[0] == transaction.inputs[0].owners[0]);
    Amount memory amount0 = transaction.outputs[0].value[0];
    Amount memory amount1 = transaction.outputs[1].value[0];
    require(amount0.end - amount0.start == amount);
    require(amount0.start + amount == amount1.start);
    require(transaction.inputs[0].value[0].end == amount1.end);
  }

  function multisig(Tx transaction, bytes32 txHash, bytes sigs)
    internal
    pure
  {
    bytes32 h1 = ByteUtils.bytesToBytes32(RLP.toBytes(transaction.args[0]));
    bytes32 h2 = ByteUtils.bytesToBytes32(RLP.toBytes(transaction.args[1]));
    bytes32 o1 = ByteUtils.bytesToBytes32(RLP.toBytes(transaction.outputs[0].state[1]));
    bytes32 o2 = ByteUtils.bytesToBytes32(RLP.toBytes(transaction.outputs[0].state[2]));
    require(o1
     == h1);
    require(o2 == h2);
    // TODO: check owner and value
  }

  function reveal(Tx transaction, bytes32 txHash, bytes sigs)
    internal
    pure
  {
    bytes32 h1 = ByteUtils.bytesToBytes32(RLP.toBytes(transaction.inputs[0].state[1]));
    bytes32 h2 = ByteUtils.bytesToBytes32(RLP.toBytes(transaction.inputs[0].state[2]));
    bytes32 p1 = ByteUtils.bytesToBytes32(RLP.toBytes(transaction.args[0]));
    bytes32 p2 = ByteUtils.bytesToBytes32(RLP.toBytes(transaction.args[1]));
    bytes32 o1 = ByteUtils.bytesToBytes32(RLP.toBytes(transaction.outputs[0].state[1]));
    bytes32 o2 = ByteUtils.bytesToBytes32(RLP.toBytes(transaction.outputs[0].state[2]));
    require(keccak256(p1) == h1 && keccak256(p2) == h2);
    require(o1 == p1);
    require(o2 == p2);
    // TODO: check owner and value
  }


   /*
  function updateReverseStatus(Tx transaction)
    internal
    pure
  {
    TxState memory input = transaction.inputs[0];
    TxState memory output = transaction.outputs[0];
    var appState = getAppStateTictactoe(input.state);
    var nextAppState = getAppStateTictactoe(output.state);
    require(appState.currentPlayer == input.owners[0]);
    require(appState.nextPlayer == output.owners[0]);
    uint pos = RLP.toUint(transaction.args[0]);
    uint spos = RLP.toUint(transaction.args[1]);
    uint posState = gameGetPos(appState.map, pos);
    require(posState == 0);
    uint256 newMap = appState.map + ((3**pos)*spos);
    uint winner = gameIsWin(newMap);
    if(winner > 0) {
      require(nextAppState.winner == winner);
    }else{
      require(nextAppState.map == newMap);
    }
  }


  function gameIsWin(uint256 map)
    internal
    pure
    returns (uint)
  {
    uint256[] memory tmpMap = new uint256[](9);
    tmpMap[0] = map;
    uint8 i = 1;
    for(i = 1; i < 9; i++) {
      tmpMap[i] = tmpMap[i - 1] / 3;
    }
    for(i = 0; i < 9; i++) {
      for(uint8 j = i + 1; j < 9; j++) {
        tmpMap[i] -= tmpMap[j] * (3**j);
      }
    }
    if(tmpMap[0] != 0 && tmpMap[0] == tmpMap[1] && tmpMap[1] == tmpMap[2]) {
      return tmpMap[0];
    }
    if(tmpMap[3] != 0 && tmpMap[3] == tmpMap[4] && tmpMap[4] == tmpMap[5]) {
      return tmpMap[3];
    }
    if(tmpMap[6] != 0 && tmpMap[6] == tmpMap[7] && tmpMap[7] == tmpMap[8]) {
      return tmpMap[6];
    }
    if(tmpMap[0] != 0 && tmpMap[0] == tmpMap[3] && tmpMap[3] == tmpMap[6]) {
      return tmpMap[0];
    }
    if(tmpMap[1] != 0 && tmpMap[1] == tmpMap[4] && tmpMap[4] == tmpMap[7]) {
      return tmpMap[1];
    }
    if(tmpMap[2] != 0 && tmpMap[2] == tmpMap[5] && tmpMap[5] == tmpMap[8]) {
      return tmpMap[2];
    }
    if(tmpMap[0] != 0 && tmpMap[0] == tmpMap[4] && tmpMap[4] == tmpMap[8]) {
      return tmpMap[0];
    }
    if(tmpMap[2] != 0 && tmpMap[2] == tmpMap[4] && tmpMap[4] == tmpMap[6]) {
      return tmpMap[2];
    }
    return 0;
  }

  function gameGetPos(uint256 map, uint256 pos)
    internal
    pure
    returns (uint)
  {
    uint256 map3 = map / 27 / 27;
    uint256 map2 = map / 27 - map3 * 27 * 27;
    uint256 map1 = map - map3 * 27 * 27 - map2 * 27;
    if(pos >= 0 && pos < 3) {
      return gameGetPos2(map1, pos);
    } else if(pos < 6) {
      return gameGetPos2(map2, pos - 3);
    } else if(pos < 9) {
      return gameGetPos2(map3, pos - 6);
    }
  }

  function gameGetPos2(uint256 map, uint256 pos)
    internal
    pure
    returns (uint)
  {
    uint256 map1 = map / 3 / 3;
    uint256 map2 = map / 3 - map1 * 3 * 3;
    uint256 map3 = map - map1 * 3 * 3 - map2 * 3;
    if(pos == 0) {
      return map1;
    }else if(pos == 1) {
      return map2;
    }else if(pos == 2) {
      return map3;
    }
  }
  */

  function exchange(Tx transaction)
    internal
    pure
  {
    TxState memory preState1 = transaction.inputs[0];
    TxState memory preState2 = transaction.inputs[1];
    TxState memory afterState1 = transaction.outputs[0];
    TxState memory afterState2 = transaction.outputs[1];

    require(preState1.owners[0] == afterState2.owners[0]);
    require(preState2.owners[0] == afterState1.owners[0]);
    require(preState1.value[0].start == afterState1.value[0].start);
    require(preState2.value[0].start == afterState2.value[0].start);
  }

  function verifyWithdrawal(address[] owners, uint256 uid, bytes stateBytes)
    internal
    pure
    returns (bool)
  {
    var stdState = getAppStateStd(RLP.toList(RLP.toRlpItem(stateBytes)));
    if(stdState == AppStateStd.AppStateStdOwn) {
      return true;
    }
    return false;
  }

}

pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;

import "./lib/Array.sol";
import "./lib/Math.sol";
import "./lib/Merkle.sol";
import "./TxVerification.sol";
import "./TxDecoder.sol";

/**
 * @title RootChain
 * @dev This contract secures a utxo payments plasma child chain to ethereum.
 * based on https://github.com/omisego/plasma-mvp/blob/master/plasma/root_chain/contracts/RootChain.sol
 */
contract RootChain {
    using Math for uint256;
    using Array for address[];
    using Merkle for bytes32;

    /*
     * Events
     */

    event Deposit(
      address indexed depositor,
      uint256 start,
      uint256 end
    );

    event ExitStarted(
      address indexed exitor,
      ExitTxo output
    );

    event BlockSubmitted(
        bytes32 root,
        uint256 timestamp
    );

    event TokenAdded(
        address token
    );

    event Log(
      uint n
    );


    /*
     * Storage
     */
    uint256 public constant CHILD_BLOCK_INTERVAL = 1000;
    uint256 public constant CHUNK_SIZE = 1000000000000000000;

    struct Coin {
      address token;
      uint exit;
      bool hasValue;
    }
    struct Exit {
      uint256 blkNum;
      uint256 exitableAt;
      bytes prevTx;
      // exiting output is always one
      ExitTxo output;
      // There are multiple challenges
      uint8 challengeCount;
    }

    uint8 public constant CHALLENGE_STATE_FIRST = 1;
    uint8 public constant CHALLENGE_STATE_RESPONDED = 2;
    uint8 public constant CHALLENGE_STATE_RESPONDED_PARENT = 3;
    uint8 public constant CHALLENGE_STATE_SECOND = 4;

    struct Challenge {
      bytes txBytes1;
      bytes cTxBytes;
      // ch1 output
      ExitTxo output1;
      // ch1 blkNum
      uint256 blkNum1;
      // current(ch2) output
      ExitTxo cOutput;
      // current(ch2) blkNum
      uint256 cBlkNum;
      uint256 exitPos;
      uint8 status;
    }


    struct ChildBlock {
        bytes32 root;
        uint256 timestamp;
    }

    address public operator;
    uint256 public depositCount;
    mapping (uint256 => ChildBlock) blocks;
    uint256 public currentChildBlock;
    uint256 public currentFeeExit;
    mapping (uint256 => Coin) coins;
    mapping (uint256 => Exit) exits;
    mapping (uint256 => Challenge) challenges;
    mapping (uint256 => TxDecoder.Amount) withdrawals;
    // mapping (address => uint256) weights;

    struct ExitTxo {
      address[] owners;
      uint256[] values;
      bytes state;
      uint256 blkNum;
    }
    
    /*
     * Modifiers
     */

    /**
     * @dev operator for chain
     */
    modifier onlyOperator() {
        require(msg.sender == operator);
        _;
    }


    /*
     * Constructor
     */
    constructor()
      public
    {
      operator = msg.sender;
      currentChildBlock = 1;
      currentFeeExit = 1;
    }


    /*
     * Public Functions
     */


    /**
     * @dev Allows Plasma chain operator to submit transaction merkle root.
     * @param _root The merkle root of a child chain transactions.
     */
    function submitBlock(bytes32 _root)
        public
        onlyOperator()
    {
      blocks[currentChildBlock] = ChildBlock({
          root: _root,
          timestamp: block.timestamp
      });

      // Update block numbers.
      currentChildBlock = currentChildBlock.add(1);

      emit BlockSubmitted(_root, block.timestamp);
    }

    /**
     * @dev Allows anyone to deposit funds into the Plasma chain.
     */
    function deposit()
        public
        payable
    {
      uint256 amount = msg.value;
      require(amount % CHUNK_SIZE == 0);
      uint start = depositCount;
      uint end = start + amount;
      uint slot = start / CHUNK_SIZE;
      uint slotEnd = end / CHUNK_SIZE;
      for(uint i = slot;i < slotEnd;i++) {
        require(!coins[i].hasValue);
        coins[i] = Coin({
          token: address(0),
          exit: 0,
          hasValue: true
        });
      }
      blocks[currentChildBlock] = ChildBlock({
          root: keccak256(slot),
          timestamp: block.timestamp
      });
      currentChildBlock = currentChildBlock.add(1);
      depositCount = end;
      emit Deposit(msg.sender, start, end);
    }

    /**
     * @dev Starts an exit from a deposit.
     */
    function startDepositExit(
      uint256 blknum,
      uint256 uid
    )
      public
    {

    }
    
    function checkInclusion(
      bytes32 root,
      bytes32 txHash,
      bytes _proofs,
      TxDecoder.Amount[] values
    )
      private
      pure
    {
      for(uint c = 0; c < values.length; c++) {
        uint a = values[c].start / CHUNK_SIZE;
        require(txHash.checkMembership(
          values[c].start / CHUNK_SIZE,
          values[c].end / CHUNK_SIZE,
          root,
          ByteUtils.slice(_proofs, c*512, 512)
        ));
      }
    }

    /**
     * @dev start exit UTXO
     * @param _blkNum block number of exit utxo
     * @param _oIndex index of output
     * @param _exitTxBytes exiting transaction
     */
    function startExit(
      uint256 _blkNum,
      uint8 _oIndex,
      bytes _exitTxBytes,
      bytes _txInfoBytes
    )
      public
    {
      var childBlock = blocks[_blkNum];
      var exitTx = TxDecoder.getTx(_exitTxBytes);
      // if there are 2 inputs this exit don't need prev tx because it has confsig.
      var input = exitTx.inputs[0];
      var output = exitTx.outputs[_oIndex];
      checkTx(
        childBlock.root,
        _exitTxBytes,
        _txInfoBytes,
        output.value,
        exitTx
      );

      // msg.sender must be exitor
      require(output.owners.contains(msg.sender));

      addToExitList(
        msg.sender,
        output,
        _exitTxBytes,
        _blkNum,
        childBlock.timestamp);
    }

    /**
     * @dev challenge by spent transaction. exit process finish soon.
     * @param _cIndex the index of inputs
     * @param _cBlkNum block number of challenge tx
     * @param _eUtxoPos exiting utxo position
     * @param _txInfos The challenging transaction in bytes RLP form.
     */
    function challengeAfter(
      uint256 _cIndex,
      uint256 _cBlkNum,
      uint256 _eUtxoPos,
      bytes _txBytes,
      bytes _txInfos
    )
      public
    {
      Exit exit = exits[_eUtxoPos];
      require(_cBlkNum > exit.blkNum);
      var challengeTx = TxDecoder.getTx(_txBytes);
      checkTx(
        blocks[_cBlkNum].root,
        _txBytes,
        _txInfos,
        challengeTx.inputs[_cIndex].value,
        challengeTx
      );
      require(keccak256TxOutput(challengeTx.inputs[_cIndex]) == keccak256ExitTxo(exit.output));
      delete exits[_eUtxoPos];
    }

    function challengeWithdrawal(
      uint256 _withdrawal,
      uint256 _eUtxoPos
    )
      public
    {
      Exit exit = exits[_eUtxoPos];
      require(withinRangeSingle(
        withdrawals[_withdrawal],
        exit.output
      ), 'withdrawal should has same segment');
      delete exits[_eUtxoPos];
    }

    /**
     * @dev start challenge game
     * @param _txInfos txBytes, proof, sigs, confsigs
     */
    function challengeBefore(
      uint256 _cIndex,
      uint256 _cBlkNum,
      uint256 _eUtxoPos,
      uint256 _cPos,
      bytes _txBytes,
      bytes _txInfos
    )
      public
    {
      Exit exit = exits[_eUtxoPos];
      // check challenge tx is before exiting tx
      require(_cBlkNum < exit.blkNum);
      var challengeTx = TxDecoder.getTx(_txBytes);
      checkTx(
        blocks[_cBlkNum].root,
        _txBytes,
        _txInfos,
        challengeTx.outputs[_cIndex].value,
        challengeTx
      );
      require(withinRange(
        challengeTx.outputs[_cIndex].value,
        exit.output
      ), 'challenge transaction should has same coin');
      // _cBlkNum is challenge position
      var challenge = challenges[_cPos];
      var output = getExitTxo(challengeTx.outputs[_cIndex], _cBlkNum);
      if(challenge.status == CHALLENGE_STATE_RESPONDED) {
        challenge.cOutput = output;
        challenge.cBlkNum = _cBlkNum;
        challenge.status = CHALLENGE_STATE_SECOND;
        exit.challengeCount++;
      }else if(challenge.status == 0) {
        require(_cPos == _cBlkNum * 1000000 + getSlot(challengeTx.outputs[_cIndex].value[0]));
        challenges[_cPos] = Challenge({
          txBytes1: _txBytes,
          cTxBytes: _txBytes,
          output1: output,
          blkNum1: _cBlkNum,
          cOutput: output,
          cBlkNum: _cBlkNum,
          exitPos: _eUtxoPos,
          status: CHALLENGE_STATE_FIRST
        });
        exit.challengeCount++;
      }
    }

    function checkTx(
      bytes32 root,
      bytes _txBytes,
      bytes _txInfos,
      TxDecoder.Amount[] values,
      TxDecoder.Tx transaction
    )
      private
      view
    {
      if(transaction.inputs.length == 0) {
        // deposit transaction
        require(root == keccak256(getSlot(values[0])));
      } else {
        RLP.RLPItem[] memory txList = RLP.toList(RLP.toRlpItem(_txInfos));
        bytes32 txHash = keccak256(_txBytes);
        checkInclusion(
          root,
          txHash,
          RLP.toBytes(txList[0]),
          values
        );
        TxVerification.verifyTransaction(
          transaction,
          _txBytes,
          txHash,
          keccak256(txHash, root),
          RLP.toBytes(txList[1]),
          RLP.toBytes(txList[2]));
      }
    }

    /**
     * @dev tx include in exit
     */
    function withinRange(
      TxDecoder.Amount[] values,
      ExitTxo memory exitTxo
    )
      private
      view
      returns (bool)
    {
      for(uint j = 0;j < values.length;j++) {
        if(withinRangeSingle(values[j], exitTxo)) {
          return true;
        }
      }
      return false;
    }

    function withinRangeSingle(
      TxDecoder.Amount value,
      ExitTxo memory exitTxo
    )
      private
      view
      returns (bool)
    {
      for(uint k = 0;k < exitTxo.values.length;k += 2) {
        if(!(value.end < exitTxo.values[k] || exitTxo.values[k + 1] < value.start)) {
          return true;
        }
      }
      return false;
    }

    function getSlot(
      TxDecoder.Amount value
    )
      pure
      returns (uint256)
    {
      uint256 start = value.start / CHUNK_SIZE;
      return start;
    }

    /**
     * @dev respond parent tx of exiting tx
     * @param _eInputIndex is the index of inputs
     */
    function respondParent(
      uint256 _eInputIndex,
      uint256 _rOutputIndex,
      uint256 _rBlkNum,
      uint256 _eUtxoPos,
      uint256 _challengePos,
      bytes _txBytes,
      bytes _txInfos
    )
      public
    {
      Exit exit = exits[_eUtxoPos];
      var challenge = challenges[_challengePos];
      var respondTx = TxDecoder.getTx(_txBytes);
      var exitingTx = TxDecoder.getTx(exit.prevTx);
      // response tx should older than exiting tx
      require(_rBlkNum < exit.blkNum);
      checkTx(
        blocks[_rBlkNum].root,
        _txBytes,
        _txInfos,
        respondTx.inputs[_rOutputIndex].value,
        respondTx
      );
      // respond tx should not be child of challenge1 tx
      require(withinRange(
        respondTx.outputs[_rOutputIndex].value,
        exit.output), '_rOutputIndex is not correct');
      require(withinRange(
        respondTx.outputs[_rOutputIndex].value,
        challenge.output1), '_rOutputIndex is not correct');
      require(
        keccak256TxOutput(respondTx.outputs[_rOutputIndex]) == keccak256TxOutput(exitingTx.inputs[_eInputIndex]));
      if(challenge.status == CHALLENGE_STATE_FIRST && _rBlkNum < challenge.blkNum1) {
        delete challenges[_challengePos];
        exit.challengeCount--;
        challenge.status = CHALLENGE_STATE_RESPONDED_PARENT;
        exit.prevTx = _txBytes;
      }
    }

    function challengeBetween(
      uint256 _cInputIndex,
      uint256 _rOutputIndex,
      uint256 _eUtxoPos,
      uint256 _cPos
    )
      public
    {
      Exit exit = exits[_eUtxoPos];
      // prevTx
      var prevTx = TxDecoder.getTx(exit.prevTx);
      var challenge = challenges[_cPos];
      var challengeTx = TxDecoder.getTx(challenge.cTxBytes);
      if(challenge.status == CHALLENGE_STATE_RESPONDED_PARENT) {
        // check double spent
        require(
          keccak256TxOutput(prevTx.outputs[_rOutputIndex]) == keccak256TxOutput(challengeTx.inputs[_cInputIndex]),
          'respondTx is not double spent');
        delete exits[_eUtxoPos];
      }
    }

    /**
     * @dev respond spent tx of challenge tx
     * @param _txInfos txBytes, proof, sigs, confsigs
     */
    function respondChallenge(
      uint256 _rIndex,
      uint256 _rBlkNum,
      uint256 _eUtxoPos,
      uint256 _challengePos,
      bytes _txBytes,
      bytes _txInfos
    )
      public
    {
      Exit exit = exits[_eUtxoPos];
      var challenge = challenges[_challengePos];
      require(_rBlkNum > challenge.cBlkNum);
      var respondTx = TxDecoder.getTx(_txBytes);
      checkTx(
        blocks[_rBlkNum].root,
        _txBytes,
        _txInfos,
        respondTx.inputs[_rIndex].value,
        respondTx
      );
      require(keccak256TxOutput(respondTx.inputs[_rIndex]) == keccak256ExitTxo(challenge.cOutput));
      if(challenge.status == CHALLENGE_STATE_SECOND) {
        delete challenges[_challengePos];
      }else{
        challenge.status = CHALLENGE_STATE_RESPONDED;
        exit.exitableAt = block.timestamp + 1 weeks;
      }
      exit.challengeCount--;
    }

    /**
     * @dev Processes any exits that have completed the challenge period. 
     * @param _utxoPos exit position
     */
    function finalizeExits(uint _utxoPos)
        public
    {
      Exit memory currentExit = exits[_utxoPos];
      if(
        currentExit.exitableAt < block.timestamp
        && currentExit.challengeCount == 0) {
        // state specific withdrawal
        if(currentExit.output.owners.length == 1) {
          for(uint i = 0;i < currentExit.output.values.length;i += 2) {
            withdrawValue(
              currentExit,
              currentExit.output.values[i],
              currentExit.output.values[i + 1]);
          }
        }
        delete exits[_utxoPos];
      }
    }

    function withdrawValue(
      Exit memory currentExit,
      uint start,
      uint end
    )
      private
    {
      currentExit.output.owners[0].transfer(end - start);
      withdrawals[start] = TxDecoder.Amount({
        start: start,
        end: end
      });
    }

    /* 
     * Public view functions
     */

    /**
     * @dev Queries the child chain.
     * @param _blockNumber Number of the block to return.
     * @return Child chain block at the specified block number.
     */
    function getChildChain(uint256 _blockNumber)
        public
        view
        returns (bytes32, uint256)
    {
      return (blocks[_blockNumber].root, blocks[_blockNumber].timestamp);
    }

    /**
     * @dev Returns information about an exit.
     * @param _utxoPos Position of the UTXO in the chain.
     * @return A tuple representing the active exit for the given UTXO.
     */
    function getExit(uint256 _utxoPos)
        public
        view
        returns (address[], uint256[], bytes, uint8)
    {
      return (
        exits[_utxoPos].output.owners,
        exits[_utxoPos].output.values,
        exits[_utxoPos].output.state,
        exits[_utxoPos].challengeCount
      );
    }


    /*
     * Private functions
     */

    /**
     * @dev Adds an exit to the exit queue.
     * @param _exitor Owner of the UTXO.
     * @param _utxo UTXO data.
     * @param _created_at Time when the UTXO was created.
     */
    function addToExitList(
      address _exitor,
      TxDecoder.TxState _utxo,
      bytes _exitTxBytes,
      uint256 _blkNum,
      uint256 _created_at
    )
      private
    {
      uint256 _utxoPos = _blkNum * 1000000 + (_utxo.value[0].start / CHUNK_SIZE);
      uint256 exitableAt = Math.max(_created_at + 1 weeks, block.timestamp + 1 weeks);
      ExitTxo memory output = getExitTxo(_utxo, _blkNum);
      exits[_utxoPos] = Exit({
        blkNum: _blkNum,
        exitableAt: exitableAt,
        prevTx: _exitTxBytes,
        output: getExitTxo(_utxo, _blkNum),
        challengeCount: 0
      });
      emit ExitStarted(
        msg.sender,
        output);
    }

    function getExitTxo(
      TxDecoder.TxState _txo,
      uint256 blkNum
    )
      pure
      returns (ExitTxo)
    {
      return ExitTxo({
        owners: _txo.owners,
        values: flatten(_txo.value),
        state: _txo.stateBytes,
        blkNum: blkNum
      });
    }

  function flatten(TxDecoder.Amount[] amounts)
    private
    pure
    returns (uint256[])
  {
    uint256[] memory values = new uint256[](amounts.length * 2);
    for(uint c = 0; c < amounts.length; c++) {
      values[c*2] = amounts[c].start;
      values[c*2 + 1] = amounts[c].end;
    }
    return values;
  }


  function keccak256ExitTxo(ExitTxo txo)
    private
    pure
    returns (bytes32)
  {
    return keccak256(txo.owners, txo.values, txo.state);
  }

  function keccak256TxOutput(TxDecoder.TxState output)
    private
    pure
    returns (bytes32)
  {
    uint256[] memory values = flatten(output.value);
    return keccak256(output.owners, values, output.stateBytes);
  }

}

pragma solidity ^0.4.24;

import 'openzeppelin-solidity/contracts/math/SafeMath.sol';
import "./Math.sol";
import "./PlasmaRLP.sol";
import "./Merkle.sol";
import "./Validate.sol";
import "./PriorityQueue.sol";

/**
 * @title RootChain
 * @dev This contract secures a utxo payments plasma child chain to ethereum.
 * based on https://github.com/omisego/plasma-mvp/blob/master/plasma/root_chain/contracts/RootChain.sol
 */
contract RootChain {
    using SafeMath for uint256;
    using Merkle for bytes32;
    using PlasmaRLP for bytes;


    /*
     * Events
     */

    event Deposit(
      address chainIndex,
      address indexed depositor,
      uint256 indexed depositBlock,
      address token,
      uint256 amount
    );

    event DepositFromShelter(
      address chainIndex,
      address indexed depositor,
      uint256 indexed depositBlock,
      address token,
      uint256 amount,
      bytes cont
    );

    event ExitStarted(
        address indexed exitor,
        uint256 indexed utxoPos,
        address token,
        uint256 amount
    );

    event BlockSubmitted(
        bytes32 root,
        uint256 timestamp
    );

    event TokenAdded(
        address token
    );

    event Log(
      uint256 no
    );


    /*
     * Storage
     */
    address public operator;

    uint256 public constant CHILD_BLOCK_INTERVAL = 1000;

    mapping (address => ChildChain) internal childChains;

    uint256 childChainNum;

    Shelter internal shelter;

    struct Exit {
        address exitor;
        address owner;
        address token;
        uint256 amount;
        bytes cont;
    }

    struct ChildBlock {
        bytes32 root;
        uint256 timestamp;
    }

    struct ChildChain {
      bool initialized;
      address operator;
      mapping (uint256 => ChildBlock) blocks;
      uint256 currentChildBlock;
      uint256 currentDepositBlock;
      uint256 currentFeeExit;
      mapping (uint256 => Exit) exits;
      mapping (address => address) exitsQueues;
      mapping (address => uint256) weights;
    }

    struct Shelter {
      mapping (address => uint256) weights;
      mapping (uint256 => Exit) packets;
    }
    
    /*
     * Modifiers
     */

    /**
     * @dev operator for chain
     */
    modifier onlyOperator(address _chain) {
        require(msg.sender == childChains[_chain].operator);
        _;
    }


    /*
     * Constructor
     */

    constructor()
      public
    {
      operator = msg.sender;
      shelter = Shelter();
    }


    /*
     * Public Functions
     */

    /**
     * @dev add child chain.
     * msg.sender is to be the chainId.
     */
    function addChain()
      public
      returns (address)
    {
      // require(msg.value >= 1);
      require(!childChains[msg.sender].initialized); //Reason: struct doesn't allow to be empty
      address _chain = msg.sender;
      ChildChain storage childChain =  childChains[_chain];
      childChain.initialized = true;
      childChain.operator = _chain;
      childChain.currentChildBlock = CHILD_BLOCK_INTERVAL;
      childChain.currentDepositBlock = 1;
      childChain.currentFeeExit = 1;
      childChain.exitsQueues[address(0)] = address(new PriorityQueue());
      return _chain;
    }


    /**
     * @dev Allows Plasma chain operator to submit transaction merkle root.
     * @param _chain The index of child chain
     * @param _root The merkle root of a child chain transactions.
     */
    function submitBlock(address _chain, bytes32 _root)
        public
        onlyOperator(_chain)
    {
      ChildChain childChain = childChains[_chain];
      childChain.blocks[childChain.currentChildBlock] = ChildBlock({
          root: _root,
          timestamp: block.timestamp
      });

      // Update block numbers.
      childChain.currentChildBlock = childChain.currentChildBlock.add(CHILD_BLOCK_INTERVAL);
      childChain.currentDepositBlock = 1;

      emit BlockSubmitted(_root, block.timestamp);
    }

    /**
     * @dev Allows anyone to deposit funds into the Plasma chain.
     */
    function deposit(address _chain)
        public
        payable
    {
        ChildChain childChain = childChains[_chain];
        // Only allow up to CHILD_BLOCK_INTERVAL deposits per child block.
        require(childChain.currentDepositBlock < CHILD_BLOCK_INTERVAL);

        bytes32 root = keccak256(msg.sender, address(0), msg.value);
        uint256 depositBlock = getDepositBlock(_chain);
        childChain.blocks[depositBlock] = ChildBlock({
            root: root,
            timestamp: block.timestamp
        });
        childChain.currentDepositBlock = childChain.currentDepositBlock.add(1);
        childChain.weights[address(0)] += msg.value;

        emit Deposit(_chain, msg.sender, depositBlock, address(0), msg.value);
    }

    /**
     * @dev non owner deposit from shelter
     * @param _chain chain index
     * @param _pos shelter position of contract to deposit.
     */
    function depositFromShelter(address _chain, uint256 _pos)
      public
      payable
    {
      ChildChain childChain = childChains[_chain];
      require(childChain.currentDepositBlock < CHILD_BLOCK_INTERVAL);
      require(msg.sender == packet.exitor);

      Exit packet = shelter.packets[_pos];
      bytes32 root = keccak256(msg.sender, packet.token, packet.amount, packet.cont);
      uint256 depositBlock = getDepositBlock(_chain);
      childChain.blocks[depositBlock] = ChildBlock({
          root: root,
          timestamp: block.timestamp
      });
      childChain.currentDepositBlock = childChain.currentDepositBlock.add(1);
      childChain.weights[packet.token] += packet.amount;
      shelter.weights[packet.token] -= packet.amount;
      delete shelter.packets[_pos];

      emit DepositFromShelter(_chain, msg.sender, depositBlock, packet.token, packet.amount, packet.cont);
    }

    /**
     * @dev Starts an exit from a deposit.
     * @param _depositPos UTXO position of the deposit.
     * @param _token Token type to deposit.
     * @param _amount Deposit amount.
     */
    function startDepositExit(
      address _chain,
      uint256 _depositPos,
      address _token,
      uint256 _amount
    )
      public
    {
      ChildChain childChain = childChains[_chain];
      uint256 blknum = _depositPos / 1000000000;

      // Check that the given UTXO is a deposit.
      require(blknum % CHILD_BLOCK_INTERVAL != 0);

      // Validate the given owner and amount.
      bytes32 root = childChain.blocks[blknum].root;
      bytes32 depositHash = keccak256(msg.sender, _token, _amount);
      require(root == depositHash);

      addExitToQueue(
        _chain,
        _depositPos,
        msg.sender,
        msg.sender,
        _token,
        _amount,
        new bytes(0),
        childChain.blocks[blknum].timestamp
      );
    }

    /**
     * @dev Starts an exit from a contract deposit(non owner deposit).
     * @param _depositPos UTXO position of the deposit.
     * @param _token Token type to deposit.
     * @param _amount Deposit amount.
     * @param _cont contract bytes
     */
    function startDepositContractExit(
      address _chain,
      uint256 _depositPos,
      address _token,
      uint256 _amount,
      bytes _cont
    )
      public
    {
      ChildChain childChain = childChains[_chain];
      uint256 blknum = _depositPos / 1000000000;

      // Check that the given UTXO is a deposit.
      require(blknum % CHILD_BLOCK_INTERVAL != 0);

      // Validate the given owner and amount.
      bytes32 root = childChain.blocks[blknum].root;
      bytes32 depositHash = keccak256(msg.sender, _token, _amount, _cont);
      require(root == depositHash);

      addExitToQueue(
        _chain,
        _depositPos,
        msg.sender,
        address(0),
        _token,
        _amount,
        _cont,
        childChain.blocks[blknum].timestamp
      );
    }

    /**
     * @dev Allows the operator withdraw any allotted fees. Starts an exit to avoid theft.
     * @param _token Token to withdraw.
     * @param _amount Amount in fees to withdraw.
     */
    function startFeeExit(address _chain, address _token, uint256 _amount)
        public
        onlyOperator(_chain)
    {
      ChildChain childChain = childChains[_chain];
      addExitToQueue(
        _chain,
        childChain.currentFeeExit,
        msg.sender,
        msg.sender,
        _token,
        _amount,
        new bytes(0),
        block.timestamp + 1);
      childChain.currentFeeExit = childChain.currentFeeExit.add(1);
    }

    /**
     * @dev Starts to exit a specified utxo.
     * @param _utxoPos The position of the exiting utxo in the format of blknum * 1000000000 + index * 10000 + oindex.
     * @param _txBytes The transaction being exited in RLP bytes format.
     * @param _proof Proof of the exiting transactions inclusion for the block specified by utxoPos.
     * @param _sigs Both transaction signatures and confirmations signatures used to verify that the exiting transaction has been confirmed.
     */
    function startExit(
      address _chain,
      uint256 _utxoPos,
      bytes _txBytes,
      bytes _snapshot,
      bytes _proof,
      bytes _sigs
    )
      public
    {
      uint256 blknum = _utxoPos / 1000000000;
      uint256 txindex = (_utxoPos % 1000000000) / 10000;
      uint256 oindex = _utxoPos - blknum * 1000000000 - txindex * 10000; 

      var exitingTx = _txBytes.createExitingTx(oindex);
      var snapshot = _snapshot.createExitingContract();
      // check snapshot is valid
      require(exitingTx.snapshotId == sha256(_snapshot));
      require(snapshot.exitor == address(0) || msg.sender == snapshot.exitor);
      address owner = snapshot.cont.validateOwn();

      // Check the transaction was included in the chain and is correctly signed.
      var childBlock = childChains[_chain].blocks[blknum];
      bytes32 merkleHash = sha256(sha256(_txBytes), ByteUtils.slice(_sigs, 0, 130));
      // need signature for transaction
      require(Validate.checkSigs(sha256(_txBytes), childBlock.root, exitingTx.inputCount, _sigs));
      require(merkleHash.checkMembership(txindex, childBlock.root, _proof));

      addExitToQueue(
        _chain,
        _utxoPos,
        snapshot.exitor,
        owner,
        snapshot.token,
        snapshot.weight,
        snapshot.cont,
        childBlock.timestamp);
    }

    /**
     * @dev Allows anyone to challenge an exiting transaction by submitting proof of a double spend on the child chain.
     * @param _cUtxoPos The position of the challenging utxo.
     * @param _eUtxoIndex The output position of the exiting utxo.
     * @param _txBytes The challenging transaction in bytes RLP form.
     * @param _proof Proof of inclusion for the transaction used to challenge.
     * @param _sigs Signatures for the transaction used to challenge.
     * @param _confirmationSig The confirmation signature for the transaction used to challenge.
     */
    function challengeExit(
      address _chain,
      uint256 _cUtxoPos,
      uint256 _eUtxoIndex,
      bytes _txBytes,
      bytes _proof,
      bytes _sigs,
      bytes _confirmationSig
    )
      public
    {
      uint256 eUtxoPos = _txBytes.getUtxoPos(_eUtxoIndex);
      uint256 txindex = (_cUtxoPos % 1000000000) / 10000;
      bytes32 root = childChains[_chain].blocks[_cUtxoPos / 1000000000].root;
      var txHash = keccak256(_txBytes);
      
      var confirmationHash = keccak256(txHash, root);
      var merkleHash = keccak256(txHash, _sigs);
      address owner = childChains[_chain].exits[eUtxoPos].owner;

      // Validate the spending transaction.
      require(owner == ECRecovery.recover(confirmationHash, _confirmationSig));
      require(merkleHash.checkMembership(txindex, root, _proof));

      // Delete the owner but keep the amount to prevent another exit.
      delete childChains[_chain].exits[eUtxoPos].owner;
    }

    /**
     * @dev Determines the next exit to be processed.
     * @param _token Asset type to be exited.
     * @return A tuple of the position and time when this exit can be processed.
     */
    function getNextExit(address _chain, address _token)
        public
        view
        returns (uint256, uint256)
    {
        return PriorityQueue(childChains[_chain].exitsQueues[_token]).getMin();
    }

    /**
     * @dev Processes any exits that have completed the challenge period. 
     * @param _token Token type to process.
     */
    function finalizeExits(address _chain, address _token)
        public
    {
      ChildChain childChain = childChains[_chain];
      uint256 utxoPos;
      uint256 exitableAt;
      (exitableAt, utxoPos) = getNextExit(_chain, _token);
      PriorityQueue queue = PriorityQueue(childChain.exitsQueues[_token]);
      Exit memory currentExit = childChain.exits[utxoPos];
      while (exitableAt < block.timestamp) {
        currentExit = childChain.exits[utxoPos];

        // TODO: handle ERC-20 transfer
        require(address(0) == _token);
        require(_token == currentExit.token);
        require(childChain.weights[_token] >= currentExit.amount);

        // if there is no owner
        if(currentExit.owner == address(0)) {
          shelter.weights[_token] += currentExit.amount;
          shelter.packets[utxoPos] = currentExit;

        }else{
          currentExit.owner.transfer(currentExit.amount);
        }
        childChain.weights[_token] -= currentExit.amount;
        queue.delMin();
        delete childChain.exits[utxoPos].owner;

        if (queue.currentSize() > 0) {
            (exitableAt, utxoPos) = getNextExit(_chain, _token);
        } else {
            return;
        }
      }
    }


    /* 
     * Public view functions
     */

    /**
     * @dev Queries the child chain.
     * @param _blockNumber Number of the block to return.
     * @return Child chain block at the specified block number.
     */
    function getChildChain(address _chain, uint256 _blockNumber)
        public
        view
        returns (bytes32, uint256)
    {
      ChildChain childChain = childChains[_chain];
      return (childChain.blocks[_blockNumber].root, childChain.blocks[_blockNumber].timestamp);
    }

    /**
     * @dev Determines the next deposit block number.
     * @return Block number to be given to the next deposit block.
     */
    function getDepositBlock(address _chain)
        public
        view
        returns (uint256)
    {
      ChildChain childChain = childChains[_chain];
      return childChain.currentChildBlock
              .sub(CHILD_BLOCK_INTERVAL)
              .add(childChain.currentDepositBlock);
    }

    /**
     * @dev Returns information about an exit.
     * @param _utxoPos Position of the UTXO in the chain.
     * @return A tuple representing the active exit for the given UTXO.
     */
    function getExit(address _chain, uint256 _utxoPos)
        public
        view
        returns (address, address, uint256)
    {
      ChildChain childChain = childChains[_chain];
      return (
        childChain.exits[_utxoPos].owner,
        childChain.exits[_utxoPos].token,
        childChain.exits[_utxoPos].amount
      );
    }


    /*
     * Private functions
     */

    /**
     * @dev Adds an exit to the exit queue.
     * @param _utxoPos Position of the UTXO in the child chain.
     * @param _exitor Owner of the UTXO.
     * @param _token Token to be exited.
     * @param _amount Amount to be exited.
     * @param _created_at Time when the UTXO was created.
     */
    function addExitToQueue(
      address _chain, 
      uint256 _utxoPos,
      address _exitor,
      address _owner,
      address _token,
      uint256 _amount,
      bytes _cont,
      uint256 _created_at
    )
      private
    {

      // Check that we're exiting a known token.
      require(childChains[_chain].exitsQueues[_token] != address(0));

      // Check exit is valid and doesn't already exist.
      require(_amount > 0);
      require(childChains[_chain].exits[_utxoPos].amount == 0);

      // Calculate priority.
      uint256 exitableAt = Math.max(_created_at + 2 weeks, block.timestamp + 1 weeks);
      PriorityQueue queue = PriorityQueue(childChains[_chain].exitsQueues[_token]);
      queue.insert(exitableAt, _utxoPos);

      childChains[_chain].exits[_utxoPos] = Exit({
        owner: _owner,
        exitor: _exitor,
        token: _token,
        amount: _amount,
        cont: _cont
      });

      emit ExitStarted(msg.sender, _utxoPos, _token, _amount);
    }
}

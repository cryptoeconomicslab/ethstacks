pragma solidity ^0.4.24;

import "./SumMerkleTree.sol";

contract SumMerkleTreeTest {

  function checkMembership(
    uint256 range,
    bytes32 leaf,
    uint256 index,
    uint256 totalAmount,
    uint256 leftOffset,
    bytes32 rootHash,
    bytes proof
  )
    public
    pure
    returns (bool)
  {
    return SumMerkleTree.checkMembership(
      range,
      leaf,
      index,
      totalAmount,
      leftOffset,
      rootHash,
      proof
    );
  }

}

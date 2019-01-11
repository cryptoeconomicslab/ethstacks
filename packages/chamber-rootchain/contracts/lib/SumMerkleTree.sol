pragma solidity ^0.4.24;


/**
 * @title SumMerkleTree
 * @dev Checks that a particular leaf node is in a given Merkle tree given the index, root hash, and a proof
 */
library SumMerkleTree {

  function checkMembership(
    uint256 range,
    bytes32 leaf,
    uint256 index,
    uint256 totalAmount,
    uint256 leftOffset,
    bytes32 rootHash,
    bytes proof
  )
    internal
    pure
    returns (bool)
  {
    bytes32 proofElement;
    uint256 currentAmount = range;
    uint256 lastLeftAmount = 0;
    bytes32 computedHash = leaf;
    uint256 len = (proof.length / 64) * 64;

    for (uint256 i = 64; i <= len; i += 64) {
      uint256 amount;
      assembly {
        amount := mload(add(proof, sub(i, 32)))
        proofElement := mload(add(proof, i))
      }
      if (index % 2 == 0) {
        computedHash = keccak256(currentAmount, computedHash, amount, proofElement);
      } else {
        computedHash = keccak256(amount, proofElement, currentAmount, computedHash);
        lastLeftAmount = currentAmount - range;
      }
      currentAmount += amount;
      index = index / 2;
    }
    return (computedHash == rootHash)
              && (lastLeftAmount == leftOffset)
              && (currentAmount == totalAmount);
  }

}

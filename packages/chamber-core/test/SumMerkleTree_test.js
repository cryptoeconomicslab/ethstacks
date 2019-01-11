const assert = require('assert');
const BigNumber = require('bignumber.js');
const {
  SumMerkleTreeNode,
  SumMerkleTree
} = require('../lib/SumMerkleTree');

describe('SumMerkleTree', function() {

  describe('verify', function() {

    it('should be success to verify', function() {
      const leaves = [];
      leaves[0] = new SumMerkleTreeNode(
        new Buffer('f19587814e8e932897572358b3c0ca6d9cbcc71654b1d312195607aa2b000001', 'hex'),
        BigNumber(2)
      );
      leaves[1] = new SumMerkleTreeNode(
        new Buffer('f19587814e8e932897572358b3c0ca6d9cbcc71654b1d312195607aa2b000002', 'hex'),
        BigNumber(3)
      );
      leaves[2] = new SumMerkleTreeNode(
        new Buffer('f19587814e8e932897572358b3c0ca6d9cbcc71654b1d312195607aa2b000003', 'hex'),
        BigNumber(4)
      );
      leaves[3] = new SumMerkleTreeNode(
        new Buffer('f19587814e8e932897572358b3c0ca6d9cbcc71654b1d312195607aa2b000004', 'hex'),
        BigNumber(5)
      );
      leaves[4] = new SumMerkleTreeNode(
        new Buffer('f19587814e8e932897572358b3c0ca6d9cbcc71654b1d312195607aa2b000005', 'hex'),
        BigNumber(10)
      );
      const tree = new SumMerkleTree(leaves);
      const root = tree.root();
      const proof = tree.proof(leaves[2]);
      assert.equal(tree.root().toString('hex'), '95cb4e0012c0cd6674800bc14c15d1af47a202067789e652d49c60b3f4f1c1cc');
      assert.equal(tree.verify(
        leaves[2].getLengthAsBigNumber(), // leaf amount
        leaves[2].getHash(),    // leaf hash
        2,
        BigNumber(24), // total deposit
        BigNumber(5), // left offset
        root,
        proof), true);
    });

  });

});

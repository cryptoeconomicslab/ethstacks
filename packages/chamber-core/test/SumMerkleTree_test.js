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
      const tree = new SumMerkleTree(leaves);
      const root = tree.root();
      const proof = tree.proof(leaves[2]);
      assert.equal(tree.root().toString('hex'), 'ebb8ba315482e3536c34265ee2c1bf02c13a9fd4ceb10807b6d2ffbcd02d8ee5');
      assert.equal(tree.verify(
        leaves[2].getLengthAsBigNumber(), // leaf amount
        leaves[2].getHash(),    // leaf hash
        2,
        BigNumber(14), // total deposit
        BigNumber(5), // left offset
        root,
        proof), true);
    });

  });

});

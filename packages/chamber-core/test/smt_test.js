const assert = require('assert');
const SparseMerkleTree = require('../lib/smt');
const utils = require('ethereumjs-util');

describe('SparseMerkleTree', function() {

  describe('verify', function() {

    const zeroHash = utils.keccak(0);

    it('normal', function() {
      const leaves = Array.from(Array(Math.pow(2, 16)), () => null);
      leaves[0] = new Buffer('f19587814e8e932897572358b3c0ca6d9cbcc71654b1d312195607aa2b000001', 'hex');
      leaves[1] = new Buffer('f19587814e8e932897572358b3c0ca6d9cbcc71654b1d312195607aa2b000002', 'hex');
      leaves[2] = new Buffer('f19587814e8e932897572358b3c0ca6d9cbcc71654b1d312195607aa2b000003', 'hex');
      leaves[3] = new Buffer('f19587814e8e932897572358b3c0ca6d9cbcc71654b1d312195607aa2b000004', 'hex');
      leaves[4] = new Buffer('f19587814e8e932897572358b3c0ca6d9cbcc71654b1d312195607aa2b000005', 'hex');
      leaves[5] = new Buffer('f19587814e8e932897572358b3c0ca6d9cbcc71654b1d312195607aa2b000006', 'hex');
      const unknownLeaf = new Buffer('111187814e8e932897572358b3c0ca6d9cbcc71654b1d312195607aa2b000006', 'hex');
      const tree = new SparseMerkleTree(16, leaves);
      const root = tree.root();
      const proof = tree.proof(2);
      assert.equal(tree.root().toString('hex'), '90fa290e1e949c38f8ba0a2ea3a784f6b571c09f5641c240fbe69b1b5c2e03b4');
      assert.equal(proof.length, 512);
      assert.equal(SparseMerkleTree.verify(leaves[2], 2, root, proof), true);
      assert.equal(SparseMerkleTree.verify(unknownLeaf, 2, root, proof), false);
      assert.equal(SparseMerkleTree.verify(zeroHash, 7, root, tree.proof(7)), true);
    });

    it('odd leaves', function() {
      const leaves = Array.from(Array(Math.pow(2, 16)), () => null);
      leaves[0] = new Buffer('f19587814e8e932897572358b3c0ca6d9cbcc71654b1d312195607aa2b000001', 'hex');
      leaves[1] = new Buffer('f19587814e8e932897572358b3c0ca6d9cbcc71654b1d312195607aa2b000002', 'hex');
      leaves[2] = new Buffer('f19587814e8e932897572358b3c0ca6d9cbcc71654b1d312195607aa2b000003', 'hex');
      leaves[3] = new Buffer('f19587814e8e932897572358b3c0ca6d9cbcc71654b1d312195607aa2b000004', 'hex');
      leaves[4] = new Buffer('f19587814e8e932897572358b3c0ca6d9cbcc71654b1d312195607aa2b000005', 'hex');
      const tree = new SparseMerkleTree(16, leaves);
      const root = tree.root();
      const proof = tree.proof(1);
      assert.equal(tree.root().toString('hex'), '010776b71fb8db82fa8d10a2086e69d8b92e95207c78291d1f1aff8355f2d0c6');
      assert.equal(proof.length, 512);
      assert.equal(SparseMerkleTree.verify(leaves[1], 1, root, proof), true);
    });

  });

});

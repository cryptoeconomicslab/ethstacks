const { injectInTruffle } = require('sol-trace');
injectInTruffle(web3, artifacts);

const SumMerkleTreeTest = artifacts.require('SumMerkleTreeTest');
const BigNumber = require('bignumber.js');
const utils = require('ethereumjs-util');
const {
  SumMerkleTreeNode,
  SumMerkleTree
} = require('@cryptoeconomicslab/chamber-core');


contract('SumMerkleTreeTest', function ([user, owner, recipient, user4, user5]) {

  beforeEach(async function () {
    this.sumMerkleTree = await SumMerkleTreeTest.new();
  });

  describe('checkMembership', function () {

    const gasLimit = 200000;

    it('should be success to checkMembership', async function() {
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
      const result = await this.sumMerkleTree.checkMembership(
        leaves[2].getLengthAsBigNumber().toNumber(),  // leaf amount
        utils.bufferToHex(leaves[2].getHash()),       // leaf hash
        2,
        24, // total deposit
        5, // left offset
        utils.bufferToHex(root),
        utils.bufferToHex(proof),
        {from: user, gas: gasLimit});
      assert.equal(result, true);
  
    });

  });

});

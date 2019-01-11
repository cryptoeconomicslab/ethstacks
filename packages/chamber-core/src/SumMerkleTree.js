const utils = require('ethereumjs-util');
const BigNumber = require('bignumber.js');
const BufferUtils = require('./BufferUtils');

class SumMerkleTreeNode {

  constructor(hash, len) {
    this.hash = hash;
    this.len = len;
  }

  getHash() {
    return this.hash;
  }

  getLength() {
    return BufferUtils.bignumTo32BytesBuf(this.len);
  }

  getLengthAsBigNumber() {
    return this.len;
  }

  toBytes() {
    return Buffer.concat([this.getLength(), this.getHash()]);
  }

  static getEmpty() {
    return new SumMerkleTreeNode(
      utils.zeros(32),
      BigNumber(0)
    );
  }

}

/**
 * @dev SumMerkleTree
 */
class SumMerkleTree {

  /**
   * @dev constructor
   * @param {SumMerkleTreeNode[]} leaves 
   */
  constructor(leaves) {
    if(!Array.isArray(leaves) || leaves.length < 1) {
      throw new Error('invalid leaves');
    }

    const depth = Math.ceil(Math.log(leaves.length) / Math.log(2));
    if(depth > 20) {
      throw new Error('depth must be 20 or less');
    }

    const layer = leaves.concat(
      Array.from(
        Array(Math.pow(2, depth) - leaves.length),
        () => SumMerkleTreeNode.getEmpty()));

    this.leaves = layer;
    this.layers = [layer].concat(this.createLayers(layer));
  }

  /**
   * 
   * @param {SumMerkleTreeNode[]} nodes 
   */
  createLayers(nodes) {
    if(nodes.length <= 1) {
      return [];
    }

    const treeLevel = [];
    for(let i = 0; i < nodes.length; i += 2) {
      const left = nodes[i];
      const right = nodes[i + 1];
      const newNode = new SumMerkleTreeNode(utils.keccak(Buffer.concat([
        left.getLength(),
        left.getHash(),
        right.getLength(),
        right.getHash()])),
        left.getLengthAsBigNumber().plus(right.getLengthAsBigNumber()));
      treeLevel.push(newNode);
    }

    if(nodes.length % 2 === 1) {
      treeLevel.push(nodes[nodes.length - 1]);
    }

    return [treeLevel].concat(this.createLayers(treeLevel));
  }

  getLeaves() {
    return this.leaves;
  }

  root() {
    const rootLayer = this.layers[this.layers.length - 1];
    if(rootLayer.length != 1) {
      throw new Error('invalid root');
    }
    return rootLayer[0].getHash();
  }

  /**
   * 
   * @param {SumMerkleTreeNode} leaf 
   */
  getIndex(leaf) {
    let index = -1

    for(let i = 0; i < this.leaves.length; i++) {
      if(Buffer.compare(leaf.getHash(), this.leaves[i].getHash()) === 0) {
        index = i;
      }
    }
    return index;
  }

  proof(leaf) {
    let index = this.getIndex(leaf);
    if(index < 0) {
      throw new Error('invalid leaf');
    }

    const proof = []
    if(index <= this.getLeaves().length) {
      for(let i = 0; i < this.layers.length - 1; i++) {
        let layerIndex = (index % 2 === 0) ? (index + 1) : (index - 1);
        index = Math.floor(index / 2);

        proof.push(this.layers[i][layerIndex].toBytes());
      }
    }
    return Buffer.concat(proof);
  }

  verify(
    range,
    value,
    index,
    totalAmount,
    leftOffset,
    root,
    proof
  ) {
    if(!value || !root) {
      return false;
    }

    let currentAmount = range;
    let hash = value;
    let lastLeftAmount = 0
    for(let i = 0; i < proof.length; i += 64) {
      const amount = proof.slice(i, i + 32);
      const node = proof.slice(i + 32, i + 64);
      const currentAmountBuf = BufferUtils.bignumTo32BytesBuf(currentAmount);
      let buf = [];
      if(index % 2 === 0) {
        buf = [currentAmountBuf, hash, amount, node];
      }else{
        buf = [amount, node, currentAmountBuf, hash];
        lastLeftAmount = currentAmount.minus(range);
      }
      currentAmount = currentAmount.plus(BufferUtils.bufferToBignum(amount));
      hash = utils.keccak(Buffer.concat(buf));
      index = Math.floor(index / 2);
    }
    
    return (
      Buffer.compare(hash, root) === 0
      && currentAmount.eq(totalAmount)
      && lastLeftAmount.eq(leftOffset));
  }
}

module.exports = {
  SumMerkleTreeNode,
  SumMerkleTree
}

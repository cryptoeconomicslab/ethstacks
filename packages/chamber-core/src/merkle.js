const utils = require('ethereumjs-util');

/**
 * @dev MerkleTree
 */
class MerkleTree {

  /**
   * @dev constructor
   * @param {*} leaves 
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
        () => utils.zeros(32)));

    this.leaves = layer;
    this.layers = [layer].concat(this.createLayers(layer));
  }

  createLayers(nodes) {
    if(nodes.length <= 1) {
      return [];
    }

    const treeLevel = [];
    for(let i = 0; i < nodes.length; i += 2) {
      const left = nodes[i];
      const right = nodes[i + 1];
      treeLevel.push(utils.keccak(Buffer.concat([left, right])));
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
    return rootLayer[0];
  }

  getIndex(leaf) {
    let index = -1
    for(let i = 0; i < this.leaves.length; i++) {
      if(Buffer.compare(leaf, this.leaves[i]) === 0) {
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
        proof.push(this.layers[i][layerIndex]);
      }
    }
    return Buffer.concat(proof);
  }

  verify(value, index, root, proof) {
    if(!value || !root) {
      return false;
    }

    let hash = value;
    for(let i = 0; i < proof.length; i += 32) {
      const node = proof.slice(i, i + 32);
      const buf = (index % 2 === 0) ? ([hash, node]) : ([node, hash]);
      hash = utils.keccak(Buffer.concat(buf));
      index = Math.floor(index / 2);
    }

    return Buffer.compare(hash, root) === 0;
  }
}

module.exports = MerkleTree;

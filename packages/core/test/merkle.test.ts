import { describe, it } from 'mocha'
import { SumMerkleTreeNode, SumMerkleTree } from '../src'
import { assert } from 'chai'
import { utils } from 'ethers'
import BigNumber = utils.BigNumber

describe('SumMerkleTree', function() {
  describe('verify', function() {
    const leaves: SumMerkleTreeNode[] = []
    leaves[0] = new SumMerkleTreeNode(
      Buffer.from(
        'f19587814e8e932897572358b3c0ca6d9cbcc71654b1d312195607aa2b000001',
        'hex'
      ),
      new BigNumber(2)
    )
    leaves[1] = new SumMerkleTreeNode(
      Buffer.from(
        'f19587814e8e932897572358b3c0ca6d9cbcc71654b1d312195607aa2b000002',
        'hex'
      ),
      new BigNumber(3)
    )
    leaves[2] = new SumMerkleTreeNode(
      Buffer.from(
        'f19587814e8e932897572358b3c0ca6d9cbcc71654b1d312195607aa2b000003',
        'hex'
      ),
      new BigNumber(4)
    )
    leaves[3] = new SumMerkleTreeNode(
      Buffer.from(
        'f19587814e8e932897572358b3c0ca6d9cbcc71654b1d312195607aa2b000004',
        'hex'
      ),
      new BigNumber(5)
    )
    leaves[4] = new SumMerkleTreeNode(
      Buffer.from(
        'f19587814e8e932897572358b3c0ca6d9cbcc71654b1d312195607aa2b000005',
        'hex'
      ),
      new BigNumber(10)
    )

    it('should be succeeded to verify', function() {
      const tree = new SumMerkleTree(leaves)
      const root = tree.root()
      const proofs = tree.proofs(0, leaves[2].getHash())
      //assert.equal(root.toString('hex'), '95cb4e0012c0cd6674800bc14c15d1af47a202067789e652d49c60b3f4f1c1cc');
      assert.equal(
        SumMerkleTree.verify(
          new BigNumber(5),
          new BigNumber(9),
          leaves[2].getHash(), // leaf hash
          new BigNumber(24), // total deposit
          root,
          proofs[0]
        ),
        true
      )
    })

    it('should be failed to verify by invalid total deposit', function() {
      const tree = new SumMerkleTree(leaves)
      const root = tree.root()
      const proofs = tree.proofs(0, leaves[2].getHash())
      assert.equal(
        SumMerkleTree.verify(
          new BigNumber(5),
          new BigNumber(9),
          leaves[2].getHash(), // leaf hash
          new BigNumber(30), // total deposit
          root,
          proofs[0]
        ),
        false
      )
    })

    it('should be failed to verify by invalid left offset', function() {
      const tree = new SumMerkleTree(leaves)
      const root = tree.root()
      const proofs = tree.proofs(0, leaves[2].getHash())
      assert.equal(
        SumMerkleTree.verify(
          new BigNumber(7),
          new BigNumber(9),
          leaves[2].getHash(), // leaf hash
          new BigNumber(24), // total deposit
          root,
          proofs[0]
        ),
        false
      )
    })

    it('should be failed to verify because of non-inclusion', function() {
      const tree = new SumMerkleTree(leaves)
      const root = tree.root()
      const proofs = tree.proofs(0, leaves[2].getHash())
      assert.equal(
        SumMerkleTree.verify(
          new BigNumber(5),
          new BigNumber(9),
          leaves[0].getHash(), // leaf hash
          new BigNumber(24), // total deposit
          root,
          proofs[0]
        ),
        false
      )
    })
  })
})

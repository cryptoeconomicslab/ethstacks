import { SumMerkleProof, SumMerkleTree } from '../merkle'
import { constants, utils } from 'ethers'
import { TOTAL_AMOUNT } from '../helpers/constants'

export class ExclusionProof {
  public static deserialize(data: any) {
    return new ExclusionProof(data.root, SumMerkleProof.deserialize(data.proof))
  }
  public root: string
  public proof: SumMerkleProof

  constructor(root: string, proof: SumMerkleProof) {
    this.root = root
    this.proof = proof
  }

  public getRoot() {
    return this.root
  }

  public checkExclusion() {
    return SumMerkleTree.verify(
      this.proof.segment.start,
      this.proof.segment.end,
      Buffer.from(utils.keccak256(constants.HashZero).substr(2), 'hex'),
      TOTAL_AMOUNT.mul(this.proof.numTokens),
      Buffer.from(this.root.substr(2), 'hex'),
      this.proof
    )
  }

  public serialize() {
    return {
      type: 'E',
      root: this.root,
      proof: this.proof.serialize()
    }
  }
}

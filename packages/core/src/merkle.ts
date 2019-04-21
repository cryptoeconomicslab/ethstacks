import { constants, utils } from 'ethers'
import { Segment } from './segment'
import BigNumber = utils.BigNumber

export class SumMerkleTreeNode {
  public static getEmpty() {
    return new SumMerkleTreeNode(
      utils.keccak256(constants.HashZero),
      new BigNumber(0)
    )
  }
  public hash: Buffer
  public len: BigNumber

  constructor(hash: Buffer | String, len: BigNumber) {
    if (typeof hash == 'string' && utils.isHexString(hash)) {
      this.hash = Buffer.from(utils.arrayify(hash))
    } else if (hash instanceof Buffer) {
      this.hash = hash
    } else {
      throw new Error('invalid hash type')
    }
    this.len = len
  }

  public getHash(): Buffer {
    return this.hash
  }

  public getLength8Byte(): Buffer {
    return bignumTo8BytesBuffer(this.len)
  }
  public getLength32Byte(): Buffer {
    return bignumTo32BytesBuffer(this.len)
  }

  public getLengthAsBigNumber(): BigNumber {
    return this.len
  }

  public toBytes(leftOrRight: number): Buffer {
    return Buffer.concat([
      Buffer.from([leftOrRight]),
      this.getLength8Byte(),
      this.getHash()
    ])
  }
}

export class SumMerkleProof {
  public static deserialize(data: any): SumMerkleProof {
    return new SumMerkleProof(
      data.numTokens,
      data.index,
      Segment.deserialize(data.segment),
      data.leaf,
      data.proof
    )
  }
  public numTokens: number
  public index: number
  public segment: Segment
  public leaf: string
  public proof: string

  constructor(
    numTokens: number,
    index: number,
    segment: Segment,
    leaf: string,
    proof: string
  ) {
    this.numTokens = numTokens
    this.index = index
    this.segment = segment
    this.leaf = leaf
    this.proof = proof
  }

  public toHex() {
    const numTokens = utils.padZeros(
      utils.arrayify(utils.bigNumberify(this.numTokens)),
      2
    )
    const body = utils.arrayify(this.proof)
    return utils.hexlify(utils.concat([numTokens, body]))
  }

  public serialize() {
    return {
      numTokens: this.numTokens,
      index: this.index,
      segment: this.segment.serialize(),
      leaf: this.leaf,
      proof: this.proof
    }
  }
}

/**
 * @description SumMerkleTree
 *     see https://ethresear.ch/t/plasma-prime-design-proposal/4222
 */
export class SumMerkleTree {
  /**
   * @description verify the leaf is included in tree
   * @param {Number} range is amount of the leaf to verify
   * @param {Buffer} value is the leaf value
   * @param {Number} index is index of the leaf to verify
   * @param {Number} totalAmount is total amount of tree
   * @param {Number} leftOffset is the position of the leaf from left
   * @param {Buffer} root is root of tree
   * @param {SumMerkleProof} proof is proof buffer for the leaf
   */
  public static verify(
    start: BigNumber,
    end: BigNumber,
    value: Buffer,
    totalAmount: BigNumber,
    root: Buffer,
    sumMerkleProof: SumMerkleProof
  ) {
    if (!value || !root) {
      return false
    }
    const proof = Buffer.from(sumMerkleProof.proof.substr(2), 'hex')
    let currentAmount = end.sub(start)
    let currentLeft = new BigNumber(0)
    let currentRight = totalAmount
    let hash = value
    for (let i = 0; i < proof.length; i += 41) {
      const leftOrRight = proof.slice(i, i + 1).readUInt8(0)
      const amount = proof.slice(i + 1, i + 9)
      const node = proof.slice(i + 9, i + 41)
      const currentAmountBuf = bignumTo32BytesBuffer(currentAmount)
      let buf = []
      if (leftOrRight === 0) {
        currentRight = currentRight.sub(utils.bigNumberify(amount))
        buf = [currentAmountBuf, hash, convert32(amount), node]
      } else {
        currentLeft = currentLeft.add(utils.bigNumberify(amount))
        buf = [convert32(amount), node, currentAmountBuf, hash]
      }
      currentAmount = currentAmount.add(utils.bigNumberify(amount))
      hash = keccak256(Buffer.concat(buf))
    }

    return (
      Buffer.compare(hash, root) === 0 &&
      currentAmount.eq(totalAmount) &&
      currentLeft.lte(start) &&
      currentRight.gte(end)
    )
  }
  public leaves: SumMerkleTreeNode[]
  public layers: SumMerkleTreeNode[][]

  /**
   * @dev constructor
   * @param {SumMerkleTreeNode[]} leaves
   */
  constructor(leaves: SumMerkleTreeNode[]) {
    if (!Array.isArray(leaves) || leaves.length < 1) {
      throw new Error('invalid leaves')
    }

    const depth = Math.ceil(Math.log(leaves.length) / Math.log(2))
    if (depth > 20) {
      throw new Error('depth must be 20 or less')
    }

    const layer = leaves.concat(
      Array.from(Array(Math.pow(2, depth) - leaves.length), () =>
        SumMerkleTreeNode.getEmpty()
      )
    )

    this.leaves = layer
    this.layers = [layer].concat(this.createLayers(layer))
  }

  /**
   *
   * @param {SumMerkleTreeNode[]} nodes
   */
  public createLayers(nodes: SumMerkleTreeNode[]): SumMerkleTreeNode[][] {
    if (nodes.length <= 1) {
      return []
    }

    const treeLevel = []
    for (let i = 0; i < nodes.length; i += 2) {
      const left = nodes[i]
      const right = nodes[i + 1]
      const buf = keccak256(
        Buffer.concat([
          left.getLength32Byte(),
          left.getHash(),
          right.getLength32Byte(),
          right.getHash()
        ])
      )
      const newNode = new SumMerkleTreeNode(
        buf,
        left.getLengthAsBigNumber().add(right.getLengthAsBigNumber())
      )
      treeLevel.push(newNode)
    }

    if (nodes.length % 2 === 1) {
      treeLevel.push(nodes[nodes.length - 1])
    }

    return [treeLevel].concat(this.createLayers(treeLevel))
  }

  public getLeaves() {
    return this.leaves
  }

  public root() {
    const rootLayer = this.layers[this.layers.length - 1]
    if (rootLayer.length != 1) {
      throw new Error('invalid root')
    }
    return rootLayer[0].getHash()
  }

  /**
   *
   * @param {SumMerkleTreeNode} leaf
   */
  public proofs(numTokens: number, leaf: Buffer): SumMerkleProof[] {
    const proofs = []
    let start = new BigNumber(0)
    const end = new BigNumber(0)

    for (let i = 0; i < this.leaves.length; i++) {
      const amount = this.leaves[i].getLengthAsBigNumber()
      if (Buffer.compare(leaf, this.leaves[i].getHash()) === 0) {
        proofs.push(
          new SumMerkleProof(
            numTokens,
            i,
            Segment.fromGlobal(start, start.add(amount)),
            utils.hexlify(this.leaves[i].getHash()),
            utils.hexlify(this._proof(i))
          )
        )
      }
      start = start.add(amount)
    }
    return proofs
  }

  /**
   * getProofByRange
   * @param {BigNumber} offset
   */
  public getProofByRange(
    numTokens: number,
    start: BigNumber,
    end: BigNumber
  ): SumMerkleProof[] {
    let offsetStart = new BigNumber(0)
    const proofs = []

    for (let i = 0; i < this.leaves.length; i++) {
      const amount = this.leaves[i].getLengthAsBigNumber()
      const offsetEnd = offsetStart.add(amount)
      // offsetStart < end and start < offsetEnd
      if (end.gt(offsetStart) && offsetEnd.gt(start)) {
        proofs.push(
          new SumMerkleProof(
            numTokens,
            i,
            Segment.fromGlobal(offsetStart, offsetEnd),
            utils.hexlify(this.leaves[i].getHash()),
            utils.hexlify(this._proof(i))
          )
        )
      }
      offsetStart = offsetEnd
    }
    return proofs
  }

  public _proof(index: number): Buffer {
    if (index < 0) {
      throw new Error('invalid leaf')
    }

    const proof = []
    if (index <= this.getLeaves().length) {
      for (let i = 0; i < this.layers.length - 1; i++) {
        const leftOrRight = index % 2 === 0
        const layerIndex = leftOrRight ? index + 1 : index - 1
        index = Math.floor(index / 2)
        proof.push(this.layers[i][layerIndex].toBytes(leftOrRight ? 0 : 1))
      }
    }
    return Buffer.concat(proof)
  }
}

/**
 * bignumTo8BytesBuffer
 * @param {BigNumber} bn
 */
function bignumTo8BytesBuffer(bn: BigNumber): Buffer {
  const str = bn.toHexString()
  return Buffer.from(utils.hexZeroPad(str, 8).substr(2), 'hex')
}

/**
 * bignumTo32BytesBuffer
 * @param {BigNumber} bn
 */
function bignumTo32BytesBuffer(bn: BigNumber): Buffer {
  const str = bn.toHexString()
  return Buffer.from(utils.hexZeroPad(str, 32).substr(2), 'hex')
}

function convert32(amount: Buffer): Buffer {
  return Buffer.from(
    utils.hexZeroPad(utils.hexlify(amount), 32).substr(2),
    'hex'
  )
}

/**
 *
 * @param b is Buffer
 */
function keccak256(b: Buffer): Buffer {
  return Buffer.from(utils.keccak256(utils.hexlify(b)).substr(2), 'hex')
}

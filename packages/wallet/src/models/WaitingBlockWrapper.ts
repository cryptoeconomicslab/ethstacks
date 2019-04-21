import { bigNumberify, BigNumber } from 'ethers/utils'

export class WaitingBlockWrapper {
  public static deserialize(str: string) {
    const data = JSON.parse(str)
    return new WaitingBlockWrapper(bigNumberify(data.blkNum), data.root)
  }
  public blkNum: BigNumber
  public root: string

  constructor(blkNum: BigNumber, root: string) {
    this.blkNum = blkNum
    this.root = root
  }

  public serialize() {
    return JSON.stringify({
      blkNum: this.blkNum.toString(),
      root: this.root
    })
  }
}

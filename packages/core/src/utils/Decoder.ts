import { utils } from 'ethers'

export class DecoderUtility {
  public static encode(hex: string[]) {
    return utils.hexlify(
      utils.concat(hex.map(h => utils.padZeros(utils.arrayify(h), 32)))
    )
  }

  public static decode(bytes: string) {
    const len = Math.floor(utils.hexDataLength(bytes) / 32)
    const arr = []
    for (let i = 0; i < len; i++) {
      arr.push(utils.hexDataSlice(bytes, i * 32, i * 32 + 32))
    }
    return arr
  }

  public static getAddress(addressString: string) {
    return utils.getAddress(utils.hexDataSlice(addressString, 12, 32))
  }
}

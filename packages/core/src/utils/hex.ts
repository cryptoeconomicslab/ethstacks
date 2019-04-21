import { utils } from 'ethers'

export class HexUtil {
  public static concat(hexStringList: string[]) {
    return utils.hexlify(
      utils.concat(hexStringList.map(hex => utils.arrayify(hex)))
    )
  }
}

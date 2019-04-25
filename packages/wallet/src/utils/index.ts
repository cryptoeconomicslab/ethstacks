import {
  BigNumber,
  formatEther,
  formatUnits,
  parseEther,
  parseUnits
} from 'ethers/utils'

// TODO: make it inside sdk
export function getTokenName(tokenId: number) {
  switch (tokenId) {
    case 0:
      return 'ETH'
    case 1:
      return 'TEST'
    case 2:
      return 'DAI'
    default:
      return 'ETH'
  }
}

// TODO: create for general
// TODO: support a decimal
export function getTokenMinDigits(tokenId: number, amount: BigNumber): number {
  switch (tokenId) {
    case 0:
      return parseInt(formatEther(parseUnits(amount.toString(), 'gwei')))
    default:
      return amount.toNumber()
  }
}

export function getTokenMaxDigits(tokenId: number, amount: number): number {
  switch (tokenId) {
    case 0:
      return parseInt(formatUnits(parseEther(amount.toString()), 'gwei'))
    default:
      return amount
  }
}
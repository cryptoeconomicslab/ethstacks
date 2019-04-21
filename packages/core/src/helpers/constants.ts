import { utils } from 'ethers'
import BigNumber = utils.BigNumber
import { HashZero } from 'ethers/constants'
import { Hash } from './types'

/**
 * @title TotalAmount
 * total amount is 2^48
 */
export const TOTAL_AMOUNT = new BigNumber(2).pow(48)
export const MASK8BYTES = new BigNumber(2).pow(64)
export const ZERO_HASH: Hash = utils.keccak256(HashZero)
export const EXIT_BOND: BigNumber = utils.parseEther('0.001')
export const CHALLENGE_BOND: BigNumber = utils.parseEther('0.001')
export const FORCE_INCLUDE_BOND: BigNumber = utils.parseEther('0.001')
export const CHECKPOINT_BOND: BigNumber = utils.parseEther('0.1')
export const OwnStateAddress: string =
  '0x4bfd9Cd9DA9e9D2258796f62fD2B3D3C44dEe479'

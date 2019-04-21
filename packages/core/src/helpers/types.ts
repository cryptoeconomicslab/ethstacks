import { BigNumber } from 'ethers/utils'

export type HexString = string
export type Hash = HexString

export type Signature = HexString
export type LockState = HexString
export type Address = HexString
export type RLPItem = any | Address | BigNumber | HexString
export type RLPTx = RLPItem[]

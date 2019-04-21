export interface IStorage {
  set(key: string, value: string): Promise<boolean>
  get(key: string): Promise<string>
  delete(key: string): Promise<boolean>
  addProof(key: string, blkNum: number, value: string): Promise<boolean>
  getProof(key: string, blkNum: number): Promise<string>
  addBlockHeader(blkNum: number, value: string): Promise<boolean>
  getBlockHeader(blkNum: number): Promise<string>
  searchBlockHeader(
    fromBlkNum: number,
    toBlkNum: number
  ): Promise<Array<{ blkNum: number; value: string }>>
  addAction(id: string, blkNum: number, value: string): Promise<boolean>
  searchActions(
    blkNum: number
  ): Promise<Array<{ blkNum: number; value: string }>>
}

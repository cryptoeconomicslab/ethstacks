import {
  Segment,
  SignedTransactionWithProof,
  StateUpdate,
  SwapRequest,
  OwnershipPredicate,
  Address
} from '@layer2/core'
import { BigNumber } from 'ethers/utils'

export class DefragAlgorithm {

  /**
   * searchMergable search mergable stateUpdates
   * @param targetBlockNumber is target block number
   */
  static searchMergable(
    utxos: SignedTransactionWithProof[],
    targetBlockNumber: BigNumber,
    ownershipPredicate: string,
    myAddress: Address
  ): StateUpdate | null {
    let tx: StateUpdate | null = null
    let segmentEndMap = new Map<string, SignedTransactionWithProof>()
    utxos.forEach((_tx) => {
      const segment = _tx.getOutput().getSegment()
      const start = segment.start.toString()
      const end = segment.end.toString()
      const tx2 = segmentEndMap.get(start)
      if(tx2) {
        // _tx and segmentStartMap.get(start) are available for merge transaction
        tx = OwnershipPredicate.create(
          _tx.getOutput().getSegment().add(tx2.getOutput().getSegment()),
          targetBlockNumber,
          ownershipPredicate,
          myAddress
        )
      }
      segmentEndMap.set(end, _tx)
    })
    return tx
  }

  /**
   * make swap request to open channel
   * @param utxos
   */
  static makeSwapRequest(
    utxos: SignedTransactionWithProof[]
  ): SwapRequest | null {
    let swapRequest: SwapRequest | null = null
    utxos.forEach((txNeighbor) => {
      const neighbor = txNeighbor.getOutput().getSegment()
      const txs = DefragAlgorithm.searchHole(utxos, neighbor)
      if(txs.length > 0) {
        const output = txs[0].getOutput()
        swapRequest = new SwapRequest(
          output.getOwner(),
          output.getBlkNum(),
          output.getSegment(),
          txNeighbor.getOutput().getBlkNum(),
          neighbor)
      }
    })
    return swapRequest
  }
  
  /**
   * search UTXOs which have holes between them and neighbor
   * @param utxos 
   * @param neighbor 
   */
  private static searchHole(
    utxos: SignedTransactionWithProof[],
    neighbor: Segment
  ): SignedTransactionWithProof[] {
    return utxos.filter((_tx) => {
      const segment = _tx.getOutput().getSegment()
      return neighbor.end.lt(segment.start)
    })
  }

  static searchNeighbors(
    utxos: SignedTransactionWithProof[],
    swapRequest: SwapRequest
  ): StateUpdate[] {
    return utxos.filter((_tx) => {
      const segment = _tx.getOutput().getSegment()
      return swapRequest.check(segment)
    }).map(s => s.getOutput())
  }

}
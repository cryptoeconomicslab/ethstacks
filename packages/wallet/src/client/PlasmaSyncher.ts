import * as ethers from 'ethers'
import * as Logger from 'js-logger'
import { PlasmaClient } from './PlasmaClient'
import { WalletStorage } from '../storage/WalletStorage'
import { Address, Block, MapUtil } from '@layer2/core'
import { WaitingBlockWrapper } from '../models'
import artifact from '../assets/RootChain.json'
import {
  IEventWatcherStorage,
  EventWatcher,
  ETHEventAdaptor
} from '@layer2/events-watcher'
import { IStorage } from '../storage/IStorage'
import { EventEmitter } from 'events'
if (!artifact.abi) {
  console.error('ABI not found')
}

export class WalletEventWatcherStorage implements IEventWatcherStorage {
  public storage: IStorage
  private seen: { [key: string]: boolean } = {}

  constructor(storage: IStorage) {
    this.storage = storage
  }

  public async getLoaded(initialBlock: number) {
    try {
      const loaded = await this.storage.get('loaded')
      return parseInt(loaded)
    } catch (e) {
      return initialBlock
    }
  }

  public async setLoaded(loaded: number) {
    this.storage.set('loaded', loaded.toString())
  }

  public addSeen(event: string) {
    this.seen[event] = true
  }

  public getSeen(event: string) {
    return this.seen[event]
  }
}

export class PlasmaSyncher extends EventEmitter {
  private client: PlasmaClient
  private storage: WalletStorage
  private httpProvider: ethers.providers.JsonRpcProvider
  private listener: EventWatcher
  private rootChainInterface: ethers.utils.Interface
  private waitingBlocks: Map<string, string>

  constructor(
    client: PlasmaClient,
    provider: ethers.providers.JsonRpcProvider,
    contractAddress: Address,
    storage: WalletStorage,
    options: any
  ) {
    super()
    this.client = client
    this.httpProvider = provider
    this.storage = storage
    this.waitingBlocks = new Map<string, string>()
    this.rootChainInterface = new ethers.utils.Interface(artifact.abi)
    this.listener = new EventWatcher(
      new ETHEventAdaptor(
        contractAddress,
        this.httpProvider,
        this.rootChainInterface
      ),
      new WalletEventWatcherStorage(storage.getStorage()),
      options
    )
    this.listener.addEvent('BlockSubmitted', e => {
      Logger.debug('BlockSubmitted', e)
      this.addWaitingBlock(
        new WaitingBlockWrapper(e.values._blkNum, e.values._root)
      )
    })
  }

  public getListener() {
    return this.listener
  }

  /**
   *
   * @param handler
   *
   * ```typescript
   * await wallet.init((wallet) => {})
   * ```
   */
  public async init(handler: () => void) {
    this.waitingBlocks = await this.storage.loadMap<string>('waitingBlocks')
    await this.listener.initPolling(() => {
      handler()
    })
  }

  public cancel() {
    this.listener.cancel()
  }

  public async sync(handler: (block: Block) => Promise<void>): Promise<void> {
    const results = await this.loadBlocks()
    const tasks = results.map(block => {
      if (block.isOk()) {
        const tasks = handler(block.ok())
        // When success to get block, remove the block from waiting block list
        this.deleteWaitingBlock(block.ok().number)
        return tasks
      } else {
        console.warn(block.error())
        return Promise.resolve()
      }
    })
    // send confirmation signatures
    await Promise.all(tasks)
  }

  public getWaitingBlocks(): WaitingBlockWrapper[] {
    const arr: WaitingBlockWrapper[] = []
    this.waitingBlocks.forEach(value => {
      arr.push(WaitingBlockWrapper.deserialize(value))
    })
    return arr
  }

  /**
   * @ignore
   */
  private async loadBlocks() {
    const tasks = this.getWaitingBlocks().map(block => {
      return this.client.getBlock(block.blkNum.toNumber())
    })
    return Promise.all(tasks)
  }

  /**
   * @ignore
   */
  private addWaitingBlock(blockHeader: WaitingBlockWrapper) {
    this.waitingBlocks.set(
      blockHeader.blkNum.toString(),
      blockHeader.serialize()
    )
    this.storage.storeMap('waitingBlocks', this.waitingBlocks)
    this.emit('PlasmaBlockHeaderAdded', {
      blockHeader
    })
  }

  /**
   * @ignore
   */
  private deleteWaitingBlock(blkNum: number) {
    this.waitingBlocks.delete(blkNum.toString())
    this.storage.storeMap('waitingBlocks', this.waitingBlocks)
  }
}

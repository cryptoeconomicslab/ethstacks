import * as ethers from 'ethers'
import JsonRpcProvider = ethers.providers.JsonRpcProvider
import { IEventWatcherStorage } from './storage'

export type RootChainEventHandler = (e: any) => void
export type CompletedHandler = () => void
export type ErrorHandler = (err: Error) => void

export interface IETHEventAdaptor {
  parseLog(e: ethers.providers.Log): ethers.utils.LogDescription
  getLatestBlockNumber(): Promise<number>
  getLogs(
    fromBlockNumber: number,
    blockNumber: number,
    confirmation: number
  ): Promise<ethers.providers.Log[]>
}

export class ETHEventAdaptor implements IETHEventAdaptor {
  public address: string
  public provider: JsonRpcProvider
  public rootChainInterface: ethers.utils.Interface

  constructor(
    address: string,
    provider: JsonRpcProvider,
    rootChainInterface: ethers.utils.Interface
  ) {
    this.provider = provider
    this.rootChainInterface = rootChainInterface
    this.address = address
  }

  public parseLog(e: ethers.providers.Log): ethers.utils.LogDescription {
    return this.rootChainInterface.parseLog(e)
  }

  public async getLatestBlockNumber() {
    const block = await this.provider.getBlock('latest')
    return block.number
  }

  public async getLogs(
    fromBlockNumber: number,
    blockNumber: number,
    confirmation: number
  ) {
    const events = await this.provider.getLogs({
      address: this.address,
      fromBlock: fromBlockNumber - confirmation * 2,
      toBlock: blockNumber - confirmation
    })
    return events
  }
}

export interface EventWatcherOptions {
  initialBlock: number
  interval: number
  confirmation: number
}

export class EventWatcher {
  public adaptor: IETHEventAdaptor
  public storage: IEventWatcherStorage
  public checkingEvents: Map<string, RootChainEventHandler>
  public options: EventWatcherOptions
  public timer?: NodeJS.Timeout

  constructor(
    adaptor: IETHEventAdaptor,
    storage: IEventWatcherStorage,
    options: EventWatcherOptions
  ) {
    this.adaptor = adaptor
    this.storage = storage
    this.checkingEvents = new Map<string, RootChainEventHandler>()
    this.options = {
      initialBlock: 1,
      interval: 1000,
      confirmation: 0,
      ...options
    }
  }

  public addEvent(event: string, handler: RootChainEventHandler) {
    this.checkingEvents.set(event, handler)
  }

  public async initPolling(
    handler: CompletedHandler,
    errorHandler?: ErrorHandler
  ) {
    try {
      const blockNumber = await this.adaptor.getLatestBlockNumber()
      const loaded = await this.storage.getLoaded(this.options.initialBlock)
      await this.polling(loaded, blockNumber, handler)
    } catch (e) {
      console.log(e)
      if (errorHandler) {
        errorHandler(e)
      }
    }
    this.timer = setTimeout(async () => {
      await this.initPolling(handler, errorHandler)
    }, this.options.interval)
  }

  public cancel() {
    if (this.timer) {
      clearTimeout(this.timer)
    }
  }

  public async polling(
    fromBlockNumber: number,
    blockNumber: number,
    completedHandler: CompletedHandler
  ) {
    const events = await this.adaptor.getLogs(
      fromBlockNumber,
      blockNumber,
      this.options.confirmation
    )
    const filtered = events
      .filter(e => {
        if (e.transactionHash) {
          return !this.storage.getSeen(e.transactionHash)
        } else {
          return false
        }
      })
      .map(e => {
        const logDesc = this.adaptor.parseLog(e)
        const handler = this.checkingEvents.get(logDesc.name)
        if (handler) {
          handler(logDesc)
        }
        if (e.transactionHash) {
          this.storage.addSeen(e.transactionHash)
        }
        return true
      })
    await this.storage.setLoaded(blockNumber)
    if (filtered.length > 0) {
      completedHandler()
    }
  }
}

export interface IEventWatcherStorage {
  getLoaded(initialBlock: number): Promise<number>

  setLoaded(loaded: number): Promise<void>

  addSeen(event: string): void

  getSeen(event: string): boolean
}

export class DefaultEventWatcherStorage implements IEventWatcherStorage {
  private loaded: number = 0
  private seen: { [key: string]: boolean } = {}

  constructor() {}

  public async getLoaded(initialBlock: number) {
    return this.loaded
  }

  public async setLoaded(loaded: number) {
    this.loaded = loaded
  }

  public addSeen(event: string) {
    this.seen[event] = true
  }

  public getSeen(event: string) {
    return this.seen[event]
  }
}

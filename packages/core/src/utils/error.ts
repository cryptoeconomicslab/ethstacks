import { create } from 'handlebars'

export class ChamberError implements Error {
  public name = 'ChamberError'

  constructor(public code: number, public message: string) {}

  public toString() {
    return this.name + ': ' + this.message
  }

  public serialize() {
    return {
      error: {
        code: this.code,
        message: this.message
      }
    }
  }
}

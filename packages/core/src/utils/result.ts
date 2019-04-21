import { ChamberError } from './error'

export interface ChamberResult<T> {
  isOk(): boolean
  isError(): boolean
  ok(): T
  error(): ChamberError
}

export class ChamberOk<T> implements ChamberResult<T> {
  private value: T

  constructor(v: T) {
    this.value = v
  }

  public isOk(): boolean {
    return true
  }

  public isError(): boolean {
    return false
  }

  public ok(): T {
    return this.value
  }

  public error(): ChamberError {
    throw new Error('ok.error')
  }
}

export class ChamberResultError<T> implements ChamberResult<T> {
  public static getError<T>(code: number, message: string) {
    return new ChamberResultError<T>(new ChamberError(code, message))
  }
  private err: ChamberError

  constructor(error: ChamberError) {
    this.err = error
  }

  public isOk(): boolean {
    return false
  }

  public isError(): boolean {
    return true
  }

  public ok(): T {
    throw new Error('error.ok')
  }

  public error(): ChamberError {
    return this.err
  }
}

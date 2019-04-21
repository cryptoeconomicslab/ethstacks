import fetch from 'node-fetch'

export interface INetworkClient {
  request(methodName: string, args: any): Promise<any>
}

export class JsonRpcClient implements INetworkClient {
  public endpoint: string
  public id: number

  constructor(endpoint: string) {
    this.endpoint = endpoint
    this.id = 0
  }

  public request(methodName: string, args: any) {
    this.id++
    return fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: this.id,
        method: methodName,
        params: args
      })
    }).then(response => {
      return response.json()
    })
  }
}

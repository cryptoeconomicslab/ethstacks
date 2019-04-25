import { ChamberWallet, PlasmaClient, BrowserStorage } from '../'
// import * as fs from 'fs'
import { JsonRpcClient } from '../client/JsonRpcClient'
import { WalletMQTTClient as MQTTClient } from '../client/PubsubClient'


// TODO: add mnemonic
interface CreateWalletArgs {
  privateKey: string
}

/**
 * Plasma wallet store UTXO and proof
 */
export default class WalletFactory {
  private childchainEndpoint:string
  private childchainPubsubEndpoint:string
  private initialBlock:number
  private confirmation:number
  private ownershipPredicate:string
  private rootchainEndpoint:string
  private rootchainAddress:string
  private storage: BrowserStorage
/*
  CHILDCHAIN_ENDPOINT, CHILDCHAIN_PUBSUB_ENDPOINT, INITIAL_BLOCK, CONFIRMATION
  OWNERSHIP_PREDICATE, ROOTCHAIN_ENDPOINT, ROOTCHAIN_ADDRESS
  */
  constructor(
    childchainEndpoint:string | undefined, childchainPubsubEndpoint:string | undefined,
    initialBlock:number | undefined, confirmation:number | undefined,
    ownershipPredicate:string,
    rootchainEndpoint:string, rootchainAddress:string
  ){
    this.childchainEndpoint = childchainEndpoint || 'http://localhost:3000'
    this.childchainPubsubEndpoint = childchainPubsubEndpoint || this.childchainEndpoint
    this.initialBlock = initialBlock || 1,
    this.confirmation = confirmation || 0
    this.ownershipPredicate = ownershipPredicate
    this.rootchainEndpoint = rootchainEndpoint
    this.rootchainAddress = rootchainAddress
    this.storage = new BrowserStorage()
  }

  public createWallet({ privateKey }: CreateWalletArgs): ChamberWallet {
    const jsonRpcClient = new JsonRpcClient(this.childchainEndpoint)
    const mqttClient = new MQTTClient(this.childchainPubsubEndpoint)
    const client = new PlasmaClient(jsonRpcClient, mqttClient)
    const options = {
      initialBlock: this.initialBlock,
      interval: 20000,
      confirmation: this.confirmation,
      OwnershipPredicate: this.ownershipPredicate
    }    
    try {
      const wallet = ChamberWallet.createWalletWithPrivateKey(
        client,
        this.rootchainEndpoint,
        this.rootchainAddress,
        this.storage,
        privateKey,
        options
      )
      ;if(typeof window !== 'undefined') { (window as any).wallet = wallet }
      this.storage.set('privateKey', privateKey)
      return wallet
    } catch (e) {
      throw e
    }
  }

  public async loadWallet(): Promise<ChamberWallet | null> {
    let privateKey: string | null
    try {
      privateKey = await this.storage.get('privateKey')
    } catch (e) {
      privateKey = null
    }

    if (privateKey) {
      const wallet = this.createWallet({ privateKey })
      return wallet
    }

    return null
  }
}
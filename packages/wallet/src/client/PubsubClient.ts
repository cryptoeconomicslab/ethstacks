import * as mqtt from 'mqtt'
import { MqttClient } from 'mqtt'
import { EventEmitter } from 'events'

export interface IPubsubClient {
  publish(topic: string, message: string): boolean
  subscribe(topic: string, event: (e: string) => void): void
  unsubscribe(topic: string, handler: SubscribeHandler): void
}

export type SubscribeHandler = (message: string) => void

export class WalletMQTTClient implements IPubsubClient {
  public client: MqttClient
  public eventEmitter: EventEmitter

  constructor(endpoint: string) {
    this.client = mqtt.connect(endpoint)
    this.eventEmitter = new EventEmitter()
    this.client.on('message', (topic, message) => {
      this.eventEmitter.emit(topic, message.toString())
    })
  }

  public publish(topic: string, message: string): boolean {
    this.client.publish(topic, message)
    return true
  }

  public subscribe(topic: string, handler: SubscribeHandler): void {
    this.client.subscribe(topic)
    this.eventEmitter.on(topic, handler)
  }

  public unsubscribe(topic: string, handler: SubscribeHandler): void {
    this.client.unsubscribe(topic)
    this.eventEmitter.off(topic, handler)
  }
}

const EventEmitter = require('events');

class Web3EventListener extends EventEmitter {

  constructor(web3, contract, storage, options) {
    super();
    this.web3 = web3;
    this.contract = contract;
    this.storage = storage;
    this.seenEvents = storage.load('seenEvents') || {};
    this.options = options || {};
    this.confirmation = this.options.confirmation || 2;
    this.interval = this.options.interval || 50000;
  }

  async getEvents(event, handler) {
    const block = await this.web3.eth.getBlock('latest');
    const events = await this.contract.getPastEvents(event, {
      fromBlock: block.number - (this.confirmation * 2 + 1),
      toBlock: block.number + 1 - this.confirmation
    });
    events.filter(e => {
      return !this.seenEvents[e.transactionHash];
    }).forEach((e) => {
      if(handler) handler(e);
      this.emit(e);
      this.seenEvents[e.transactionHash] = true;
      this.storage.store('seenEvents', this.seenEvents);
    });
    this.currentTimer = setTimeout(()=>{
      this.getEvents(event, handler);
    }, this.interval);
  }

  cancel() {
    cancelTimeout(this.currentTimer)
  }

}

module.exports = Web3EventListener;

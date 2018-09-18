const EventEmitter = require('events').EventEmitter;

class ChainEvent extends EventEmitter {
    constructor() {
        super();
    }

    Ready(cb){
        this.on("Ready", cb)
    }
    TxAdded(cb){
        this.on("TxAdded", cb)
    }
    BlockGenerated(cb){
        this.on("BlockGenerated", cb)
    }
    
}

module.exports = ChainEvent;
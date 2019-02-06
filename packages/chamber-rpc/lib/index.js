const jayson = require('jayson');
const cors = require('cors');
var connect = require('connect');
const jsonParser = require('body-parser').json;
const MQTTServer = require('./mqtt');
const app = connect();
const {
  SignedTransaction
} = require('@layer2/core')

module.exports.run = childChain => {
  // create a server
  var server = jayson.server({
    sendTransaction: (args, cb) => {
      const signedTx = SignedTransaction.deserialize(args[0])
      const txHash = childChain.appendTx(signedTx);
      cb(null, txHash);
    },
    getBlockNumber: (args, cb) => {
      // Get latest block for descending manner
      // https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_blocknumber
      cb(null, childChain.blockHeight)
    },
    getBlock: (args, cb) => {
      childChain.getBlock(args[0]).then((block) => {
        cb(null, block.serialize());
      }).catch((e) => {
        console.log(e.message)
        if(e.message == 'NotFoundError') {
          cb(null, null)
        }else{
          console.error(e)
          cb(e)
        }
      })
    }
  });
  app.use(cors({methods: ['POST']}));
  app.use(jsonParser());
  app.use(server.middleware());
  
  app.listen(process.env.PORT || 3000);

  MQTTServer();
}

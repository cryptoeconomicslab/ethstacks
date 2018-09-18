const jayson = require('jayson');
const { apiTx } = require("../../childchain/lib/api");

module.exports.run = childChain => {
  // create a server
  var server = jayson.server({
    // These RPC Method must align with ETH
    eth_sendRawTransaction: (args, cb) => {
      console.log(args)
      apiTx(args[0]).then((result) => {
        cb(null, result);
      }).catch((err) => {
        cb(err);
      })
    },
    eth_blockNumber: (args, cb) => {
      // Get latest block for descending manner
      // https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_blocknumber
      cb(childChain.blockHeight)
    },
    eth_getBlockTransactionCountByNumber: (args, cb) => {
      // Get block info for them
      // https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_getblocktransactioncountbynumber
    },
    eth_getBalance: (args, cb) => {

    },
    eth_getFilterLogs: (args, cb) => {

    },
  });
  server.http().listen(process.env.PORT || 3000);
}

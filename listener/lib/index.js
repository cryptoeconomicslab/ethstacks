require("dotenv").config();
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider(process.env.ROOTCHAIN_ENDPOINT));
const RootChainAbi = require('../assets/RootChain.json').abi;

// const rootChain = new web3.eth.Contract(RootChainAbi, process.env.ROOTCHAIN_ADDRESS);

module.exports.run = childChain => {
  // rootChain.events.Deposit((e) => {
  //   console.log(e);
  // })

  childChain.events.Ready((e) => {
  })

  childChain.events.TxAdded(async (e) => {
    await childChain.saveCommitmentTxs(); //async func

    if (e.type == "deposit") {
      await childChain.generateBlock();
    } else if (e.type == "basic") {

      // TODO: Must make it blocksize
      if (childChain.commitmentTxs.length > 100) {
        await childChain.generateBlock();
      }
    }
  })
  childChain.events.BlockGenerated((e) => {
    let newBlock = e.payload;
    /**
     * @param address _chain The index of child chain
     * @param bytes32 _root The merkle root of a child chain transactions.
     */
    // rootchain.methods.submitBlock(childChain.id, newBlock.txs_root);
  })
  // rootChain.events.BlockSubmitted((e) => {
  //   console.log(e);
  // })

}


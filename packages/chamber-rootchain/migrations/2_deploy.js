const AggregateChain = artifacts.require("./AggregateChain.sol");
const RootChain = artifacts.require("./RootChain.sol");
const MultisigGame = artifacts.require("./MultisigGame.sol");

module.exports = function(deployer) {
  deployer.deploy(RootChain).then(() => {
    return deployer.deploy(AggregateChain);
  }).then((aggregateChain) => {
    return aggregateChain.addChain(RootChain.address)
  }).then(() => {
    return deployer.deploy(MultisigGame);
  }).then(() => {
    console.log('finish');
  });
};

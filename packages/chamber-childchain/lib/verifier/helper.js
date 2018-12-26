const utils = require('ethereumjs-util');

/**
 * @name checkSigs
 * @description check signatures
 * @param {Array[String]} owners owners are list of hex string of address 
 * @param {Buffer} sigs ethereum signatures
 * @param {Buffer} hash keccak256 hash
 */
function checkSigs(owners, sigs, hash) {
  if(sigs.length != owners.length) {
    throw new Error('signatures not enough');
  }
  const unmatchSigs = sigs.filter((sig, i) => {
    var pubKey = utils.ecrecover(
      new Buffer(hash, 'hex'),
      sig.slice(64, 65).readUInt8(0),
      sig.slice(0, 32),
      sig.slice(32, 64)
    );
    return utils.bufferToHex(utils.pubToAddress(pubKey)) === owners[i];
  });
  if(unmatchSigs != 0) {
    throw new Error('signatures not match');
  }
}


module.exports = {
  checkSigs
}
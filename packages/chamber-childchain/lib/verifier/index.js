const std = require('./std');
const MultisigGame = require('./MultisigGame');

/*
  const verifiers = {
    "0x....": MultisigGame
  }
*/

class Verifier {

  static verify(tx) {
    try{
      if(tx.verifier == '0x00') {
        if(tx.label === 0) {
          // transfer
          const outputs = std.transfer(tx.inputs, tx.args, tx.getSigns(), tx.hash());
          return Verifier.eq(tx.outputs, outputs);
        }else if(tx.label === 1) {
          // transfer
          const outputs = std.split(tx.inputs, tx.args, tx.getSigns(), tx.hash());
          return Verifier.eq(tx.outputs, outputs);
        }
      }else{
        // check tx.verifier
        // verifiers[tx.verifier].verify(tx)
        const outputs = MultisigGame.verify(tx);
        return Verifier.eq(tx.outputs, outputs);
      }
      return false;
    }catch(e) {
      console.error(e);
      return false;
    }
  }

  static eq(outputs, b) {
    return outputs.filter((o, i) => {
      return Buffer.compare(o.hash(), b[i].hash()) !== 0;
    }).length == 0;
  }
  
}

module.exports = Verifier;

const BigNumber = require('bignumber.js');
const utils = require('ethereumjs-util');

/**
 * @description This code is written to show how RSAaccumulator runs.
 * Some parts are simplified very much.
 */

/**
 * @description calculate (value**y) % z for int y, BigNumber z.
 * @param {*} y 
 * @param {*} z 
 */
function powInMod(a, y, z) {
  let x = BigNumber(1);
  while(y.comparedTo(0) == 1) {
    if(y.mod(2).toNumber() === 1) {
      x = (x.times(a)).mod(z);
      y = y.minus(1);
    }
    y = y.div(2);
    a = a.times(a).mod(z);
  }
  return x;
}

// should be big. And the prime factors of N should be unknown to anyone.
const N = new BigNumber(131071);

class RSAaccumulator {
  
  static updateAccumulator(accumulator, value) {
    return powInMod(accumulator, value, N);
  }
  
  static hash(value) {
    const hash = '0x' + utils.sha256(value.toString()).toString('hex')
    return new BigNumber(hash);
  }
  
  static getProof(setValues, value, generator, accumulator){
    // calcute (q,r,x). it satisfies q**B * g**(vr)* g**x == A
    let h = powInMod(generator, value, N);
    let B = RSAaccumulator.hash(h.plus(accumulator));
    let q = BigNumber(1);
    let r = BigNumber(0);
    let x = BigNumber(1);
    for(let i = 0; i < setValues.length; i++){
      let x2 = (x.times(setValues[i])).mod(value);
      let temp = ((x.times(setValues[i])).div(value))
                  .plus(r.times(setValues[i]))
                  .integerValue(BigNumber.ROUND_FLOOR);
      let r2 = temp.mod(B);
      let q2 = powInMod(BigNumber(1), setValues[i], N)
                .times(powInMod(h, (temp.div(B)).integerValue(BigNumber.ROUND_FLOOR), N))
                .mod(N);
      x = x2;
      r = r2;
      q = q2;
    }
    console.log('get proof', q, r, x);
    return new RSAaccumulatorProof(value, q, r, x);
  }

  static checkNonInclusionProof(generator, accumulator, proof) {
    let h = powInMod(generator, proof.value, N);
    let B = RSAaccumulator.hash(h.plus(accumulator));
    if(proof.x.comparedTo(0) <= 0 || proof.value.comparedTo(proof.x) <= 0){
      return false;
    }
    if(proof.r.comparedTo(0) <= 0 || B.comparedTo(proof.r) <= 0){
      return false;
    }
    if(powInMod(proof.q, B, N).times(powInMod(generator, proof.r.times(proof.value).plus(proof.x), N)).mod(N).eq(accumulator)) {
      return true;
    }else{
      return false;
    }
  }

  static checkInclusionProof(generator, accumulator, proof){
    let h = powInMod(generator, proof.value, N);
    let B = RSAaccumulator.hash(h.plus(accumulator));
    if(!proof.x.eq(0)){
      return false;
    }
    if(proof.r.comparedTo(0) <= 0 || B.comparedTo(proof.r) <= 0){
      return false;
    }
    if(powInMod(proof.q, B, N).times(powInMod(generator, proof.r.times(proof.value).plus(proof.x), N)).mod(N).eq(accumulator)){
        return true;
    }else{
        return false;
    }
  }
}

class RSAaccumulatorProof{
  constructor(value,q,r,x){
    this.value=value;
    this.q=q;
    this.r=r;
    this.x=x;
  }
}


module.exports = {
  RSAaccumulator
}

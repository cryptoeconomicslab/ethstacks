const assert = require('assert');
const {
  RSAaccumulator
} = require('../src/RSAaccumulator')
const primeNumberList = require('prime-number/list')
const BigNumber = require('bignumber.js');

describe('RSAaccumulator', function() {

  const coins=[
    BigNumber(primeNumberList[2]),
    BigNumber(primeNumberList[5]),
    BigNumber(primeNumberList[7]),
    BigNumber(primeNumberList[8]),
    BigNumber(primeNumberList[10]),
    BigNumber(primeNumberList[11]),
    BigNumber(primeNumberList[15]),
    BigNumber(primeNumberList[17])
  ];
  
  const generator = new BigNumber(3);

  beforeEach(function() {
    accumulator = generator;
    for(i=0; i < coins.length; i++) {
      accumulator = RSAaccumulator.updateAccumulator(accumulator, coins[i]);
    }
  });

  describe('checkInclusionProof', function() {

    it('true', function() {
      const proof = RSAaccumulator.getProof(
        coins,
        coins[0],
        generator,
        accumulator);
      assert.equal(
        RSAaccumulator.checkInclusionProof(generator, accumulator, proof),
        true);
    });

    it('false', function() {
      const proof = RSAaccumulator.getProof(
        coins,
        BigNumber(primeNumberList[6]),
        generator,
        accumulator);
      assert.equal(
        RSAaccumulator.checkInclusionProof(generator, accumulator, proof),
        false);
    });

  });

  describe('checkNonInclusionProof', function() {

    it('true', function() {
      const proof = RSAaccumulator.getProof(
        coins,
        BigNumber(primeNumberList[6]),
        generator,
        accumulator);
      assert.equal(
        RSAaccumulator.checkNonInclusionProof(generator, accumulator, proof),
        true);
    });

    it('false', function() {
      const proof = RSAaccumulator.getProof(
        coins,
        coins[0],
        generator,
        accumulator);
      assert.equal(
        RSAaccumulator.checkNonInclusionProof(generator, accumulator, proof),
        false);
    });

  });

});

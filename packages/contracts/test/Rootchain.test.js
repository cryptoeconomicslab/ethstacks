// const { injectInTruffle } = require('sol-trace');
// injectInTruffle(web3, artifacts);
const {
  duration,
  increaseTime,
} = require('./helpers/increaseTime')
const {
  assertRevert
} = require('./helpers/assertRevert')

const RootChain = artifacts.require("RootChain")
const Checkpoint = artifacts.require("Checkpoint")
const CustomVerifier = artifacts.require("CustomVerifier")
const VerifierUtil = artifacts.require("VerifierUtil")
const OwnershipPredicateContract = artifacts.require("OwnershipPredicate")
const PaymentChannelPredicate = artifacts.require("SwapChannelPredicate")
const Serializer = artifacts.require("Serializer")
const ERC721 = artifacts.require("ERC721")
const TestPlasmaToken = artifacts.require("TestPlasmaToken")
const ethers = require('ethers')
const BigNumber = ethers.utils.BigNumber

const {
  Block,
  constants,
  Segment,
  SignedTransaction,
  OwnershipPredicate
} = require('@layer2/core')

const {
  Scenario1,
  Scenario2,
  Scenario3,
  Scenario4,
  testKeys,
  testAddresses
} = require('./testdata')

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

const BOND = constants.EXIT_BOND

contract("RootChain", ([alice, bob, operator, user4, user5, admin]) => {

  beforeEach(async () => {
    this.erc721 = await ERC721.new()
    this.checkpoint = await Checkpoint.new({ from: operator })
    this.verifierUtil = await VerifierUtil.new({ from: operator })
    this.ownershipPredicate = await OwnershipPredicateContract.new(
      this.verifierUtil.address, { from: operator })
    this.serializer = await Serializer.new({ from: operator })
    this.customVerifier = await CustomVerifier.new(
      this.verifierUtil.address,
      this.ownershipPredicate.address,
      {
        from: operator
      })
    this.rootChain = await RootChain.new(
      this.verifierUtil.address,
      this.serializer.address,
      this.customVerifier.address,
      this.erc721.address,
      this.checkpoint.address,
      {
        from: operator
      })
    await this.customVerifier.registerPredicate(this.ownershipPredicate.address, {from: operator})
    await this.rootChain.setup()
    this.paymentChannelPredicate = await PaymentChannelPredicate.new(
      this.verifierUtil.address,
      this.rootChain.address,
      { from: operator })
    await this.customVerifier.registerPredicate(this.paymentChannelPredicate.address, {from: operator})
    const exitNFTAddress = await this.rootChain.getTokenAddress.call()
    const exitNFT = await ERC721.at(exitNFTAddress)
    const minter = await exitNFT.getMinter.call()
    assert.equal(minter, this.rootChain.address)
  });

  describe("deposit", () => {

    it("should fail to deposit 0", async () => {
      // 0.0.1 gwei is 0 in plasma
      // because msg.value / 1000000000 is 0
      await assertRevert(this.rootChain.deposit(
        {
          from: alice,
          value: '10000000'
        }))
    })

  });

  describe("submit", () => {

    it("should submit", async () => {
      const gasCost = await this.rootChain.submit.estimateGas(
        Scenario1.blocks[0].block.getRoot(),
        {
          from: operator
        });
      console.log('submit gasCost: ', gasCost)
      const result = await this.rootChain.submit(
        Scenario1.blocks[0].block.getRoot(),
        {
          from: operator
        });
      assert.equal(result.logs[0].event, 'BlockSubmitted')
    })
  });


  describe("finalizeExit", () => {

    const exitableEnd = ethers.utils.bigNumberify('1000000')
    const segment = Segment.ETH(
      ethers.utils.bigNumberify('0'),
      ethers.utils.bigNumberify('1000000'))
    const blkNum = ethers.utils.bigNumberify(3)

    beforeEach(async () => {
      await this.rootChain.deposit(
        {
          from: alice,
          value: '1000000000000000'
        })
    })

    it("should succeed finalizeExit", async () => {
      const stateUpdate = OwnershipPredicate.create(
        segment,
        blkNum,
        this.ownershipPredicate.address,
        alice)
      const result = await this.rootChain.exit(
        3 * 100,
        segment.toBigNumber(),
        stateUpdate.encode(),
        '0x00',
        {
          from: alice,
          value: BOND
        });
      const exitId = result.receipt.logs[0].args._exitId
      await increaseTime(duration.weeks(6));
      await this.rootChain.finalizeExit(
        exitableEnd,
        exitId,
        stateUpdate.encode(),
        {
          from: alice
        })
    })
  })

  describe("exit", () => {

    const exitableEnd = ethers.utils.bigNumberify('3000000')

    beforeEach(async () => {
      const result = await this.rootChain.deposit(
        {
          from: alice,
          value: '1000000000000000'
        });
      await this.rootChain.deposit(
        {
          from: bob,
          value: '1000000000000000'
        });
      const submit = async (block) => {
        const result = await this.rootChain.submit(
          block.getRoot(),
          {
            from: operator
          });
        block.setBlockTimestamp(ethers.utils.bigNumberify(result.logs[0].args._timestamp.toString()))
        block.setSuperRoot(result.logs[0].args._superRoot)
      }
      await submit(Scenario1.blocks[0].block)
      await submit(Scenario1.blocks[1].block)
      await submit(Scenario1.blocks[2].block)
      await submit(Scenario1.blocks[3].block)
      await submit(Scenario1.blocks[4].block)
      await this.rootChain.deposit(
        {
          from: bob,
          value: '1000000000000000'
        })      
    })

    it("should succeed to exit and finalizeExit", async () => {
      const tx = Scenario1.blocks[0].block.getSignedTransactionWithProof(
        Scenario1.blocks[0].transactions[0].hash())[0]
      const gasCost = await this.rootChain.exit.estimateGas(
        6 * 100,
        tx.getSegment().toBigNumber(),
        tx.getTxBytes(),
        tx.getProofAsHex(),
        {
          from: bob,
          value: BOND
        });
        // gas cost of exit is 282823
      console.log('exit gasCost: ', gasCost)

      const result = await this.rootChain.exit(
        6 * 100,
        tx.getSegment().toBigNumber(),
        tx.getTxBytes(),
        tx.getProofAsHex(),
        {
          from: bob,
          value: BOND
        });
      const exitId = result.receipt.logs[0].args._exitId
      assert.equal(result.logs[0].event, 'ExitStarted')
      // 6 weeks after
      await increaseTime(duration.weeks(6));
      const finalizeExitGasCost = await this.rootChain.finalizeExit.estimateGas(
        exitableEnd,
        exitId,
        tx.getStateBytes(),
        {
          from: bob
        });
      console.log('finalizeExit gas cost: ', finalizeExitGasCost)
      await this.rootChain.finalizeExit(
        exitableEnd,
        exitId,
        tx.getStateBytes(),
        {
          from: bob
        });
    })

    it("should succeed to exit feeTransaction", async () => {
      const tx = Scenario1.blocks[4].block.getSignedTransactionWithProof(
        Scenario1.blocks[4].transactions[2].hash())[1]
      const result = await this.rootChain.exit(
        14 * 100,
        tx.getSegment().toBigNumber(),
        tx.getTxBytes(),
        tx.getProofAsHex(),
        {
          from: operator,
          value: BOND
        });
      assert.equal(result.logs[0].event, 'ExitStarted')
    })

    it("should succeed to exit depositTx and nevert challenged before tx", async () => {
      const depositTx = Scenario1.deposits[2]
      const result1 = await this.rootChain.exit(
        15 * 100,
        Scenario1.segments[5].toBigNumber(),
        depositTx.encode(),
        '0x00',
        {
          from: bob,
          value: BOND
        });
      const tx2 = Scenario1.blocks[4].block.getSignedTransactionWithProof(
        Scenario1.blocks[4].transactions[0].hash())[0]
      const result2 = await this.rootChain.exit(
        14 * 100,
        Scenario1.segments[3].toBigNumber(),
        tx2.getTxBytes(),
        tx2.getProofAsHex(),
        {
          from: operator,
          value: BOND
        });

      const exitId1 = result1.receipt.logs[0].args._exitId
      const exitId2 = result2.receipt.logs[0].args._exitId
      await assertRevert(this.rootChain.requestHigherPriorityExit(
        exitId2,
        exitId1,
        {
          from: operator
        }))
    })

    it("should success to challenge", async () => {
      const tx = Scenario1.blocks[0].block.getSignedTransactionWithProof(
        Scenario1.blocks[0].transactions[0].hash())[0]
      const result = await this.rootChain.exit(
        6 * 100,
        Scenario1.segments[0].toBigNumber(),
        tx.getTxBytes(),
        tx.getProofAsHex(),
        {
          from: bob,
          value: BOND
        });
      const exitId = result.receipt.logs[0].args._exitId
      const challengeTx = Scenario1.blocks[1].block.getSignedTransactionWithProof(
        Scenario1.blocks[1].transactions[0].hash())[0]
      await this.rootChain.challenge(
        exitId,
        exitId,
        tx.getStateBytes(),
        8 * 100 + 0,
        Scenario1.segments[0].toBigNumber(),
        challengeTx.getTxBytes(),
        challengeTx.getProofAsHex(),
        challengeTx.getSignatures(),
        {
          from: alice
        });
    })

    it("should succeed to challengeBefore", async () => {
      const tx = Scenario1.blocks[2].block.getSignedTransactionWithProof(
        Scenario1.blocks[2].transactions[0].hash())[0]
      const result = await this.rootChain.exit(
        10 * 100,
        Scenario1.segments[0].toBigNumber(),
        tx.getTxBytes(),
        tx.getProofAsHex(),
        {
          from: operator,
          value: BOND
        });
      const challengeTx = Scenario1.blocks[1].block.getSignedTransactionWithProof(
        Scenario1.blocks[1].transactions[0].hash())[0]
      const exitId = result.receipt.logs[0].args._exitId
      const result2 = await this.rootChain.exit(
        8 * 100,
        Scenario1.segments[0].toBigNumber(),
        challengeTx.getTxBytes(),
        challengeTx.getProofAsHex(),
        {
          from: alice,
          value: BOND
        });
      const exitId2 = result2.receipt.logs[0].args._exitId
      await this.rootChain.requestHigherPriorityExit(
        exitId2,
        exitId,
        {
          from: alice
        });
      // 6 weeks after
      const exitResult = await this.rootChain.getExit(exitId)
      // challengeCount is 1
      assert.equal(exitResult[2].toNumber(), 1)
      await increaseTime(duration.weeks(6))
      await assertRevert(this.rootChain.finalizeExit(
        exitableEnd,
        exitId,
        tx.getStateBytes(),
        {
          from: operator
        }))
    })

    it("should succeed to respondChallenge", async () => {
      const tx = Scenario1.blocks[2].block.getSignedTransactionWithProof(
        Scenario1.blocks[2].transactions[0].hash())[0]
      const result1 = await this.rootChain.exit(
        10 * 100,
        Scenario1.segments[0].toBigNumber(),
        tx.getTxBytes(),
        tx.getProofAsHex(),
        {
          from: operator,
          value: BOND
        });
      const challengeTx = Scenario1.blocks[0].block.getSignedTransactionWithProof(
        Scenario1.blocks[0].transactions[0].hash())[0]
      const result2 = await this.rootChain.exit(
        6 * 100,
        Scenario1.segments[0].toBigNumber(),
        challengeTx.getTxBytes(),
        challengeTx.getProofAsHex(),
        {
          from: bob,
          value: BOND
        });
      const exitId1 = result1.receipt.logs[0].args._exitId
      const exitId2 = result2.receipt.logs[0].args._exitId
      await this.rootChain.requestHigherPriorityExit(
        exitId2,
        exitId1,
        {
          from: alice
        });
      const respondTx = Scenario1.blocks[1].block.getSignedTransactionWithProof(
        Scenario1.blocks[1].transactions[0].hash())[0]
      await this.rootChain.challenge(
        exitId2,
        exitId2,
        challengeTx.getStateBytes(),
        8 * 100 + 0,
        Scenario1.segments[0].toBigNumber(),
        respondTx.getTxBytes(),
        respondTx.getProofAsHex(),
        respondTx.getSignatures(),
        {
          from: operator
        })
      const exitResult = await this.rootChain.getExit(exitId1)
      // challengeCount is 0
      assert.equal(exitResult[2].toNumber(), 0)
    })

    it("should succeed to challengeBefore by deposit transaction", async () => {
      const tx = Scenario1.blocks[0].block.getSignedTransactionWithProof(
        Scenario1.blocks[0].transactions[0].hash())[0]
      const result1 = await this.rootChain.exit(
        6 * 100,
        Scenario1.segments[0].toBigNumber(),
        tx.getTxBytes(),
        tx.getProofAsHex(),
        {
          from: bob,
          value: BOND
        });

      const depositTx = Scenario1.deposits[0]
      const result2 = await this.rootChain.exit(
        3 * 100,
        Scenario1.segments[0].toBigNumber(),
        depositTx.encode(),
        '0x00000050',
        {
          from: alice,
          gas: '1000000',
          value: BOND
        });
      const exitId1 = result1.receipt.logs[0].args._exitId
      const exitId2 = result2.receipt.logs[0].args._exitId
      await this.rootChain.requestHigherPriorityExit(
        exitId2,
        exitId1,
        {
          from: alice
        });
      const respondTx = Scenario1.blocks[0].block.getSignedTransactionWithProof(
        Scenario1.blocks[0].transactions[0].hash())[0]
      await this.rootChain.challenge(
        exitId2,
        exitId2,
        depositTx.encode(),
        6 * 100 + 0,
        Scenario1.segments[0].toBigNumber(),
        respondTx.getTxBytes(),
        respondTx.getProofAsHex(),
        respondTx.getSignatures(),
        {
          from: operator,
          gas: '500000'
        })
      const exitResult = await this.rootChain.getExit(exitId1)
      // challengeCount is 0
      assert.equal(exitResult[2].toNumber(), 0)
    })

    it("should fail to finalizeExit", async () => {
      const tx = Scenario1.blocks[0].block.getSignedTransactionWithProof(
        Scenario1.blocks[0].transactions[0].hash())[0]
      const result1 = await this.rootChain.exit(
        6 * 100,
        Scenario1.segments[0].toBigNumber(),
        tx.getTxBytes(),
        tx.getProofAsHex(),
        {
          from: bob,
          value: BOND
        });
      const exitId1 = result1.receipt.logs[0].args._exitId
      // 6 weeks after
      await increaseTime(duration.weeks(6));
      await this.rootChain.finalizeExit(
        exitableEnd,
        exitId1,
        tx.getStateBytes(),
        {
          from: bob
        });
      const invalidTx = Scenario1.blocks[3].block.getSignedTransactionWithProof(
        Scenario1.blocks[3].transactions[0].hash())[0]
      const exitId2 = 2
      await this.rootChain.exit(
        12 * 100,
        Scenario1.segments[2].toBigNumber(),
        invalidTx.getTxBytes(),
        invalidTx.getProofAsHex(),
        {
          from: operator,
          value: BOND
        });
      // 6 weeks after
      await increaseTime(duration.weeks(6));
      await assertRevert(this.rootChain.finalizeExit(
        exitableEnd,
        exitId2,
        invalidTx.getStateBytes(),
        {
          from: bob
        }))
    })

  });

  describe("SwapTransaction", () => {

    const exitableEnd = ethers.utils.bigNumberify('2000000')
    // deposits
    const blkNum1 = ethers.utils.bigNumberify('3')
    const blkNum2 = ethers.utils.bigNumberify('5')
    const blkNum3 = ethers.utils.bigNumberify('6')
    const segment1 = Segment.ETH(
      ethers.utils.bigNumberify('0'),
      ethers.utils.bigNumberify('1000000'))
    const segment2 = Segment.ETH(
      ethers.utils.bigNumberify('1000000'),
      ethers.utils.bigNumberify('2000000'))
    const block3 = new Block()
    const swapTx = new SignedTransaction([
      OwnershipPredicate.create(segment1, blkNum3, ethers.constants.AddressZero, testAddresses.OperatorAddress),
      OwnershipPredicate.create(segment2, blkNum3, ethers.constants.AddressZero, testAddresses.AliceAddress)])
    swapTx.sign(testKeys.AlicePrivateKey)
    swapTx.sign(testKeys.OperatorPrivateKey)
    block3.setBlockNumber(6)
    block3.appendTx(swapTx)

    beforeEach(async () => {
      await this.rootChain.deposit(
        {
          from: alice,
          value: '1000000000000000'
        });
      await this.rootChain.deposit(
        {
          from: operator,
          value: '1000000000000000'
        });
      const submit = async (block) => {
        const result = await this.rootChain.submit(
          block.getRoot(),
          {
            from: operator
          });
        block.setBlockTimestamp(ethers.utils.bigNumberify(result.logs[0].args._timestamp.toString()))
        block.setSuperRoot(result.logs[0].args._superRoot)
      }
      await submit(block3)
    })

    it("should succeed to exit two UTXO from same transaction", async () => {
      const txs = block3.getSignedTransactionWithProof(swapTx.hash())
      const tx1 = txs[0]
      const tx2 = txs[1]

      const result1 = await this.rootChain.exit(
        6 * 100 + 0,
        segment1.toBigNumber(),
        tx1.getTxBytes(),
        tx1.getProofAsHex(),
        {
          from: operator,
          value: BOND
        });
      const result2 = await this.rootChain.exit(
        6 * 100 + 1,
        segment2.toBigNumber(),
        tx2.getTxBytes(),
        tx2.getProofAsHex(),
        {
          from: alice,
          value: BOND
        });
      const exitId1 = result1.receipt.logs[0].args._exitId
      const exitId2 = result2.receipt.logs[0].args._exitId
      // 6 weeks after
      await increaseTime(duration.weeks(6));
      await this.rootChain.finalizeExit(
        exitableEnd,
        exitId1,
        tx1.getStateBytes(),
        {
          from: operator
        })
      await this.rootChain.finalizeExit(
        exitableEnd,
        exitId2,
        tx2.getStateBytes(),
        {
          from: alice
        })
    })
  })


  describe("forceIncludeRequest", () => {

    const exitableEnd = ethers.utils.bigNumberify('2000000')

    beforeEach(async () => {
      await this.rootChain.deposit(
        {
          from: alice,
          value: '1000000000000000'
        });
      await this.rootChain.deposit(
        {
          from: operator,
          value: '1000000000000000'
        });
      const submit = async (block) => {
        const result = await this.rootChain.submit(
          block.getRoot(),
          {
            from: operator
          });
        block.setBlockTimestamp(ethers.utils.bigNumberify(result.logs[0].args._timestamp.toString()))
        block.setSuperRoot(result.logs[0].args._superRoot)
      }
      await submit(Scenario2.blocks[0].block)
      await submit(Scenario2.blocks[1].block)
    })

    /*
    it("should succeed to force include", async () => {
      const tx1 = Scenario2.blocks[1].block.getSignedTransactionWithProof(
        Scenario2.blocks[1].transactions[0].hash())[0]
      const tx2 = Scenario2.blocks[1].block.getSignedTransactionWithProof(
        Scenario2.blocks[1].transactions[1].hash())[0]
      const forceIncludeTx = Scenario2.blocks[0].block.getSignedTransactionWithProof(
        Scenario2.blocks[0].transactions[0].hash())[1]
      forceIncludeTx.confirmMerkleProofs(testKeys.AlicePrivateKey)

      await this.rootChain.exit(
        8 * 100,
        Scenario2.segments[3].toBigNumber(),
        tx1.getTxBytes(),
        tx1.getProofAsHex(),
        tx1.getSignatures(),
        {
          from: operator,
          value: BOND
        });
      const result2 = await this.rootChain.exit(
        8 * 100,
        Scenario2.segments[4].toBigNumber(),
        tx2.getTxBytes(),
        tx2.getProofAsHex(),
        tx2.getSignatures(),
        {
          from: operator,
          value: BOND
        });
      const result3 = await this.rootChain.exit(
        6 * 100 + 1,
        Scenario2.segments[4].toBigNumber(),
        forceIncludeTx.getTxBytes(),
        forceIncludeTx.getProofAsHex(),
        forceIncludeTx.getSignatures(),
        1,
        {
          from: alice,
          gas: '800000',
          value: BOND
        });
      const exitId2 = result2.receipt.logs[0].args._exitId
      const exitId3 = result3.receipt.logs[0].args._exitId
      await this.rootChain.requestHigherPriorityExit(
        exitId3,
        exitId2,
        {
          from: alice
        });

      // 6 weeks after
      await increaseTime(duration.weeks(6));
      // operator can't exit tx2
      await assertRevert(this.rootChain.finalizeExit(
        exitableEnd,
        exitId2,
        {
          from: operator
        }))
    })

    it("should succeed to respond a force include", async () => {
      const tx1 = Scenario2.blocks[1].block.getSignedTransactionWithProof(
        Scenario2.blocks[1].transactions[0].hash())[0]
      const tx2 = Scenario2.blocks[1].block.getSignedTransactionWithProof(
        Scenario2.blocks[1].transactions[1].hash())[0]
      const forceIncludeTx = Scenario2.blocks[0].block.getSignedTransactionWithProof(
        Scenario2.blocks[0].transactions[0].hash())[1]
      const fullForceIncludeTx = Scenario2.blocks[0].block.getSignedTransactionWithProof(
        Scenario2.blocks[0].transactions[0].hash())[1]
      forceIncludeTx.confirmMerkleProofs(testKeys.AlicePrivateKey)
      fullForceIncludeTx.confirmMerkleProofs(testKeys.AlicePrivateKey)
      fullForceIncludeTx.confirmMerkleProofs(testKeys.OperatorPrivateKey)
      await this.rootChain.exit(
        8 * 100,
        Scenario2.segments[3].toBigNumber(),
        tx1.getTxBytes(),
        tx1.getProofAsHex(),
        tx1.getSignatures(),
        {
          from: operator,
          value: BOND
        });
      await this.rootChain.exit(
        8 * 100,
        Scenario2.segments[4].toBigNumber(),
        tx2.getTxBytes(),
        tx2.getProofAsHex(),
        tx2.getSignatures(),
        {
          from: operator,
          value: BOND
        });
      const exitId = 2
      await this.rootChain.exit(
        6 * 100 + 1,
        Scenario2.segments[4].toBigNumber(),
        forceIncludeTx.getTxBytes(),
        forceIncludeTx.getProofAsHex(),
        forceIncludeTx.getSignatures(),
        1,
        {
          from: alice,
          value: BOND
        });
      const exitId3 = 3
      await this.rootChain.includeSignature(
        exitId3,
        6 * 100 + 1,
        Scenario2.segments[4].toBigNumber(),
        fullForceIncludeTx.getTxBytes(),
        fullForceIncludeTx.getProofAsHex(),
        fullForceIncludeTx.getSignatures(),
        {
          from: operator,
          gas: '800000'
        });
      // 6 weeks after
      await increaseTime(duration.weeks(6));
      // operator can't exit tx2
      await assertRevert(this.rootChain.finalizeExit(
        exitableEnd,
        exitId,
        {
          from: operator
        }))
    })
    */

  })

  describe("listToken", () => {

    const exitableEnd = Scenario4.segments[1].end
    let ERC20Token

    beforeEach(async () => {
      const token = await TestPlasmaToken.new(
        "0x505152",
        "0x505152",
        "10",
        ethers.utils.bigNumberify(2000000000000000),
        {from: operator})
      ERC20Token = token
      await token.transfer(
        alice,
        ethers.utils.bigNumberify(200000000000000),
        {from: operator}
      )
      await token.transfer(
        bob,
        ethers.utils.bigNumberify(200000000000000),
        {from: operator}
      )
      await token.approve(
        this.rootChain.address,
        ethers.utils.bigNumberify(100000000000000),
        {
          from: alice
        })
      await token.approve(
        this.rootChain.address,
        ethers.utils.bigNumberify(100000000000000),
        {
          from: bob
        })
      await this.rootChain.listToken(
        token.address,
        ethers.utils.bigNumberify(1000000000000),
        {
          from: operator
        });
      await this.rootChain.depositERC20(
        token.address,
        ethers.utils.bigNumberify(100000000000000),
        {
          from: alice
        });
      await this.rootChain.depositERC20(
        token.address,
        ethers.utils.bigNumberify(100000000000000),
        {
          from: bob
        });
      const submit = async (block) => {
        const result = await this.rootChain.submit(
          block.getRoot(),
          {
            from: operator
          });
        block.setBlockTimestamp(ethers.utils.bigNumberify(result.logs[0].args._timestamp.toString()))
        block.setSuperRoot(result.logs[0].args._superRoot)
      }
      await submit(Scenario4.blocks[0].block)
    })

    it("should succeed to exit and finalizeExit ERC20", async () => {
      const tx = Scenario4.blocks[0].block.getSignedTransactionWithProof(
        Scenario4.blocks[0].transactions[0].hash())[0]
      const result = await this.rootChain.exit(
        6 * 100,
        Scenario4.segments[0].toBigNumber(),
        tx.getTxBytes(),
        tx.getProofAsHex(),
        {
          from: bob,
          value: BOND
        });
      const exitId = result.receipt.logs[0].args._exitId
      assert.equal(result.logs[0].event, 'ExitStarted')
      // 6 weeks after
      await increaseTime(duration.weeks(6));
      await showBalance(this.rootChain.address)
      await this.rootChain.finalizeExit(
        exitableEnd,
        exitId,
        tx.getStateBytes(),
        {
          from: bob
        });
      await showBalance(this.rootChain.address)
      async function showBalance(rootchainAddress) {
        const bobBalance = await ERC20Token.balanceOf(bob)
        const rootchainBalance = await ERC20Token.balanceOf(rootchainAddress)
        console.log('bob', bobBalance.toString(), 'rootchain', rootchainBalance.toString())
      }
    })
  })

})

struct tokenListing:
  # amount is plasma amount * decimalOffset
  decimalOffset:  uint256
  # address of the ERC20, ETH is ZERO_ADDRESS
  tokenAddress: address

struct Exit:
  owner: address
  exitableAt: uint256
  txHash: bytes32
  stateHash: bytes32
  blkNum: uint256
  segment: uint256
  isFinalized: bool

# extended attributes of exit
struct ExtendExit:
  extendedExitableAt: uint256
  priority: uint256
  challengeCount: uint256
  # 0: not force include
  # 1: user don't have confsig 1
  # 2: user don't have confsig 2
  forceInclude: uint256

struct Challenge:
  segment: uint256
  blkNum: uint256
  isAvailable: bool
  exitId: uint256

# This construction is from Plasma Group's imeplementation
# https://github.com/plasma-group/plasma-contracts/blob/master/contracts/PlasmaChain.vy#L6
struct exitableRange:
  start: uint256
  isAvailable: bool

contract ERC20:
  def transferFrom(_from: address, _to: address, _value: uint256) -> bool: modifying
  def transfer(_to: address, _value: uint256) -> bool: modifying

contract ERC721:
  def setup(): modifying
  def mint(_to: address, _tokenId: uint256): modifying
  def ownerOf(_tokenId: uint256) -> address: constant
  def burn(_tokenId: uint256): modifying

contract Checkpoint():
  def getCheckpoint(
    _checkpointId: uint256
  ) -> (uint256, uint256): constant

contract VerifierUtil():
  def parseSegment(
    segment: uint256
  ) -> (uint256, uint256, uint256): constant
  def isContainSegment(
    segment: uint256,
    small: uint256
  ) -> (bool): constant
  def hasInterSection(
    segment1: uint256,
    segment2: uint256
  ) -> (uint256, uint256, uint256): constant

contract CustomVerifier():
  def isExitGamable(
    _txHash: bytes32,
    _merkleHash: bytes32,
    _txBytes: bytes[496],
    _sigs: bytes[260],
    _outputIndex: uint256,
    _owner: address,
    _segment: uint256,
    _hasSig: uint256
  ) -> bool: constant
  def getOutput(
    _txBytes: bytes[496],
    _txBlkNum: uint256,
    _index: uint256
  ) -> bytes[256]: constant
  def getSpentEvidence(
    _txBytes: bytes[496],
    _index: uint256,
    _sigs: bytes[260]
  ) -> bytes[256]: constant
  def isSpent(
    _txHash: bytes32,
    _stateBytes: bytes[256],
    _evidence: bytes[256],
    _timestamp: uint256
  ) -> bool: constant
  def getDepositHash(
    _txBytes: bytes[496]
  ) -> bytes32: constant

ListingEvent: event({_tokenId: uint256, _tokenAddress: address})
BlockSubmitted: event({_superRoot: bytes32, _root: bytes32, _timestamp: timestamp, _blkNum: uint256})
Deposited: event({_depositer: indexed(address), _tokenId: uint256, _start: uint256, _end: uint256, _blkNum: uint256})
ExitStarted: event({_exitor: indexed(address), _exitId: uint256, _exitStateHash: bytes32, _exitableAt: uint256, _segment: uint256, _blkNum: uint256, _isForceInclude: bool})
Challenged: event({_exitId: uint256})
ForceIncluded: event({_exitId: uint256})
FinalizedExit: event({_exitId: uint256, _tokenId: uint256, _start: uint256, _end: uint256})
ExitableMerged: event({_tokenId: uint256, _start: uint256, _end: uint256})

# management
operator: address
verifierUtil:address
txverifier: address
checkpointAddress: address
childChain: map(uint256, bytes32)
exitToken: address
currentChildBlock: uint256
totalDeposited: public(map(uint256, uint256))
lastPublished: public(uint256)

# token types

listings: public(map(uint256, tokenListing))
listed: public(map(address, uint256))
listingNonce: public(uint256)

# exit

exitNonce: public(uint256)
# tokentype -> ( end -> start
exitable: public(map(uint256, map(uint256, exitableRange)))
exits: map(uint256, Exit)
extendExits: map(uint256, ExtendExit)
challenges: map(bytes32, Challenge)
childs: map(uint256, uint256)
lowerExits: map(uint256, uint256)
removed: map(bytes32, bool)

# total deposit amount per token type
TOTAL_DEPOSIT: constant(uint256) = 2**48
MASK8BYTES: constant(uint256) = 2**64 - 1

# exit period is 4 weeks
EXIT_PERIOD_SECONDS: constant(uint256) = 4 * 7 * 24 * 60 * 60
# 3 days extended period for withholding attack
EXTEND_PERIOD_SECONDS: constant(uint256) = 3 * 24 * 60 * 60

# bonds
EXIT_BOND: constant(wei_value) = as_wei_value(1, "finney")
CHALLENGE_BOND: constant(wei_value) = as_wei_value(1, "finney")
FORCE_INCLUDE_BOND: constant(wei_value) = as_wei_value(1, "finney")


@private
@constant
def getPlasmaBlockHash(
  _root: bytes32,
  _timestamp: uint256
) -> bytes32:
  return sha3(concat(
    _root,
    convert(_timestamp, bytes32)
  ))

@private
@constant
def checkMembership(
  _start: uint256,
  _end: uint256,
  _leaf: bytes32,
  _rootHash: bytes32,
  _proof: bytes[512]
) -> bool:
  currentAmount: uint256 = convert(slice(_proof, start=44, len=8), uint256)
  _totalAmount: uint256 = TOTAL_DEPOSIT * convert(slice(_proof, start=52, len=2), uint256)
  # currentAmount: uint256 = _end - _start
  currentLeft: uint256 = 0
  currentRight: uint256 = _totalAmount
  computedHash: bytes32 = _leaf
  proofElement: bytes32

  for i in range(16):
    if (54 + i * 41) >= len(_proof):
      break
    leftOrRight: uint256 = convert(slice(_proof, start=54 + i * 41, len=1), uint256)
    amount: uint256 = convert(slice(_proof, start=54 + i * 41 + 1, len=8), uint256)
    proofElement = extract32(_proof, 54 + i * 41 + 9, type=bytes32)
    if leftOrRight == 0:
      currentRight -= amount
      computedHash = sha3(concat(
        convert(currentAmount, bytes32), computedHash, convert(amount, bytes32), proofElement))
    else:
      currentLeft += amount
      computedHash = sha3(concat(
        convert(amount, bytes32), proofElement, convert(currentAmount, bytes32), computedHash))
    currentAmount += amount
  return (computedHash == _rootHash) and (currentLeft <= _start) and (_end <= currentRight)

# check transaction include deposit transaction
@public
@constant
def checkTransaction(
  _segment: uint256,
  _txHash: bytes32,
  _txBytes: bytes[496],
  _blkNum: uint256,
  _proof: bytes[512],
  _sigs: bytes[260],
  _hasSig: uint256,
  _outputIndex: uint256,
  _owner: address
) -> bytes[256]:
  root: bytes32
  blockTimestamp: uint256
  if _blkNum % 2 == 0:
    tokenId: uint256
    start: uint256
    end: uint256
    (tokenId, start, end) = VerifierUtil(self.verifierUtil).parseSegment(_segment)
    root = extract32(_proof, 0 + 4, type=bytes32)
    blockTimestamp = convert(slice(_proof, start=32 + 4, len=8), uint256)
    assert self.childChain[_blkNum] == self.getPlasmaBlockHash(root, blockTimestamp)
    assert self.checkMembership(
      start + tokenId * TOTAL_DEPOSIT,
      end + tokenId * TOTAL_DEPOSIT,
      _txHash,
      root,
      _proof
    )
  else:
    root = self.childChain[_blkNum]
    blockTimestamp = 0
    # deposit transaction
    depositHash: bytes32 = CustomVerifier(self.txverifier).getDepositHash(_txBytes)
    assert depositHash == root
  txBytesOffset: int128 = convert(slice(_proof, start=0, len=2), int128)
  txBytesSize: int128 = convert(slice(_proof, start=2, len=2), int128)
  slicedTxBytes: bytes[496] = slice(_txBytes, start=txBytesOffset, len=txBytesSize)
  assert CustomVerifier(self.txverifier).isExitGamable(
    _txHash,
    sha3(concat(_txHash, self.childChain[_blkNum])),
    slicedTxBytes,
    _sigs,
    _outputIndex,
    _owner,
    _segment,
    _hasSig)
  return CustomVerifier(self.txverifier).getOutput(
    slicedTxBytes,
    _blkNum,
    _outputIndex)

# checkExitable construction is from Plasma Group
# https://github.com/plasma-group/plasma-contracts/blob/master/contracts/PlasmaChain.vy#L363
@private
@constant
def checkExitable(
  _tokenId: uint256,
  _start: uint256,
  _end: uint256,
  _exitableEnd: uint256
):
  assert _end <= TOTAL_DEPOSIT
  assert _end <= _exitableEnd
  assert _start >= self.exitable[_tokenId][_exitableEnd].start
  assert self.exitable[_tokenId][_exitableEnd].isAvailable

@private
def removeExitable(
  _tokenId: uint256,
  _newStart: uint256,
  _newEnd: uint256,
  _oldEnd: uint256
):
  oldStart: uint256 = self.exitable[_tokenId][_oldEnd].start
  # old start < new start
  if _newStart > oldStart:
    self.exitable[_tokenId][_newStart].start = oldStart
    self.exitable[_tokenId][_newStart].isAvailable = True
  # new end < old end
  if _newEnd < _oldEnd:
    self.exitable[_tokenId][_oldEnd].start = _newEnd
    self.exitable[_tokenId][_oldEnd].isAvailable = True
    self.exitable[_tokenId][_newEnd].start = _newStart
    self.exitable[_tokenId][_newEnd].isAvailable = False
  # new end >= old start
  else:
    # _newEnd is right most
    if _newEnd != self.totalDeposited[_tokenId]:
      self.exitable[_tokenId][_newEnd].isAvailable = False
    # _newEnd isn't right most
    else:
      self.exitable[_tokenId][_newEnd].start = _newEnd 

# @dev processDeposit
@private
def processDeposit(
  depositer: address,
  tokenId: uint256,
  amount: uint256
):
  self.currentChildBlock += (1 + (self.currentChildBlock % 2))
  start: uint256 = self.totalDeposited[tokenId]
  self.totalDeposited[tokenId] += amount
  end: uint256 = self.totalDeposited[tokenId]
  root: bytes32 = sha3(
                    concat(
                      convert(depositer, bytes32),
                      convert(tokenId, bytes32),
                      convert(start, bytes32),
                      convert(end, bytes32)
                    )
                  )
  oldStart: uint256 = self.exitable[tokenId][start].start
  clear(self.exitable[tokenId][start])
  self.exitable[tokenId][end].start = oldStart
  self.exitable[tokenId][end].isAvailable = True
  self.childChain[self.currentChildBlock] = root
  log.Deposited(depositer, tokenId, start, end, self.currentChildBlock)

# @dev processDepositFragment
@private
def processDepositFragment(
  depositer: address,
  tokenId: uint256,
  start: uint256,
  end: uint256,
  exitableEnd: uint256
):
  self.currentChildBlock += (1 + (self.currentChildBlock % 2))
  assert self.exitable[tokenId][exitableEnd].start == start
  assert self.exitable[tokenId][exitableEnd].isAvailable == False
  self.exitable[tokenId][exitableEnd].start = end
  self.exitable[tokenId][end].start = start
  self.exitable[tokenId][end].isAvailable = True
  root: bytes32 = sha3(
                    concat(
                      convert(depositer, bytes32),
                      convert(tokenId, bytes32),
                      convert(start, bytes32),
                      convert(end, bytes32)
                    )
                  )
  self.childChain[self.currentChildBlock] = root
  log.Deposited(depositer, tokenId, start, end, self.currentChildBlock)

# @dev Constructor
@public
def __init__(
  _verifierUtil: address,
  _txverifierAddress: address,
  _exitToken: address,
  _checkpointAddress: address
):
  self.operator = msg.sender
  self.currentChildBlock = 1
  self.verifierUtil = _verifierUtil
  self.txverifier = _txverifierAddress
  self.exitToken = create_with_code_of(_exitToken)
  self.checkpointAddress = _checkpointAddress
  ERC721(self.exitToken).setup()
  self.listingNonce = 0
  self.exitNonce = 1

@public
@constant
def getTokenAddress() -> address:
  return self.exitToken

@public
def listToken(
  tokenAddress: address,
  denomination: uint256
):
  tokenId: uint256 = self.listingNonce
  self.listings[tokenId].decimalOffset = denomination
  self.listings[tokenId].tokenAddress = tokenAddress
  self.listed[tokenAddress] = tokenId
  self.listingNonce += 1
  # init the new token exitable ranges
  self.exitable[tokenId][0].isAvailable = True
  log.ListingEvent(tokenId, tokenAddress)

@public
@constant
def getTokenFromId(
  tokenId: uint256
) -> (address, uint256):
  return (self.listings[tokenId].tokenAddress, self.listings[tokenId].decimalOffset)

@public
def setup():
  self.listToken(ZERO_ADDRESS, as_unitless_number(as_wei_value(1, "gwei")))

@public
def updateOperator(_newOperator: address):
  assert msg.sender == self.operator
  self.operator = _newOperator

# @dev submit plasma block
@public
def submit(_root: bytes32):
  assert msg.sender == self.operator
  self.currentChildBlock += (2 - (self.currentChildBlock % 2))
  _superRoot: bytes32 = self.getPlasmaBlockHash(_root, as_unitless_number(block.timestamp))
  self.childChain[self.currentChildBlock] = _superRoot
  log.BlockSubmitted(_superRoot, _root, block.timestamp, self.currentChildBlock)

# @dev deposit
@public
@payable
def deposit():
  # 1 in Plasma is 1 gwei
  decimalOffset: wei_value = as_wei_value(1, "gwei")
  assert (msg.value % decimalOffset == 0)
  self.processDeposit(
    msg.sender,
    0,
    as_unitless_number(msg.value / decimalOffset))

# @dev depositFragment
@public
@payable
def depositFragment(
  start: uint256,
  end: uint256,
  exitableEnd: uint256
):
  decimalOffset: wei_value = as_wei_value(1, "gwei")
  assert (msg.value % decimalOffset == 0)
  assert start + as_unitless_number(msg.value / decimalOffset) == end
  self.processDepositFragment(
    msg.sender,
    0,
    start,
    end,
    exitableEnd)

@public
def depositERC20(
  token: address,
  amount: uint256
):
  depositer: address = msg.sender
  passed: bool = ERC20(token).transferFrom(depositer, self, amount)
  tokenId: uint256 = self.listed[token]
  assert passed
  self.processDeposit(
    depositer,
    tokenId,
    amount / self.listings[tokenId].decimalOffset)

# @dev exit
@public
@payable
def exit(
  _utxoPos: uint256,
  _segment: uint256,
  _txBytes: bytes[496],
  _proof: bytes[512],
  _sig: bytes[260],
  _hasSig: uint256
):
  assert msg.value == EXIT_BOND
  exitableAt: uint256 = as_unitless_number(block.timestamp) + EXIT_PERIOD_SECONDS
  blkNum: uint256 = _utxoPos / 100
  outputIndex: uint256 = _utxoPos - blkNum * 100
  txHash: bytes32 = sha3(_txBytes)
  exitId: uint256 = self.exitNonce
  if self.challenges[txHash].isAvailable and self.challenges[txHash].blkNum < blkNum:
    # prevTx's segment should contains exit segment
    # https://github.com/cryptoeconomicslab/chamber-packages/pull/184
    assert VerifierUtil(self.verifierUtil).isContainSegment(self.challenges[txHash].segment, _segment)
    self.extendExits[exitId].priority = self.challenges[txHash].blkNum
    self.childs[self.challenges[txHash].exitId] = exitId
  exitStateBytes: bytes[256] = self.checkTransaction(
    _segment,
    txHash,
    _txBytes,
    blkNum,
    _proof,
    _sig,
    _hasSig,
    outputIndex,
    msg.sender
  )
  exitStateHash: bytes32 = sha3(exitStateBytes)
  self.exitNonce += 1
  self.exits[exitId] = Exit({
    owner: msg.sender,
    exitableAt: exitableAt,
    txHash: txHash,
    stateHash: exitStateHash,
    blkNum: blkNum,
    segment: _segment,
    isFinalized: False
  })
  if _hasSig > 0:
    self.extendExits[exitId].forceInclude = _hasSig
    self.removed[txHash] = True
  ERC721(self.exitToken).mint(msg.sender, exitId)
  log.ExitStarted(msg.sender, exitId, exitStateHash, exitableAt, _segment, blkNum, _hasSig > 0)

# @dev challenge
# @param _utxoPos is blknum and index of challenge tx
@public
def challenge(
  _exitId: uint256,
  _childExitId: uint256,
  _exitStateBytes: bytes[256],
  _utxoPos: uint256,
  _segment: uint256,
  _txBytes: bytes[496],
  _proof: bytes[512],
  _sig: bytes[260]
):
  blkNum: uint256 = _utxoPos / 100
  txoIndex: uint256 = _utxoPos - blkNum * 100
  exit: Exit = self.exits[_exitId]
  exitBlkNum: uint256 = exit.blkNum
  VerifierUtil(self.verifierUtil).hasInterSection(_segment, exit.segment)
  # assert exit.txHash == sha3(_exitTxBytes)
  txHash: bytes32 = sha3(_txBytes)
  assert exit.stateHash == sha3(_exitStateBytes)
  if _exitId == _childExitId:
    # spent challenge
    assert exitBlkNum < blkNum
  else:
    # double spent challenge
    assert self.childs[_exitId] == _childExitId
    assert exitBlkNum < blkNum and blkNum < self.exits[_childExitId].blkNum
  assert exit.exitableAt > as_unitless_number(block.timestamp)
  # check removed transaction sha3(_txBytes)
  assert not self.removed[txHash]
  self.checkTransaction(
    _segment,
    txHash,
    _txBytes,
    blkNum,
    _proof,
    _sig,
    0,
    0,
    ZERO_ADDRESS
  )
  if _exitId == _childExitId:
    lowerExit: uint256 = self.lowerExits[_exitId]
    if self.exits[lowerExit].owner != ZERO_ADDRESS:
      self.extendExits[lowerExit].challengeCount -= 1
      if as_unitless_number(block.timestamp) > self.exits[lowerExit].exitableAt - EXTEND_PERIOD_SECONDS:
        self.extendExits[lowerExit].extendedExitableAt = as_unitless_number(block.timestamp) + EXTEND_PERIOD_SECONDS
    self.challenges[txHash] = Challenge({
      segment: exit.segment,
      blkNum: exitBlkNum,
      isAvailable: True,
      exitId: _exitId
    })
  blockTimestamp: uint256 = convert(slice(_proof, start=32, len=8), uint256)
  assert CustomVerifier(self.txverifier).isSpent(
    txHash,
    _exitStateBytes,
    CustomVerifier(self.txverifier).getSpentEvidence(
      _txBytes, txoIndex, _sig),
    blockTimestamp)
  # break exit procedure
  if self.extendExits[_exitId].forceInclude > 0:
    self.removed[exit.txHash] = False
  if _exitId == _childExitId:
    self.exits[_exitId].owner = ZERO_ADDRESS
    clear(self.exits[_exitId])
  else:
    self.exits[_childExitId].owner = ZERO_ADDRESS
    clear(self.exits[_childExitId])
  send(msg.sender, EXIT_BOND)
  log.Challenged(_exitId)

# @dev requestHigherPriorityExit
#     This is an alternative to invalid history challenge.
@public
def requestHigherPriorityExit(
  _higherPriorityExitId: uint256,
  _lowerPriorityExitId: uint256
):
  higherPriorityExit: Exit = self.exits[_higherPriorityExitId]
  exit: Exit = self.exits[_lowerPriorityExitId]
  higherPriority: uint256 = higherPriorityExit.blkNum
  lowerPriority: uint256 = exit.blkNum
  if self.extendExits[_higherPriorityExitId].priority > 0:
    higherPriority = self.extendExits[_higherPriorityExitId].priority
  if self.extendExits[_lowerPriorityExitId].priority > 0:
    lowerPriority = self.extendExits[_lowerPriorityExitId].priority
  assert higherPriority < lowerPriority
  assert self.lowerExits[_higherPriorityExitId] == 0
  VerifierUtil(self.verifierUtil).hasInterSection(higherPriorityExit.segment, exit.segment)
  self.extendExits[_lowerPriorityExitId].challengeCount += 1
  self.lowerExits[_higherPriorityExitId] = _lowerPriorityExitId

@public
def includeSignature(
  _exitId: uint256,
  _utxoPos: uint256,
  _segment: uint256,
  _txBytes: bytes[496],
  _proof: bytes[512],
  _sig: bytes[260]
):
  blkNum: uint256 = _utxoPos / 100
  outputIndex: uint256 = _utxoPos - blkNum * 100
  txHash: bytes32 = sha3(_txBytes)
  exit: Exit = self.exits[_exitId]
  self.checkTransaction(
    _segment,
    txHash,
    _txBytes,
    blkNum,
    _proof,
    _sig,
    0,
    outputIndex,
    ZERO_ADDRESS
  )
  assert self.extendExits[_exitId].forceInclude > 0
  self.removed[txHash] = False
  send(msg.sender, FORCE_INCLUDE_BOND)
  log.ForceIncluded(_exitId)

# @dev finalizeExit
@public
def finalizeExit(
  _exitableEnd: uint256,
  _exitId: uint256
):
  assert ERC721(self.exitToken).ownerOf(_exitId) == msg.sender
  exit: Exit = self.exits[_exitId]
  tokenId: uint256
  start: uint256
  end: uint256
  (tokenId, start, end) = VerifierUtil(self.verifierUtil).parseSegment(exit.segment)
  # check _tokenId is correct
  self.checkExitable(
    tokenId,
    start,
    end,
    _exitableEnd,
  )
  self.removeExitable(
    tokenId,
    start,
    end,
    _exitableEnd
  )
  assert exit.exitableAt < as_unitless_number(block.timestamp) and self.extendExits[_exitId].extendedExitableAt < as_unitless_number(block.timestamp)
  assert self.extendExits[_exitId].challengeCount == 0
  if self.extendExits[_exitId].forceInclude == 0:
    if tokenId == 0:
      send(exit.owner, as_wei_value(end - start, "gwei") + EXIT_BOND)
    else:
      ERC20(self.listings[tokenId].tokenAddress).transfer(exit.owner, (end - start) * self.listings[tokenId].decimalOffset)
      send(exit.owner, EXIT_BOND)
  else:
    send(exit.owner, FORCE_INCLUDE_BOND)
  self.exits[_exitId].isFinalized = True
  ERC721(self.exitToken).burn(_exitId)
  log.FinalizedExit(_exitId, tokenId, start, end)

@public
def challengeTooOldExit(
  _checkpointId: uint256,
  _utxoPos: uint256,
  _exitId: uint256,
  _segment: uint256,
  _txBytes: bytes[496],
  _proof: bytes[512],
  _sig: bytes[260]
):
  blkNum: uint256 = _utxoPos / 100
  outputIndex: uint256 = _utxoPos - blkNum * 100
  exit: Exit = self.exits[_exitId]
  VerifierUtil(self.verifierUtil).hasInterSection(_segment, exit.segment)
  checkpointBlkNum: uint256
  checkpointSegment: uint256
  (checkpointBlkNum, checkpointSegment) = Checkpoint(self.checkpointAddress).getCheckpoint(_checkpointId)
  VerifierUtil(self.verifierUtil).hasInterSection(_segment, checkpointSegment)
  txHash: bytes32 = sha3(_txBytes)
  assert blkNum <= checkpointBlkNum
  priority: uint256 = exit.blkNum
  if self.extendExits[_exitId].priority > 0:
    priority = self.extendExits[_exitId].priority
  assert blkNum > priority
  self.checkTransaction(
    _segment,
    txHash,
    _txBytes,
    blkNum,
    _proof,
    _sig,
    0,
    outputIndex,
    ZERO_ADDRESS
  )
  # break exit
  clear(self.exits[_exitId])
  log.Challenged(_exitId)

# @dev mergeExitable
@public
def mergeExitable(
  _segment1: uint256,
  _segment2: uint256
):
  tokenId1: uint256
  start1: uint256
  end1: uint256
  tokenId2: uint256
  start2: uint256
  end2: uint256
  (tokenId1, start1, end1) = VerifierUtil(self.verifierUtil).parseSegment(_segment1)
  (tokenId2, start2, end2) = VerifierUtil(self.verifierUtil).parseSegment(_segment2)
  assert tokenId1 == tokenId2 and end1 == start2
  assert self.exitable[tokenId1][end1].start == start1
  assert self.exitable[tokenId1][end2].start == start2
  assert self.exitable[tokenId1][end1].isAvailable == self.exitable[tokenId1][end2].isAvailable
  self.exitable[tokenId1][end2].start = start1
  clear(self.exitable[tokenId1][end1])
  log.ExitableMerged(tokenId1, start1, end2)

# @dev getExit
@public
@constant
def getExit(
  _exitId: uint256
) -> (address, uint256, uint256):
  exit: Exit = self.exits[_exitId]
  return (exit.owner, exit.exitableAt, self.extendExits[_exitId].challengeCount)

# @dev getExit
@public
@constant
def getFinalizedExit(
  _exitId: uint256
) -> (address, uint256, uint256):
  exit: Exit = self.exits[_exitId]
  assert exit.isFinalized
  return (exit.owner, exit.blkNum, exit.segment)

# @dev getPlasmaBlock
@public
@constant
def getPlasmaBlock(
  _blkNum: uint256
) -> (bytes32):
  return self.childChain[_blkNum]

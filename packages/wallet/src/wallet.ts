import * as ethers from 'ethers'
import * as Logger from 'js-logger'
import EventEmitter from 'events'
import {
  PlasmaClient, FastTransferResponse
} from './client'
import {
  IStorage
} from './storage/IStorage'
import { EventWatcher } from '@layer2/events-watcher'
import { WalletStorage } from './storage/WalletStorage'
import {
  Address,
  constants,
  ExitableRangeManager,
  SignedTransaction,
  SignedTransactionWithProof,
  Block,
  Segment,
  ChamberResult,
  ChamberResultError,
  ChamberOk,
  SwapRequest,
  StateUpdate,
  OwnershipPredicate,
  PredicatesManager
} from '@layer2/core'
import { WalletErrorFactory } from './error'
import { Exit, WaitingBlockWrapper, TokenType, UserAction, UserActionUtil } from './models'
import { Contract } from 'ethers'
import { BigNumber } from 'ethers/utils';
import { PlasmaSyncher } from './client/PlasmaSyncher'
import { StateManager } from './StateManager'
import artifact from './assets/RootChain.json'
import { SegmentHistoryManager } from './history/SegmentHistory';
import { DefragAlgorithm } from './strategy/defrag'
import { TransferAlgorithm } from './strategy/transfer';
if(!artifact.abi) {
  console.error('ABI not found')
}

const abi = [
  'event BlockSubmitted(bytes32 _superRoot, bytes32 _root, uint256 _timestamp, uint256 _blkNum)',
  'event Deposited(address indexed _depositer, uint256 _tokenId, uint256 _start, uint256 _end, uint256 _blkNum)',
  'event ExitStarted(address indexed _exitor, uint256 _exitId, uint256 exitableAt, uint256 _segment, uint256 _blkNum)',
  'event FinalizedExit(uint256 _exitId, uint256 _tokenId, uint256 _start, uint256 _end)',
  'function deposit() payable',
  'function depositERC20(address token, uint256 amount) payable',
  'function exit(uint256 _utxoPos, uint256 _segment, bytes _txBytes, bytes _proof) payable',
  'function finalizeExit(uint256 _exitableEnd, uint256 _exitId, bytes _exitStateBytes)',
  'function getExit(uint256 _exitId) constant returns(address, uint256)',
]

const ERC20abi = [
  'function approve(address _spender, uint256 _value) returns (bool)',
  'function balanceOf(address tokenOwner) view returns (uint)'
]

export class ChamberWallet extends EventEmitter {
  private client: PlasmaClient
  private loadedBlockNumber: number = 0
  private rootChainContract: Contract
  private wallet: ethers.Wallet
  private storage: WalletStorage
  private httpProvider: ethers.providers.JsonRpcProvider
  private listener: EventWatcher
  private rootChainInterface: ethers.utils.Interface
  private exitableRangeManager: ExitableRangeManager = new ExitableRangeManager()
  private plasmaSyncher: PlasmaSyncher
  private options: any
  private segmentHistoryManager: SegmentHistoryManager
  public isMerchant: boolean
  private predicatesManager: PredicatesManager
  private stateManager: StateManager

  /**
   * 
   * @param client 
   * @param privateKey 
   * @param rootChainEndpoint Main chain endpoint
   * @param contractAddress RootChain address
   * @param storage 
   * 
   * ### Example
   * 
   * ```typescript
   *  const jsonRpcClient = new JsonRpcClient('http://localhost:3000')
   *  const client = new PlasmaClient(jsonRpcClient)
   *  const storage = new WalletStorage()
   *  return ChamberWallet.createWalletWithPrivateKey(
   *    client,
   *    'http://127.0.0.1:8545',
   *    '0x00... root chain address',
   *    storage,
   *    '0x00... private key'
   *  )
   * ```
   */
  static createWalletWithPrivateKey(
    client: PlasmaClient,
    rootChainEndpoint: string,
    contractAddress: Address,
    storage: IStorage,
    privateKey: string,
    options?: any
  ) {
    const httpProvider = new ethers.providers.JsonRpcProvider(rootChainEndpoint)
    return new ChamberWallet(
      client,
      httpProvider,
      new ethers.Wallet(privateKey, httpProvider),
      contractAddress,
      storage,
      options
    )
  }

  static createWalletWithMnemonic(
    client: PlasmaClient,
    rootChainEndpoint: string,
    contractAddress: Address,
    storage: IStorage,
    mnemonic: string,
    options?: any
  ) {
    return new ChamberWallet(
      client,
      new ethers.providers.JsonRpcProvider(rootChainEndpoint),
      ethers.Wallet.fromMnemonic(mnemonic),
      contractAddress,
      storage,
      options
    )    
  }

  static createRandomWallet(
    client: PlasmaClient,
    rootChainEndpoint: string,
    contractAddress: Address,
    storage: IStorage,
    options?: any
  ) {
    return new ChamberWallet(
      client,
      new ethers.providers.JsonRpcProvider(rootChainEndpoint),
      ethers.Wallet.createRandom(),
      contractAddress,
      storage,
      options
    )
  }

  constructor(
    client: PlasmaClient,
    provider: ethers.providers.JsonRpcProvider,
    wallet: ethers.Wallet,
    contractAddress: Address,
    storage: IStorage,
    options?: any
  ) {
    super()
    this.client = client
    this.options = options || {}
    this.httpProvider = provider
    const contract = new ethers.Contract(contractAddress, abi, this.httpProvider)
    this.wallet = wallet
    this.rootChainContract = contract.connect(this.wallet)
    this.storage = new WalletStorage(storage)
    this.rootChainInterface = new ethers.utils.Interface(artifact.abi)
    this.plasmaSyncher = new PlasmaSyncher(
      client,
      provider,
      contractAddress,
      this.storage,
      this.options
    )
    this.isMerchant = this.options.isMerchant || false
    this.listener = this.plasmaSyncher.getListener()
    
    this.listener.addEvent('ListingEvent', (e) => {
      Logger.debug('ListingEvent', e)
      this.handleListingEvent(
        e.values._tokenId,
        e.values._tokenAddress
      )
    })
    this.listener.addEvent('ExitStarted', (e) => {
      Logger.debug('ExitStarted', e)
      this.handleExit(
        e.values._exitId,
        e.values._exitStateHash,
        e.values._exitableAt,
        e.values._segment
      )
    })
    this.listener.addEvent('FinalizedExit', (e) => {
      Logger.debug('FinalizedExit', e)
      this.handleFinalizedExit(
        e.values._tokenId,
        e.values._start,
        e.values._end
      )
    })
    this.listener.addEvent('Deposited', (e) => {
      Logger.debug('Deposited', e)
      this.handleDeposit(
        e.values._depositer,
        e.values._tokenId,
        e.values._start,
        e.values._end,
        e.values._blkNum
      )
    })
    this.predicatesManager = new PredicatesManager()
    this.predicatesManager.addPredicate(ethers.constants.AddressZero, 'OwnershipPredicate')
    this.stateManager = new StateManager(this.predicatesManager)
    this.segmentHistoryManager = new SegmentHistoryManager(storage, this.client, this.predicatesManager)
    this.plasmaSyncher.on('PlasmaBlockHeaderAdded', (e: any) => {
      this.segmentHistoryManager.appendBlockHeader(e.blockHeader as WaitingBlockWrapper)
    })
    Logger.useDefaults()
    if(this.options.logLevel === 'debug') {
      Logger.setLevel(Logger.DEBUG)
    } else {
      Logger.setLevel(Logger.WARN)
    }
  }

  setPredicate(name: string, predicate: Address) {
    this.predicatesManager.addPredicate(predicate, name)
  }

  /**
   * 
   * @param handler 
   * 
   * ```typescript
   * await wallet.init((wallet) => {})
   * ```
   */
  async init() {
    await this.storage.init()
    const state: any[] = await this.storage.getState()
    console.log(state)
    this.stateManager.deserialize(state)
    this.exitableRangeManager = await this.storage.loadExitableRangeManager()
    this.loadedBlockNumber = await this.storage.getLoadedPlasmaBlockNumber()
    if(this.isMerchant) {
      this.client.subscribeFastTransfer(this.getAddress(), async (tx) => {
        await this.sendFastTransferToOperator(tx)
      })
    }
    await this.plasmaSyncher.init(() => {
      this.emit('updated', {wallet: this})
    })
  }

  async cancelPolling() {
    this.plasmaSyncher.cancel()
    this.client.unsubscribeFastTransfer(this.getAddress())
  }

  async loadBlockNumber() {
    return await this.client.getBlockNumber()
  }
  
  getPlasmaBlockNumber() {
    return this.loadedBlockNumber
  }

  /**
   * get current targetBlock
   */
  getTargetBlockNumber() {
    return this.loadedBlockNumber + 3
  }

  async syncChildChain(): Promise<SignedTransactionWithProof[]> {
    await this.plasmaSyncher.sync(async (block: Block) => {
      await this.updateBlock(block)
    })
    return this.getUTXOArray()
  }

  /**
   * @ignore
   */
  private async updateBlock(block: Block) {
    const tasksForExistingStates = this.getUTXOArray().map(async (tx) => {
      const segmentedBlock = block.getSegmentedBlock(tx.getOutput().getSegment())
      const key = tx.getOutput().hash()
      return await this.segmentHistoryManager.appendSegmentedBlock(key, segmentedBlock)
    })
    await Promise.all(tasksForExistingStates)
    const tasks = block.getUserTransactionAndProofs(this.wallet.address, this.predicatesManager).map(async tx => {
      if(this.stateManager.spend(tx).length > 0) {
        this.emit('send', {tx: tx})
        this.storage.addUserAction(tx.blkNum.toNumber(), UserActionUtil.createSend(tx))
      }
      if(tx.getOutput().isOwnedBy(this.wallet.address, this.predicatesManager)) {
        this.segmentHistoryManager.init(
          tx.getOutput().hash(),
          tx.getOutput().getSegment())
        const verified = await this.verifyHistory(tx)
        if(verified) {
          this.stateManager.insert(tx)
          this.flushCurrentState()
          this.emit('receive', {tx: tx})
          this.storage.addUserAction(tx.blkNum.toNumber(), UserActionUtil.createReceive(tx))
        }
      }
    }).filter(p => !!p)
    this.loadedBlockNumber = block.getBlockNumber()
    this.storage.setLoadedPlasmaBlockNumber(this.loadedBlockNumber)
    this.flushCurrentState()
    return tasks
  }

  async handleListingEvent(tokenId: BigNumber, tokenAddress: string) {
    // add available token
    this.storage.addToken(tokenId.toNumber(), tokenAddress)
  }

  getAvailableTokens(): TokenType[] {
    return this.storage.getTokens()
  }

  /**
   * @ignore
   */
  handleDeposit(depositor: string, tokenId: BigNumber, start: BigNumber, end: BigNumber, blkNum: BigNumber) {
    const depositorAddress = ethers.utils.getAddress(depositor)
    const segment = new Segment(tokenId, start, end)
    const depositTx = OwnershipPredicate.create(
      segment,
      blkNum,
      this.predicatesManager.getNativePredicate('OwnershipPredicate'),
      depositorAddress,
    )
    if(depositorAddress === this.getAddress()) {
      this.segmentHistoryManager.init(
        depositTx.hash(),
        segment)
      this.stateManager.insertDepositTx(depositTx)
      this.flushCurrentState()
    }
    this.segmentHistoryManager.appendDeposit(depositTx)
    this.exitableRangeManager.extendRight(end)
    this.storage.saveExitableRangeManager(this.exitableRangeManager)
    this.emit('deposited', { wallet: this, tx: depositTx})
    return depositTx
  }

  /**
   * @description flush current stateUpdates to storage
   */
  private flushCurrentState() {
    this.storage.setState(this.stateManager.serialize())
  }

  /**
   * @ignore
   */
  handleExit(
    exitId: BigNumber,
    exitStateHash: string,
    exitableAt: BigNumber,
    segmentUint: BigNumber
  ) {
    const segment = Segment.fromBigNumber(segmentUint)
    const utxo = this.getUTXOArray().filter(utxo => {
      return utxo.getOutput().getSegment().toBigNumber().eq(segment.toBigNumber())
    })[0]
    if(utxo) {
      this.stateManager.startExit(utxo.getSegment())
      this.flushCurrentState()
      const exit = new Exit(
        exitId,
        exitableAt,
        segment,
        utxo.getStateBytes()
      )
      this.storage.setExit(exit)
      this.emit('exitStarted', { wallet: this })
      return exit
    } else {
      null
    }
  }

  /**
   * @ignore
   */
  handleFinalizedExit(tokenId: BigNumber, start: BigNumber, end: BigNumber) {
    try {
      this.exitableRangeManager.remove(
        tokenId,
        start,
        end
      )
    }catch(e){
      console.warn(e.message)
    }
    this.storage.saveExitableRangeManager(this.exitableRangeManager)
    this.emit('finlaizedEixt', { wallet: this })
  }

  getExits() {
    return this.storage.getExitList()
  }

  async getUserActions(blkNum: number): Promise<UserAction[]> {
    return this.storage.searchActions(blkNum)
  }

  getUTXOArray(): SignedTransactionWithProof[] {
    let arr = this.stateManager.getSignedTransactionWithProofs()
    arr.sort((a: SignedTransactionWithProof, b: SignedTransactionWithProof) => {
      const aa = a.getOutput().getSegment().start
      const bb = b.getOutput().getSegment().start
      if(aa.gt(bb)) return 1
      else if(aa.lt(bb)) return -1
      else return 0
    })
    return arr
  }

  getAddress() {
    return this.wallet.address
  }

  async getBalanceOfMainChain(_tokenId?: number): Promise<BigNumber> {
    const tokenId = _tokenId || 0
    if(tokenId == 0) {
      return this.wallet.getBalance()
    } else {
      // had better to use cache?
      const address = this.getAvailableTokens().filter(t => t.id == tokenId).map(t => t.address)[0]
      const contract = new ethers.Contract(address, ERC20abi, this.httpProvider)
      const ERC20 = contract.connect(this.wallet)
      const resultBalanceOf = await ERC20.balanceOf(this.getAddress())
      return resultBalanceOf
    }
  }

  /**
   * get balance of specified tokenId
   * @param _tokenId tokenId ETH id 0
   */
  getBalance(_tokenId?: number) {
    const tokenId = _tokenId || 0
    let balance = ethers.utils.bigNumberify(0)
    this.getUTXOArray().forEach((tx) => {
      const segment = tx.getOutput().getSegment()
      if(segment.getTokenId().toNumber() == tokenId) {
        balance = balance.add(tx.getOutput().getSegment().getAmount())
      }
    })
    return balance
  }

  /**
   * verifyHistory is history verification method for UTXO
   * @param tx The tx be verified history
   */
  async verifyHistory(tx: SignedTransactionWithProof): Promise<boolean> {
    const key = tx.getOutput().hash()
    // verify history between deposit and latest tx
    // segmentHistoryManager.verifyHistory should return current UTXO
    const utxos = await this.segmentHistoryManager.verifyHistory(key)
    if(utxos.length > 0) {
      tx.checkVerified(true)
      // update
      this.stateManager.insert(tx)
      this.flushCurrentState()
      this.emit('updated', {wallet: this})
      return true
    } else {
      return false
    }
  }

   private async _deposit(result: any): Promise<ChamberResult<StateUpdate>> {
    await result.wait()
    const receipt = await this.httpProvider.getTransactionReceipt(result.hash)
    if(receipt.logs && receipt.logs[0]) {
      const rootChainAddress = ethers.utils.getAddress(this.rootChainContract.address)
      const log = receipt.logs.filter(log => log.address == rootChainAddress)[0]
      const logDesc = this.rootChainInterface.parseLog(log)
      return new ChamberOk(this.handleDeposit(
        logDesc.values._depositer,
        logDesc.values._tokenId,
        logDesc.values._start,
        logDesc.values._end,
        logDesc.values._blkNum
      ))
    } else {
      return new ChamberResultError(WalletErrorFactory.InvalidReceipt())
    }
  }


  /**
   * 
   * @param ether 1.0
   */
  async deposit(ether: string): Promise<ChamberResult<StateUpdate>> {
    const result = await this.rootChainContract.deposit({
      value: ethers.utils.parseEther(ether)
    })
    return await this._deposit(result)
  }

  /**
   * @dev require to approve before depositERC20
   * @param token token address
   * @param amount 
   */
  async depositERC20(token: Address, amount: number): Promise<ChamberResult<StateUpdate>> {
    const contract = new ethers.Contract(token, ERC20abi, this.httpProvider)
    const ERC20 = contract.connect(this.wallet)
    const resultApprove = await ERC20.approve(this.rootChainContract.address, amount)
    await resultApprove.wait()
    const result = await this.rootChainContract.depositERC20(
      token,
      amount)
    return await this._deposit(result)
  }

  async exit(tx: SignedTransactionWithProof): Promise<ChamberResult<Exit>> {
    const result = await this.rootChainContract.exit(
      tx.blkNum.mul(100),
      tx.getOutput().getSegment().toBigNumber(),
      tx.getTxBytes(),
      tx.getProofAsHex(),
      {
      value: constants.EXIT_BOND
    })
    await result.wait()
    const receipt = await this.httpProvider.getTransactionReceipt(result.hash)
    if(receipt.logs && receipt.logs[0]) {
      const logDesc = this.rootChainInterface.parseLog(receipt.logs[0])
      // delete exiting UTXO from UTXO list.
      const exitOrNull = this.handleExit(
        logDesc.values._exitId,
        logDesc.values._exitStateHash,
        logDesc.values._exitableAt,
        logDesc.values._segment
      )
      if(exitOrNull)
        return new ChamberOk(exitOrNull)
      else
        return new ChamberResultError(WalletErrorFactory.InvalidReceipt())
    } else {
      return new ChamberResultError(WalletErrorFactory.InvalidReceipt())
    }
  }

  async getExit(exitId: string) {
    return await this.rootChainContract.getExit(exitId)
  }
  
  async finalizeExit(exitId: string): Promise<ChamberResult<Exit>> {
    const exit = this.storage.getExit(exitId)
    if(exit == null) {
      return new ChamberResultError(WalletErrorFactory.ExitNotFound())
    }
    const result = await this.rootChainContract.finalizeExit(
      this.exitableRangeManager.getExitableEnd(exit.segment.start, exit.segment.end),
      exitId,
      exit.getStateBytes())
    await result.wait()
    this.storage.deleteExit(exit.getId())
    return new ChamberOk(exit)
  }

  /**
   * @ignore
   */
  private searchUtxo(
    to: Address,
    tokenId: number,
    amount: BigNumber,
    feeTo?: Address,
    fee?: BigNumber
  ): SignedTransaction | null {
    return TransferAlgorithm.searchUtxo(
      this.getUTXOArray(),
      this.getTargetBlockNumber(),
      this.predicatesManager.getNativePredicate('OwnershipPredicate'),
      to,
      tokenId,
      amount,
      feeTo,
      fee
    )
  }

  /**
   * searchMergable search mergable stateUpdates
   * @param targetBlockNumber is target block number
   */
  searchMergable(targetBlockNumber: BigNumber): StateUpdate | null {
    return DefragAlgorithm.searchMergable(
      this.getUTXOArray(),
      targetBlockNumber,
      this.predicatesManager.getNativePredicate('OwnershipPredicate'),
      this.wallet.address
    )
  }

  private checkSwapTx(swapTx: SignedTransaction) {
    const input = swapTx.getStateUpdates().filter(i => i.getOwner() == this.getAddress())[0]
    if(input) {
      return this.getUTXOArray().filter((_tx) => {
        // check input spent _tx which user has
        return _tx.getOutput().verifyDeprecation(
          swapTx.hash(),
          input,
          swapTx.getTransactionWitness(),
          this.predicatesManager
        )
      }).length > 0
    } else {
      return false
    }
  }

  /**
   * 
   * @param to The recipient address
   * @param tokenId tokenId
   * @param amountStr ex) '1.0'
   * @param feeTo The recipient address of fee
   * @param feeAmountStr ex) '0.01'
   * 
   * ### Example
   * 
   * sender
   * ```typescript
   * await wallet.transfer('0x....', '1.0')
   * ```
   * 
   * recipient 
   * ```typescript
   * wallet.on('receive', (e) => {
   *   console.log(e.tx)
   * })
   * ```
   */
  async transfer(
    to: Address,
    tokenId: number,
    amountStr: string,
    feeTo?: Address,
    feeAmountStr?: string
  ): Promise<ChamberResult<boolean>> {
    const amount = ethers.utils.bigNumberify(amountStr)
    const feeAmount = feeAmountStr ? ethers.utils.bigNumberify(feeAmountStr) : undefined
    const signedTx = this.searchUtxo(to, tokenId, amount, feeTo, feeAmount)
    if(signedTx == null) {
      return new ChamberResultError(WalletErrorFactory.TooLargeAmount())
    }
    signedTx.sign(this.wallet.privateKey)
    return await this.client.sendTransaction(signedTx)
  }

  /**
   * fast transfer method
   * @param to The recipient address
   * @param tokenId tokenId
   * @param amountStr ex) '1.0'
   * @param feeTo The recipient address of fee
   * @param feeAmountStr ex) '0.01'
   */
  sendFastTransferToMerchant(
    to: Address,
    tokenId: number,
    amountStr: string,
    feeTo?: Address,
    feeAmountStr?: string
  ): ChamberResult<boolean> {
    const amount = ethers.utils.bigNumberify(amountStr)
    const feeAmount = feeAmountStr ? ethers.utils.bigNumberify(feeAmountStr) : undefined
    const signedTx = this.searchUtxo(to, tokenId, amount, feeTo, feeAmount)
    if(signedTx == null) {
      return new ChamberResultError(WalletErrorFactory.TooLargeAmount())
    }
    signedTx.sign(this.wallet.privateKey)
    this.client.fastTransferToMerchant(to, signedTx)
    return new ChamberOk(true)
  }

  /**
   * @ignore
   * @param signedTx 
   */
  private async sendFastTransferToOperator(
    signedTx: SignedTransaction
  ): Promise<ChamberResult<FastTransferResponse>> {
    const fastTransferResponse = await this.client.fastTransfer(signedTx)
    // should check operator's signature: fastTransferResponse.sig
    // should count bandwidth: fastTransferResponse.tx
    if(fastTransferResponse.isOk()) {
      this.emit('receive', {tx: fastTransferResponse.ok().tx, isFast: true})
    }
    return fastTransferResponse
  }

  async sendTransaction(
    signedTx: SignedTransaction
  ): Promise<ChamberResult<boolean>> {
    signedTx.sign(this.wallet.privateKey)
    return await this.client.sendTransaction(signedTx)
  }

  async merge() {
    const targetBlock = ethers.utils.bigNumberify(this.getTargetBlockNumber())
    const tx = this.searchMergable(targetBlock)
    if(tx == null) {
      return new ChamberResultError(WalletErrorFactory.TooLargeAmount())
    }
    const signedTx = new SignedTransaction([tx])
    signedTx.sign(this.wallet.privateKey)
    return await this.client.sendTransaction(signedTx)
  }

  async swapRequest() {
    const swapRequest = DefragAlgorithm.makeSwapRequest(this.getUTXOArray())
    if(swapRequest) {
      return this.client.swapRequest(swapRequest)
    } else {
      return new ChamberResultError(WalletErrorFactory.SwapRequestError())
    }
  }

  async swapRequestRespond() {
    const targetBlock = ethers.utils.bigNumberify(this.getTargetBlockNumber())
    const ownershipPredicateAddress = this.predicatesManager.getNativePredicate('OwnershipPredicate')
    let swapRequests = await this.client.getSwapRequest()
    if(swapRequests.isError()) {
      return new ChamberResultError(WalletErrorFactory.SwapRequestError())
    }
    const tasks = swapRequests.ok().map((swapRequest) => {
      const neighbors = DefragAlgorithm.searchNeighbors(this.getUTXOArray(), swapRequest)
      const neighbor = neighbors[0]
      if(neighbor) {
        swapRequest.setTarget(neighbor)
        return swapRequest
      } else {
        return null
      }
    })
    .filter(swapRequest => !!swapRequest)
    .map(swapRequest => {
      if(swapRequest) {
        const tx = swapRequest.getSignedSwapTx(targetBlock, ownershipPredicateAddress)
        if(tx) {
          tx.sign(this.wallet.privateKey)
          return this.client.swapRequestResponse(swapRequest.getOwner(), tx)
        }
      }
      return Promise.resolve(new ChamberResultError<boolean>(WalletErrorFactory.SwapRequestError()))
    }).filter(p => !!p)
    return await Promise.all(tasks)
  }

  async sendSwap() {
    const swapTxResult = await this.client.getSwapRequestResponse(this.getAddress())
    if(swapTxResult.isOk()) {
      const swapTx = swapTxResult.ok()
      if(this.checkSwapTx(swapTx)) {
        swapTx.sign(this.wallet.privateKey)
        const result = await this.client.sendTransaction(swapTx)
        if(result.isOk()) {
          await this.client.clearSwapRequestResponse(this.getAddress())
        }
        return result
      }
    }
    return new ChamberResultError(WalletErrorFactory.SwapRequestError())
  }

  async startDefragmentation(handler: (message: string) => void) {
    handler('start defragmentation')
    const result = await this.merge()
    handler('merge phase is finished')
    if(result.isOk()) return
    await this.swapRequest()
    handler('swap request phase is finished')
    await this.swapRequestRespond()
    handler('swap respond phase is finished')
    await this.sendSwap()
    handler('all steps are finished')
  }

}

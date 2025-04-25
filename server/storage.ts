import { 
  InsertUser, User, BankInfo, InsertBankInfo, 
  Transaction, InsertTransaction, Product, InsertProduct, 
  Purchase, InsertPurchase, SocialLink, InsertSocialLink,
  Bank, InsertBank, Setting, InsertSetting,
  CarouselImage, InsertCarouselImage,
  DepositRequest, InsertDepositRequest,
  WithdrawalRequest, InsertWithdrawalRequest,
  BankAccountDetail,
  users, bankInfo, transactions, depositRequests, withdrawalRequests,
  products, purchases, socialLinks, banks, settings, carouselImages,
  bankAccountDetails
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPg from "connect-pg-simple";
import { db, pool } from "./db";
import { eq, desc, and, isNull, or, not } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // SQL direto
  execute(query: string, params?: any[]): Promise<any>;
  
  // Usuários
  getUser(id: number): Promise<User | undefined>;
  getUserByPhoneNumber(phoneNumber: string): Promise<User | undefined>;
  getUserByReferralCode(referralCode: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUserBalance(userId: number, newBalance: number): Promise<User>;
  updateUser(userId: number, updates: Partial<User>): Promise<User>;

  // Informações bancárias dos usuários
  getBankInfoByUserId(userId: number): Promise<BankInfo | undefined>;
  updateBankInfo(userId: number, bankInfo: InsertBankInfo): Promise<BankInfo>;
  createBankInfo(userId: number, bankInfo: InsertBankInfo): Promise<BankInfo>;
  deleteBankInfo(userId: number): Promise<void>;
  
  // Detalhes de contas bancárias (admin)
  getBankAccountDetails(): Promise<BankAccountDetail[]>;
  getBankAccountDetailsByBankId(bankId: number): Promise<BankAccountDetail | undefined>;

  // Transações (histórico)
  getTransactions(userId: number): Promise<Transaction[]>;
  getAllTransactions(): Promise<Transaction[]>;
  getTransaction(id: number): Promise<Transaction | undefined>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransactionStatus(id: string | number, status: string): Promise<Transaction>;
  
  // Solicitações de depósito
  createDepositRequest(request: InsertDepositRequest): Promise<DepositRequest>;
  getDepositRequests(): Promise<DepositRequest[]>;
  getDepositRequest(id: number): Promise<DepositRequest | undefined>;
  getDepositRequestByTransactionId(transactionId: string): Promise<DepositRequest | undefined>;
  approveDepositRequest(id: number): Promise<Transaction>;
  
  // Solicitações de saque
  createWithdrawalRequest(request: InsertWithdrawalRequest): Promise<WithdrawalRequest>;
  getWithdrawalRequests(): Promise<WithdrawalRequest[]>;
  getUserWithdrawalRequests(userId: number): Promise<WithdrawalRequest[]>;
  approveWithdrawalRequest(id: number, adminId: number): Promise<Transaction>;
  rejectWithdrawalRequest(id: number, adminId: number): Promise<Transaction>;

  // Produtos
  getProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product>;
  deleteProduct(id: number): Promise<void>;
  getActiveProducts(): Promise<Product[]>;

  // Compras
  getUserPurchases(userId: number): Promise<Purchase[]>;
  createPurchase(purchase: InsertPurchase): Promise<Purchase>;

  // Links Sociais
  getSocialLinks(): Promise<SocialLink[]>;
  getActiveSocialLinks(): Promise<SocialLink[]>;
  getSocialLink(id: number): Promise<SocialLink | undefined>;
  createSocialLink(link: InsertSocialLink): Promise<SocialLink>;
  updateSocialLink(id: number, link: Partial<InsertSocialLink>): Promise<SocialLink>;
  deleteSocialLink(id: number): Promise<void>;

  // Bancos
  getAllBanks(): Promise<Bank[]>;
  getBank(id: number): Promise<Bank | undefined>;
  createBank(bank: InsertBank): Promise<Bank>;
  updateBank(id: number, bank: Partial<InsertBank>): Promise<Bank>;
  deleteBank(id: number): Promise<boolean>;

  // Configurações
  getAllSettings(): Promise<Setting[]>;
  getSetting(key: string): Promise<Setting | undefined>;
  createSetting(setting: InsertSetting): Promise<Setting>;
  updateSetting(key: string, value: string): Promise<Setting>;

  // Carrossel
  getAllCarouselImages(): Promise<CarouselImage[]>;
  getActiveCarouselImages(): Promise<CarouselImage[]>;
  getCarouselImage(id: number): Promise<CarouselImage | undefined>;
  createCarouselImage(image: InsertCarouselImage): Promise<CarouselImage>;
  updateCarouselImage(id: number, image: Partial<InsertCarouselImage>): Promise<CarouselImage>;
  deleteCarouselImage(id: number): Promise<boolean>;

  sessionStore: session.Store;
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  // Método para executar consultas SQL diretas
  async execute(query: string, params?: any[]): Promise<any> {
    // Para a implementação MemStorage, vamos delegar para o pool do postgres
    // Isso garante que as chamadas diretas com SQL funcionem quando necessário
    return pool.query(query, params);
  }
  
  async getBankAccountDetails(): Promise<BankAccountDetail[]> {
    return Array.from(this.bankAccountDetails.values());
  }
  
  async getBankAccountDetailsByBankId(bankId: number): Promise<BankAccountDetail | undefined> {
    return Array.from(this.bankAccountDetails.values())
      .find(details => details.bankId === bankId);
  }
  private users: Map<number, User>;
  private bankInfo: Map<number, BankInfo & { userId: number }>;
  private transactions: Map<number, Transaction>;
  private depositRequests: Map<number, DepositRequest>;
  private withdrawalRequests: Map<number, WithdrawalRequest>;
  private products: Map<number, Product>;
  private purchases: Map<number, Purchase>;
  private socialLinks: Map<number, SocialLink>;
  private banks: Map<number, Bank>;
  private settings: Map<string, Setting>;
  private carouselImages: Map<number, CarouselImage>;
  private bankAccountDetails: Map<number, BankAccountDetail>;
  
  private currentUserId: number;
  private currentBankInfoId: number;
  private currentTransactionId: number;
  private currentDepositRequestId: number;
  private currentWithdrawalRequestId: number;
  private currentProductId: number;
  private currentPurchaseId: number;
  private currentSocialLinkId: number;
  private currentBankId: number;
  private currentSettingId: number;
  private currentCarouselImageId: number;
  
  sessionStore: session.Store;

  constructor() {
    // Initialize maps
    this.users = new Map();
    this.bankInfo = new Map();
    this.transactions = new Map();
    this.depositRequests = new Map();
    this.withdrawalRequests = new Map();
    this.products = new Map();
    this.purchases = new Map();
    this.socialLinks = new Map();
    this.banks = new Map();
    this.settings = new Map();
    this.carouselImages = new Map();
    this.bankAccountDetails = new Map();
    
    // Initialize IDs
    this.currentUserId = 1;
    this.currentBankInfoId = 1;
    this.currentTransactionId = 1;
    this.currentDepositRequestId = 1;
    this.currentWithdrawalRequestId = 1;
    this.currentProductId = 1;
    this.currentPurchaseId = 1;
    this.currentSocialLinkId = 1;
    this.currentBankId = 1;
    this.currentSettingId = 1;
    this.currentCarouselImageId = 1;
    
    // Initialize memory store for express sessions
    const MemoryStore = createMemoryStore(session);
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }
  
  async getUserByPhoneNumber(phoneNumber: string): Promise<User | undefined> {
    return Array.from(this.users.values())
      .find(user => user.phoneNumber === phoneNumber);
  }
  
  async getUserByReferralCode(referralCode: string): Promise<User | undefined> {
    return Array.from(this.users.values())
      .find(user => user.referralCode === referralCode);
  }
  
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const now = new Date();
    
    const user: User = {
      id,
      phoneNumber: insertUser.phoneNumber,
      password: insertUser.password,
      balance: 0,
      referralCode: insertUser.referralCode,
      referredBy: insertUser.referredBy || null,
      isAdmin: insertUser.isAdmin || false,
      level1Commission: 0,
      level2Commission: 0,
      level3Commission: 0,
      hasProduct: false,
      hasDeposited: false,
      createdAt: now,
      updatedAt: now,
    };
    
    this.users.set(id, user);
    return user;
  }

  async updateUserBalance(userId: number, newBalance: number): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error('Usuário não encontrado');
    }
    
    const updatedUser = {
      ...user,
      balance: newBalance,
      updatedAt: new Date(),
    };
    
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  // Bank info methods
  async getBankInfoByUserId(userId: number): Promise<BankInfo | undefined> {
    const bankInfoEntry = Array.from(this.bankInfo.values())
      .find(info => info.userId === userId);
    
    if (!bankInfoEntry) return undefined;
    
    const { userId: _, ...bankInfo } = bankInfoEntry;
    return bankInfo;
  }
  
  async createBankInfo(userId: number, bankInfoData: InsertBankInfo): Promise<BankInfo> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error('Usuário não encontrado');
    }
    
    // Verificar se já existe informação bancária para este usuário
    const existingBankInfo = Array.from(this.bankInfo.entries())
      .find(([_, info]) => info.userId === userId);
    
    if (existingBankInfo) {
      // Se já existe, atualize ao invés de criar uma nova
      return this.updateBankInfo(userId, bankInfoData);
    }
    
    const id = this.currentBankInfoId++;
    const now = new Date();
    
    const bankInfoEntry = {
      id,
      userId,
      bank: bankInfoData.bank,
      ownerName: bankInfoData.ownerName,
      accountNumber: bankInfoData.accountNumber,
      createdAt: now,
      updatedAt: now,
    };
    
    this.bankInfo.set(id, bankInfoEntry);
    
    const { userId: _, ...bankInfo } = bankInfoEntry;
    return bankInfo;
  }
  
  async updateBankInfo(userId: number, bankInfoData: InsertBankInfo): Promise<BankInfo> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error('Usuário não encontrado');
    }
    
    const existingBankInfo = Array.from(this.bankInfo.entries())
      .find(([_, info]) => info.userId === userId);
    
    if (!existingBankInfo) {
      // Se não existe, crie um novo ao invés de atualizar
      return this.createBankInfo(userId, bankInfoData);
    }
    
    const [existingId, existing] = existingBankInfo;
    
    const updated = {
      ...existing,
      bank: bankInfoData.bank,
      ownerName: bankInfoData.ownerName,
      accountNumber: bankInfoData.accountNumber,
      updatedAt: new Date(),
    };
    
    this.bankInfo.set(existingId, updated);
    
    const { userId: _, ...bankInfo } = updated;
    return bankInfo;
  }
  
  async deleteBankInfo(userId: number): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error('Usuário não encontrado');
    }
    
    const existingBankInfo = Array.from(this.bankInfo.entries())
      .find(([_, info]) => info.userId === userId);
    
    if (!existingBankInfo) {
      return; // Nada para excluir
    }
    
    this.bankInfo.delete(existingBankInfo[0]);
  }

  // Transaction methods
  async getTransactions(userId: number): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .filter((tx) => tx.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getAllTransactions(): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getTransaction(id: number): Promise<Transaction | undefined> {
    return this.transactions.get(id);
  }

  async getTransactionByTransactionId(transactionId: string): Promise<Transaction | undefined> {
    return Array.from(this.transactions.values())
      .find(transaction => transaction.transactionId === transactionId);
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const id = this.currentTransactionId++;
    const now = new Date();

    // VERIFICAÇÃO IMPORTANTE: Checar se já existe uma transação com esse transactionId
    // para evitar duplicações durante processamento paralelo ou repetido
    if (transaction.transactionId) {
      const existingTransaction = await this.getTransactionByTransactionId(transaction.transactionId);
      if (existingTransaction) {
        console.log(`TRANSACT >>> Transação com ID ${transaction.transactionId} já existe, retornando existente`);
        return existingTransaction;
      }
    }

    const newTransaction: Transaction = {
      id,
      userId: transaction.userId,
      type: transaction.type,
      amount: transaction.amount,
      status: transaction.status || 'pending',  // ADICIONADO: status default
      bankAccount: transaction.bankAccount === undefined ? null : transaction.bankAccount,
      bankName: transaction.bankName === undefined ? null : transaction.bankName,
      receipt: transaction.receipt === undefined ? null : transaction.receipt,
      transactionId: transaction.transactionId === undefined ? null : transaction.transactionId,
      createdAt: now
    };

    // Log detalhado ao criar transações para facilitar depuração
    console.log(`TRANSACT >>> Nova transação criada: ID=${id}, TransactionID=${transaction.transactionId || 'null'}, Tipo=${transaction.type}, Valor=${transaction.amount}, Status=${newTransaction.status}`);

    this.transactions.set(id, newTransaction);
    return newTransaction;
  }

  async updateTransactionStatus(id: string | number, status: string): Promise<Transaction> {
    console.log(`\n=== TRANSACT >>> Atualizando transação ${id} para ${status} ===\n`);
    
    // CORREÇÃO: Verificar se o parâmetro é numérico (id interno) ou string (transactionId externo)
    let transaction: Transaction | undefined;
    
    // Tentar primeiro como id interno (conversão para número)
    const numericId = typeof id === 'number' ? id : parseInt(id as string);
    if (!isNaN(numericId)) {
      console.log(`TRANSACT >>> Buscando transação por ID interno: ${numericId}`);
      transaction = this.transactions.get(numericId);
    }
    
    // Se não encontrou por ID interno, busca por transactionId
    if (!transaction && typeof id === 'string') {
      console.log(`TRANSACT >>> Buscando transação por transactionId: ${id}`);
      transaction = Array.from(this.transactions.values())
        .find(t => t.transactionId === id);
    
      // BUSCAR TAMBÉM EM DEPOSIT REQUESTS (FIX CRÍTICO)
      if (!transaction) {
        console.log(`TRANSACT >>> Transação não encontrada, buscando em solicitações de depósito...`);
        const depositRequest = await this.getDepositRequestByTransactionId(id);
        
        if (depositRequest) {
          console.log(`TRANSACT >>> Encontrada solicitação de depósito com ID ${depositRequest.id}`);
          
          // Criar transação a partir da solicitação de depósito
          transaction = await this.createTransaction({
            userId: depositRequest.userId,
            type: 'deposit',
            amount: depositRequest.amount,
            bankName: depositRequest.bankName,
            receipt: depositRequest.receipt,
            bankAccount: null,
            transactionId: depositRequest.transactionId,
            status: 'pending' // Adicionado o status que faltava
          });
          
          console.log(`TRANSACT >>> Transação criada a partir da solicitação de depósito: ID=${transaction.id}`);
        }
      }
    }
      
    if (!transaction) {
      // Log de depuração: mostrar todas as transações e seus IDs para diagnóstico
      console.error(`TRANSACT >>> Transação ${id} não encontrada`);
      console.log('TRANSACT >>> Transações disponíveis:', 
        Array.from(this.transactions.entries())
          .map(([tId, t]) => ({ id: tId, transactionId: t.transactionId }))
      );
      
      // Exibir solicitações de depósito disponíveis
      console.log('TRANSACT >>> Solicitações de depósito disponíveis:', 
        Array.from(this.depositRequests.entries())
          .map(([dId, d]) => ({ id: dId, transactionId: d.transactionId }))
      );
      
      // ÚLTIMA TENTATIVA - TENTAR APROVAR DIRETAMENTE PELO DEPÓSITO (FIX CRUCIAL)
      if (typeof id === 'string') {
        console.log(`TRANSACT >>> ÚLTIMA TENTATIVA: Buscando e aprovando depósito pelo transactionId ${id}`);
        const depositRequest = Array.from(this.depositRequests.values())
          .find(d => d.transactionId === id);
          
        if (depositRequest && status === 'completed') {
          console.log(`TRANSACT >>> Encontrado depósito pendente com ID ${depositRequest.id}, aprovando diretamente...`);
          return this.approveDepositRequest(depositRequest.id);
        }
      }
      
      throw new Error(`Transação ${id} não encontrada`);
    }
    
    console.log(`TRANSACT >>> Transação encontrada:`, transaction);

    // Se for um depósito sendo completado, atualizar o saldo do usuário
    if (status === 'completed' && transaction.type === 'deposit') {
      const user = await this.getUser(transaction.userId);
      if (!user) {
        throw new Error(`Usuário ${transaction.userId} não encontrado`);
      }

      console.log(`TRANSACT >>> Atualizando saldo do usuário ${user.phoneNumber}`);
      console.log(`TRANSACT >>> Saldo atual: ${user.balance}, Depósito: ${transaction.amount}`);
      
      const newBalance = user.balance + transaction.amount;
      await this.updateUserBalance(user.id, newBalance);
      
      console.log(`TRANSACT >>> Novo saldo: ${newBalance}`);
      
      // Marcar que o usuário já realizou depósito
      if (!user.hasDeposited) {
        await this.updateUser(user.id, { hasDeposited: true });
        console.log(`TRANSACT >>> Usuário marcado como tendo realizado depósito`);
      }
    }

    return transaction;
  }
  
  // Métodos para solicitações de depósito
  async createDepositRequest(request: InsertDepositRequest): Promise<DepositRequest> {
    // Verificar se o usuário existe
    const user = await this.getUser(request.userId);
    if (!user) {
      throw new Error('Usuário não encontrado');
    }
    
    // Gerar ID de depósito
    const id = this.currentDepositRequestId++;
    const now = new Date();
    
    // Criar solicitação de depósito
    const depositRequest: DepositRequest = {
      id,
      userId: request.userId,
      amount: request.amount,
      transactionId: request.transactionId,
      bankName: request.bankName || null,
      receipt: request.receipt || null,
      createdAt: now
    };
    
    // Salvar solicitação
    this.depositRequests.set(id, depositRequest);
    console.log(`DEPOSIT >>> Nova solicitação de depósito criada: ID=${id}, Valor=${request.amount}, TransactionID=${request.transactionId}`);
    
    return depositRequest;
  }
  
  async getDepositRequests(): Promise<DepositRequest[]> {
    const requests = Array.from(this.depositRequests.values());
    console.log('Recuperando solicitações de depósito:', requests);
    return requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  
  async getDepositRequest(id: number): Promise<DepositRequest | undefined> {
    return this.depositRequests.get(id);
  }
  
  async getDepositRequestByTransactionId(transactionId: string): Promise<DepositRequest | undefined> {
    return Array.from(this.depositRequests.values())
      .find(request => request.transactionId === transactionId);
  }
  
  async approveDepositRequest(id: number): Promise<Transaction> {
    // Obter solicitação de depósito
    const depositRequest = this.depositRequests.get(id);
    if (!depositRequest) {
      throw new Error(`Solicitação de depósito ${id} não encontrada`);
    }
    
    // Verificar usuário
    const user = await this.getUser(depositRequest.userId);
    if (!user) {
      throw new Error(`Usuário ${depositRequest.userId} não encontrado`);
    }
    
    console.log(`\n=== DEPOSIT >>> PROCESSANDO DEPÓSITO ID=${id} ===`);
    console.log(`DEPOSIT >>> Usuário: ${user.phoneNumber}, Valor: ${depositRequest.amount} KZ`);
    console.log(`DEPOSIT >>> Saldo antes: ${user.balance}`);
    
    try {
      // SEGURANÇA: Verificar se o ID da transação está presente
      if (!depositRequest.transactionId) {
        console.warn(`DEPOSIT >>> ALERTA: Depósito sem ID de transação`);
      } else {
        console.log(`DEPOSIT >>> ID da transação: ${depositRequest.transactionId}`);
        
        // VERIFICAÇÃO 1: Checar se já existe uma transação com esse ID
        const existingTransaction = await this.getTransactionByTransactionId(depositRequest.transactionId);
        
        // Se já existe uma transação, evitar processamento duplicado
        if (existingTransaction) {
          console.log(`DEPOSIT >>> ALERTA: Transação ${depositRequest.transactionId} já existe no sistema`);
          console.log(`DEPOSIT >>> Evitando duplicação de crédito`);
          console.log(`DEPOSIT >>> ID da transação existente: ${existingTransaction.id}`);
          console.log(`DEPOSIT >>> Status: ${existingTransaction.status}`);
          console.log(`DEPOSIT >>> Valor: ${existingTransaction.amount}`);
          
          // Remover a solicitação de depósito pendente para evitar reprocessamento
          this.depositRequests.delete(id);
          
          console.log(`DEPOSIT >>> Solicitação removida para evitar duplicação`);
          console.log(`=== DEPOSIT >>> FIM DO PROCESSAMENTO (PREVENÇÃO DE DUPLICAÇÃO) ===\n`);
          
          return existingTransaction;
        }
      }
    
      // DIAGNÓSTICO: Obter saldo do usuário mais recente
      const userBefore = await this.getUser(depositRequest.userId);
      const oldBalance = userBefore ? userBefore.balance : user.balance;
      
      // Atualizar saldo do usuário
      const newBalance = oldBalance + depositRequest.amount;
      await this.updateUserBalance(depositRequest.userId, newBalance);
      
      // Verificar se a atualização do saldo foi bem-sucedida
      const userAfter = await this.getUser(depositRequest.userId);
      if (!userAfter) {
        throw new Error(`Usuário ${depositRequest.userId} não encontrado após atualização`);
      }
      
      console.log(`DEPOSIT >>> Saldo após a operação: ${userAfter.balance}`);
      
      if (Math.abs(userAfter.balance - newBalance) > 0.01) {
        console.error(`DEPOSIT >>> ERRO CRÍTICO: Saldo não foi atualizado corretamente!`);
        console.error(`DEPOSIT >>> Saldo esperado: ${newBalance}, Saldo atual: ${userAfter.balance}`);
        
        // Tentar novamente com força bruta
        console.log(`DEPOSIT >>> Tentando atualizar novamente o saldo...`);
        await this.updateUserBalance(userAfter.id, newBalance);
      }
      
      // Marcar que o usuário já realizou depósito
      if (!userAfter.hasDeposited) {
        console.log(`DEPOSIT >>> Marcando usuário como tendo realizado depósito`);
        await this.updateUser(userAfter.id, { hasDeposited: true });
      }
      
      // VERIFICAÇÃO 2: Verificar novamente se já foi criada uma transação
      // (segurança adicional para casos de concorrência durante o processamento)
      if (depositRequest.transactionId) {
        const recentlyCreatedTransaction = await this.getTransactionByTransactionId(depositRequest.transactionId);
        if (recentlyCreatedTransaction) {
          console.log(`DEPOSIT >>> ALERTA: Transação ${depositRequest.transactionId} foi criada durante o processamento`);
          
          // Remover a solicitação de depósito pendente
          this.depositRequests.delete(id);
          
          return recentlyCreatedTransaction;
        }
      }
      
      // Registrar uma transação completada no histórico
      const transaction = await this.createTransaction({
        userId: depositRequest.userId,
        type: 'deposit',
        amount: depositRequest.amount,
        bankName: depositRequest.bankName,
        receipt: depositRequest.receipt,
        bankAccount: null,
        transactionId: depositRequest.transactionId,
        status: 'completed'  // Marcar como completada imediatamente
      });
      
      // Remover a solicitação de depósito pendente
      this.depositRequests.delete(id);
      
      // Verificação final do saldo
      const finalUser = await this.getUser(depositRequest.userId);
      console.log(`DEPOSIT >>> Verificação final - Saldo: ${finalUser?.balance || 'usuário não encontrado'}`);
      
      console.log(`DEPOSIT >>> Depósito processado com sucesso`);
      console.log(`DEPOSIT >>> Transação registrada: ID=${transaction.id}`);
      console.log(`=== DEPOSIT >>> FIM DO PROCESSAMENTO ===\n`);
      
      return transaction;
    } catch (error) {
      console.error(`DEPOSIT >>> ERRO: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  // Métodos para solicitações de saque
  async createWithdrawalRequest(request: InsertWithdrawalRequest): Promise<WithdrawalRequest> {
    // Verificar se o usuário existe
    const user = await this.getUser(request.userId);
    if (!user) {
      throw new Error('Usuário não encontrado');
    }
    
    // Verificar se o usuário tem saldo suficiente
    if (user.balance < request.amount) {
      throw new Error(`Saldo insuficiente. Disponível: KZ ${user.balance}, Solicitado: KZ ${request.amount}`);
    }
    
    // Verificar se o usuário tem um produto ativo
    if (!user.hasProduct) {
      throw new Error('É necessário ter um produto ativo para realizar saques');
    }
    
    // Verificar se o usuário já fez depósito
    if (!user.hasDeposited) {
      throw new Error('É necessário ter realizado pelo menos um depósito para sacar');
    }
    
    // Verificar horário de Angola (UTC+1)
    const now = new Date();
    const angolaTime = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Luanda" }));
    const angolaHour = angolaTime.getHours();
    const angolaDay = angolaTime.getDay();
    
    // Verificar se é dia útil (segunda a sexta)
    if (angolaDay === 0 || angolaDay === 6) {
      throw new Error('Saques só podem ser solicitados em dias úteis (segunda a sexta-feira)');
    }
    
    // Verificar se está dentro do horário comercial (10h às 15h)
    if (angolaHour < 10 || angolaHour >= 15) {
      throw new Error('Saques só podem ser solicitados das 10h às 15h (horário de Angola)');
    }
    
    // Bloquear o valor no saldo do usuário
    const newBalance = user.balance - request.amount;
    await this.updateUserBalance(user.id, newBalance);
    
    // Gerar ID de saque
    const id = this.currentWithdrawalRequestId++;
    
    // Criar solicitação de saque
    const withdrawalRequest: WithdrawalRequest = {
      id,
      userId: request.userId,
      amount: request.amount,
      status: 'requested',
      bankAccount: request.bankAccount,
      bankName: request.bankName,
      ownerName: request.ownerName,
      createdAt: now,
      processedAt: null,
      processedBy: null
    };
    
    // Salvar solicitação
    this.withdrawalRequests.set(id, withdrawalRequest);
    console.log(`WITHDRAWAL >>> Nova solicitação de saque criada: ID=${id}, Valor=${request.amount}, Usuário=${request.userId}`);
    
    return withdrawalRequest;
  }
  
  async getWithdrawalRequests(): Promise<WithdrawalRequest[]> {
    return Array.from(this.withdrawalRequests.values())
      .filter(req => req.status === 'requested')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  
  async getUserWithdrawalRequests(userId: number): Promise<WithdrawalRequest[]> {
    return Array.from(this.withdrawalRequests.values())
      .filter(req => req.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  
  async approveWithdrawalRequest(id: number, adminId: number): Promise<Transaction> {
    // Obter solicitação de saque
    const withdrawalRequest = this.withdrawalRequests.get(id);
    if (!withdrawalRequest) {
      throw new Error(`Solicitação de saque ${id} não encontrada`);
    }
    
    // Verificar se a solicitação está pendente
    if (withdrawalRequest.status !== 'requested') {
      throw new Error(`Solicitação de saque ${id} já foi processada como '${withdrawalRequest.status}'`);
    }
    
    console.log(`\n=== WITHDRAWAL >>> APROVANDO SAQUE ID=${id} ===`);
    
    try {
      // Atualizar a solicitação
      const updatedRequest: WithdrawalRequest = {
        ...withdrawalRequest,
        status: 'approved',
        processedAt: new Date(),
        processedBy: adminId
      };
      
      this.withdrawalRequests.set(id, updatedRequest);
      
      // Registrar transação no histórico
      const transaction = await this.createTransaction({
        userId: withdrawalRequest.userId,
        type: 'withdrawal',
        amount: withdrawalRequest.amount,
        bankAccount: withdrawalRequest.bankAccount,
        bankName: withdrawalRequest.bankName,
        receipt: null,
        transactionId: null,
        status: 'completed' // Definir como completado imediatamente
      });
      
      console.log(`WITHDRAWAL >>> Saque aprovado com sucesso`);
      console.log(`WITHDRAWAL >>> Transação registrada: ID=${transaction.id}`);
      console.log(`=== WITHDRAWAL >>> FIM DO PROCESSAMENTO ===\n`);
      
      return transaction;
    } catch (error) {
      console.error(`WITHDRAWAL >>> ERRO: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  async rejectWithdrawalRequest(id: number, adminId: number): Promise<Transaction> {
    // Obter solicitação de saque
    const withdrawalRequest = this.withdrawalRequests.get(id);
    if (!withdrawalRequest) {
      throw new Error(`Solicitação de saque ${id} não encontrada`);
    }
    
    // Verificar se a solicitação está pendente
    if (withdrawalRequest.status !== 'requested') {
      throw new Error(`Solicitação de saque ${id} já foi processada como '${withdrawalRequest.status}'`);
    }
    
    console.log(`\n=== WITHDRAWAL >>> REJEITANDO SAQUE ID=${id} ===`);
    
    try {
      // Verificar usuário
      const user = await this.getUser(withdrawalRequest.userId);
      if (!user) {
        throw new Error(`Usuário ${withdrawalRequest.userId} não encontrado`);
      }
      
      // Aplicar taxa de 20% e devolver o restante para o saldo do usuário
      const penaltyFee = withdrawalRequest.amount * 0.2;
      const amountToReturn = withdrawalRequest.amount - penaltyFee;
      
      console.log(`WITHDRAWAL >>> Usuário: ${user.phoneNumber}, Valor rejeitado: ${withdrawalRequest.amount} KZ`);
      console.log(`WITHDRAWAL >>> Taxa (20%): ${penaltyFee} KZ, Valor a devolver: ${amountToReturn} KZ`);
      
      // Devolver o valor (menos a taxa) ao saldo do usuário
      const newBalance = user.balance + amountToReturn;
      await this.updateUserBalance(user.id, newBalance);
      
      // Atualizar a solicitação
      const updatedRequest: WithdrawalRequest = {
        ...withdrawalRequest,
        status: 'rejected',
        processedAt: new Date(),
        processedBy: adminId
      };
      
      this.withdrawalRequests.set(id, updatedRequest);
      
      // Registrar transação no histórico
      const transaction = await this.createTransaction({
        userId: withdrawalRequest.userId,
        type: 'withdrawal',
        amount: -amountToReturn, // Valor negativo para indicar devolução
        bankAccount: withdrawalRequest.bankAccount,
        bankName: withdrawalRequest.bankName,
        receipt: null,
        transactionId: null,
        status: 'failed' // Definir como falhou mas com cor verde (devolução)
      });
      
      console.log(`WITHDRAWAL >>> Saque rejeitado com sucesso`);
      console.log(`WITHDRAWAL >>> Taxa de ${penaltyFee} KZ aplicada`);
      console.log(`WITHDRAWAL >>> Transação registrada: ID=${transaction.id}`);
      console.log(`=== WITHDRAWAL >>> FIM DO PROCESSAMENTO ===\n`);
      
      return transaction;
    } catch (error) {
      console.error(`WITHDRAWAL >>> ERRO: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  // Product methods
  async getProducts(): Promise<Product[]> {
    return Array.from(this.products.values())
      .sort((a, b) => a.price - b.price);
  }

  async getActiveProducts(): Promise<Product[]> {
    return Array.from(this.products.values())
      .filter(product => product.active)
      .sort((a, b) => a.price - b.price);
  }

  async getProduct(id: number): Promise<Product | undefined> {
    return this.products.get(id);
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const id = this.currentProductId++;
    const now = new Date();

    const newProduct: Product = {
      id,
      ...product,
      createdAt: now,
      updatedAt: now,
    };

    this.products.set(id, newProduct);
    return newProduct;
  }

  async updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product> {
    const existingProduct = this.products.get(id);
    if (!existingProduct) {
      throw new Error('Produto não encontrado');
    }

    const updatedProduct = {
      ...existingProduct,
      ...product,
      updatedAt: new Date(),
    };

    this.products.set(id, updatedProduct);
    return updatedProduct;
  }

  async deleteProduct(id: number): Promise<void> {
    if (!this.products.has(id)) {
      throw new Error('Produto não encontrado');
    }

    this.products.delete(id);
  }

  // Purchase methods
  async getUserPurchases(userId: number): Promise<Purchase[]> {
    return Array.from(this.purchases.values())
      .filter(purchase => purchase.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createPurchase(purchase: InsertPurchase): Promise<Purchase> {
    const id = this.currentPurchaseId++;
    const now = new Date();

    const newPurchase: Purchase = {
      id,
      ...purchase,
      createdAt: now,
    };

    this.purchases.set(id, newPurchase);

    // Atualizar o usuário para indicar que ele possui um produto
    const user = await this.getUser(purchase.userId);
    if (user) {
      await this.updateUser(purchase.userId, { hasProduct: true });
    }

    return newPurchase;
  }

  // Método para atualizar propriedades do usuário
  async updateUser(userId: number, updates: Partial<User>): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    const updatedUser = {
      ...user,
      ...updates,
      updatedAt: new Date(),
    };

    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  // Links Sociais
  async getSocialLinks(): Promise<SocialLink[]> {
    return Array.from(this.socialLinks.values())
      .sort((a, b) => a.id - b.id);
  }

  async getActiveSocialLinks(): Promise<SocialLink[]> {
    return Array.from(this.socialLinks.values())
      .filter(link => link.active)
      .sort((a, b) => a.id - b.id);
  }

  async getSocialLink(id: number): Promise<SocialLink | undefined> {
    return this.socialLinks.get(id);
  }

  async createSocialLink(link: InsertSocialLink): Promise<SocialLink> {
    const id = this.currentSocialLinkId++;
    const now = new Date();

    const newLink: SocialLink = {
      id,
      ...link,
      createdAt: now,
      updatedAt: now,
    };

    this.socialLinks.set(id, newLink);
    return newLink;
  }

  async updateSocialLink(id: number, link: Partial<InsertSocialLink>): Promise<SocialLink> {
    const existingLink = this.socialLinks.get(id);
    if (!existingLink) {
      throw new Error('Link social não encontrado');
    }

    const updatedLink = {
      ...existingLink,
      ...link,
      updatedAt: new Date(),
    };

    this.socialLinks.set(id, updatedLink);
    return updatedLink;
  }

  async deleteSocialLink(id: number): Promise<void> {
    if (!this.socialLinks.has(id)) {
      throw new Error('Link social não encontrado');
    }

    this.socialLinks.delete(id);
  }

  // Bancos
  async getAllBanks(): Promise<Bank[]> {
    return Array.from(this.banks.values())
      .sort((a, b) => a.id - b.id);
  }

  async getBank(id: number): Promise<Bank | undefined> {
    return this.banks.get(id);
  }

  async createBank(bank: InsertBank): Promise<Bank> {
    const id = this.currentBankId++;
    const now = new Date();

    const newBank: Bank = {
      id,
      ...bank,
      createdAt: now,
      updatedAt: now,
    };

    this.banks.set(id, newBank);
    return newBank;
  }

  async updateBank(id: number, bank: Partial<InsertBank>): Promise<Bank> {
    const existingBank = this.banks.get(id);
    if (!existingBank) {
      throw new Error('Banco não encontrado');
    }

    const updatedBank = {
      ...existingBank,
      ...bank,
      updatedAt: new Date(),
    };

    this.banks.set(id, updatedBank);
    return updatedBank;
  }

  async deleteBank(id: number): Promise<boolean> {
    if (!this.banks.has(id)) {
      throw new Error('Banco não encontrado');
    }

    return this.banks.delete(id);
  }

  // Configurações
  async getAllSettings(): Promise<Setting[]> {
    return Array.from(this.settings.values())
      .sort((a, b) => a.key.localeCompare(b.key));
  }

  async getSetting(key: string): Promise<Setting | undefined> {
    return Array.from(this.settings.values()).find(s => s.key === key);
  }

  async createSetting(setting: InsertSetting): Promise<Setting> {
    const id = this.currentSettingId++;
    const now = new Date();

    const newSetting: Setting = {
      id,
      ...setting,
      createdAt: now,
      updatedAt: now,
    };

    this.settings.set(setting.key, newSetting);
    return newSetting;
  }

  async updateSetting(key: string, value: string): Promise<Setting> {
    const existingSetting = Array.from(this.settings.values())
      .find(s => s.key === key);

    if (!existingSetting) {
      throw new Error('Configuração não encontrada');
    }

    const updatedSetting = {
      ...existingSetting,
      value,
      updatedAt: new Date(),
    };

    this.settings.set(key, updatedSetting);
    return updatedSetting;
  }

  // Carrossel
  async getAllCarouselImages(): Promise<CarouselImage[]> {
    return Array.from(this.carouselImages.values())
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  async getActiveCarouselImages(): Promise<CarouselImage[]> {
    return Array.from(this.carouselImages.values())
      .filter(img => img.active)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  async getCarouselImage(id: number): Promise<CarouselImage | undefined> {
    return this.carouselImages.get(id);
  }

  async createCarouselImage(image: InsertCarouselImage): Promise<CarouselImage> {
    const id = this.currentCarouselImageId++;
    const now = new Date();

    const newImage: CarouselImage = {
      id,
      ...image,
      createdAt: now,
      updatedAt: now,
    };

    this.carouselImages.set(id, newImage);
    return newImage;
  }

  async updateCarouselImage(id: number, image: Partial<InsertCarouselImage>): Promise<CarouselImage> {
    const existingImage = this.carouselImages.get(id);
    if (!existingImage) {
      throw new Error('Imagem do carrossel não encontrada');
    }

    const updatedImage = {
      ...existingImage,
      ...image,
      updatedAt: new Date(),
    };

    this.carouselImages.set(id, updatedImage);
    return updatedImage;
  }

  async deleteCarouselImage(id: number): Promise<boolean> {
    if (!this.carouselImages.has(id)) {
      throw new Error('Imagem do carrossel não encontrada');
    }

    return this.carouselImages.delete(id);
  }
}

// Export storage instance
// Database storage implementation
export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;
  
  // Método para executar consultas SQL diretas
  async execute(query: string, params?: any[]): Promise<any> {
    return pool.query(query, params);
  }

  constructor() {
    const PostgresSessionStore = connectPg(session);
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }
  
  async getBankAccountDetails(): Promise<BankAccountDetail[]> {
    const accounts = await db.select().from(bankAccountDetails);
    const result: BankAccountDetail[] = [];
    
    for (const account of accounts) {
      const [bankInfo] = await db.select().from(banks).where(eq(banks.id, account.bankId));
      result.push({
        ...account,
        bank: bankInfo || null
      });
    }
    
    return result;
  }
  
  async getBankAccountDetailsByBankId(bankId: number): Promise<BankAccountDetail | undefined> {
    const [account] = await db.select().from(bankAccountDetails).where(eq(bankAccountDetails.bankId, bankId));
    
    if (!account) {
      return undefined;
    }
    
    const [bankInfo] = await db.select().from(banks).where(eq(banks.id, account.bankId));
    
    return {
      ...account,
      bank: bankInfo || null
    };
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    
    if (user) {
      // Carregar informações bancárias se existirem
      const bankInfoData = await this.getBankInfoByUserId(user.id);
      if (bankInfoData) {
        return { ...user, bankInfo: bankInfoData };
      }
    }
    
    return user;
  }

  async getUserByPhoneNumber(phoneNumber: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.phoneNumber, phoneNumber));

    return user;
  }

  async getUserByReferralCode(referralCode: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.referralCode, referralCode));

    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();

    return user;
  }

  async updateUserBalance(userId: number, newBalance: number): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ 
        balance: newBalance,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      throw new Error('Usuário não encontrado');
    }

    return updatedUser;
  }

  async updateUser(userId: number, updates: Partial<User>): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ 
        ...updates,
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      throw new Error('Usuário não encontrado');
    }

    return updatedUser;
  }

  // Bank info methods
  async getBankInfoByUserId(userId: number): Promise<BankInfo | undefined> {
    const [info] = await db
      .select({
        bank: bankInfo.bank,
        ownerName: bankInfo.ownerName,
        accountNumber: bankInfo.accountNumber
      })
      .from(bankInfo)
      .where(eq(bankInfo.userId, userId));

    return info;
  }

  async createBankInfo(userId: number, info: InsertBankInfo): Promise<BankInfo> {
    // Primeiro verifica se já existe uma informação bancária para este usuário
    const existing = await this.getBankInfoByUserId(userId);
    
    if (existing) {
      // Se existir, atualiza ao invés de criar
      return this.updateBankInfo(userId, info);
    }
    
    const [createdInfo] = await db
      .insert(bankInfo)
      .values({
        userId,
        bank: info.bank,
        ownerName: info.ownerName,
        accountNumber: info.accountNumber
      })
      .returning({
        bank: bankInfo.bank,
        ownerName: bankInfo.ownerName,
        accountNumber: bankInfo.accountNumber
      });

    return createdInfo;
  }

  async updateBankInfo(userId: number, info: InsertBankInfo): Promise<BankInfo> {
    const [updatedInfo] = await db
      .update(bankInfo)
      .set({
        bank: info.bank,
        ownerName: info.ownerName,
        accountNumber: info.accountNumber,
        updatedAt: new Date()
      })
      .where(eq(bankInfo.userId, userId))
      .returning({
        bank: bankInfo.bank,
        ownerName: bankInfo.ownerName,
        accountNumber: bankInfo.accountNumber
      });

    if (!updatedInfo) {
      // Se não existir um registro para atualizar, cria um novo
      return this.createBankInfo(userId, info);
    }

    return updatedInfo;
  }

  async deleteBankInfo(userId: number): Promise<void> {
    await db
      .delete(bankInfo)
      .where(eq(bankInfo.userId, userId));
  }

  // Transaction methods
  async getTransactions(userId: number): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt));
  }

  async getAllTransactions(): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .orderBy(desc(transactions.createdAt));
  }

  async getTransaction(id: number): Promise<Transaction | undefined> {
    const [transaction] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, id));

    return transaction;
  }

  async getTransactionByTransactionId(transactionId: string): Promise<Transaction | undefined> {
    if (!transactionId) return undefined;
    
    const [transaction] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.transactionId, transactionId));

    return transaction;
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    // VERIFICAÇÃO IMPORTANTE: Checar se já existe uma transação com esse transactionId
    // para evitar duplicações durante processamento paralelo ou repetido
    if (transaction.transactionId) {
      const existingTransaction = await this.getTransactionByTransactionId(transaction.transactionId);
      if (existingTransaction) {
        console.log(`DB >>> Transação com ID ${transaction.transactionId} já existe, retornando existente`);
        return existingTransaction;
      }
    }
    
    const [newTransaction] = await db
      .insert(transactions)
      .values(transaction)
      .returning();

    return newTransaction;
  }

  async updateTransactionStatus(id: string | number, status: string): Promise<Transaction> {
    let query;
    if (typeof id === 'string') {
      // Se o ID for uma string, assume que é um transactionId
      query = eq(transactions.transactionId, id);
    } else {
      // Se o ID for um número, assume que é o ID primário
      query = eq(transactions.id, id);
    }

    const [updatedTransaction] = await db
      .update(transactions)
      .set({ status })
      .where(query)
      .returning();

    if (!updatedTransaction) {
      throw new Error('Transação não encontrada');
    }

    return updatedTransaction;
  }

  // Deposit request methods
  async createDepositRequest(request: InsertDepositRequest): Promise<DepositRequest> {
    const [newRequest] = await db
      .insert(depositRequests)
      .values(request)
      .returning();

    return newRequest;
  }

  async getDepositRequests(): Promise<DepositRequest[]> {
    return await db
      .select()
      .from(depositRequests)
      .orderBy(desc(depositRequests.createdAt));
  }

  async getDepositRequest(id: number): Promise<DepositRequest | undefined> {
    const [request] = await db
      .select()
      .from(depositRequests)
      .where(eq(depositRequests.id, id));

    return request;
  }

  async getDepositRequestByTransactionId(transactionId: string): Promise<DepositRequest | undefined> {
    const [request] = await db
      .select()
      .from(depositRequests)
      .where(eq(depositRequests.transactionId, transactionId));

    return request;
  }

  async approveDepositRequest(id: number): Promise<Transaction> {
    console.log(`\n=== DB_DEPOSIT >>> PROCESSANDO DEPÓSITO ID=${id} ===`);
    
    // Buscar o depósito
    const [depositRequest] = await db
      .select()
      .from(depositRequests)
      .where(eq(depositRequests.id, id));

    if (!depositRequest) {
      console.log(`DB_DEPOSIT >>> Solicitação de depósito ${id} não encontrada`);
      throw new Error('Solicitação de depósito não encontrada');
    }

    // VERIFICAÇÃO CRÍTICA: Verificar se já existe uma transação com esse transactionId
    if (depositRequest.transactionId) {
      console.log(`DB_DEPOSIT >>> Verificando duplicação para transactionId=${depositRequest.transactionId}`);
      const existingTransaction = await this.getTransactionByTransactionId(depositRequest.transactionId);
      
      if (existingTransaction) {
        console.log(`DB_DEPOSIT >>> ALERTA: Transação ${depositRequest.transactionId} já existe no sistema`);
        console.log(`DB_DEPOSIT >>> Evitando duplicação de crédito`);
        console.log(`DB_DEPOSIT >>> ID da transação existente: ${existingTransaction.id}`);
        console.log(`DB_DEPOSIT >>> Status: ${existingTransaction.status}`);
        console.log(`DB_DEPOSIT >>> Valor: ${existingTransaction.amount}`);
        console.log(`=== DB_DEPOSIT >>> FIM DO PROCESSAMENTO (PREVENÇÃO DE DUPLICAÇÃO) ===\n`);
        
        return existingTransaction;
      }
    }

    // Buscar o usuário
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, depositRequest.userId));

    if (!user) {
      console.log(`DB_DEPOSIT >>> Usuário ${depositRequest.userId} não encontrado`);
      throw new Error('Usuário não encontrado');
    }

    console.log(`DB_DEPOSIT >>> Usuário: ${user.phoneNumber}, Valor: ${depositRequest.amount} KZ`);
    console.log(`DB_DEPOSIT >>> Saldo antes: ${user.balance}`);

    try {
      // Verificar novamente se já existe uma transação (verificação de concorrência)
      if (depositRequest.transactionId) {
        const recentlyCreatedTransaction = await this.getTransactionByTransactionId(depositRequest.transactionId);
        if (recentlyCreatedTransaction) {
          console.log(`DB_DEPOSIT >>> ALERTA: Transação ${depositRequest.transactionId} foi criada durante o processamento`);
          console.log(`=== DB_DEPOSIT >>> FIM DO PROCESSAMENTO (PREVENÇÃO DE DUPLICAÇÃO CONCORRENTE) ===\n`);
          
          return recentlyCreatedTransaction;
        }
      }

      // Criar uma transação para registrar o depósito
      const [transaction] = await db
        .insert(transactions)
        .values({
          userId: depositRequest.userId,
          type: 'deposit',
          amount: depositRequest.amount,
          status: 'completed',
          bankName: depositRequest.bankName,
          bankAccount: null,
          transactionId: depositRequest.transactionId,
          receipt: depositRequest.receipt
        })
        .returning();

      // Atualizar o saldo do usuário
      const newBalance = user.balance + depositRequest.amount;
      await db
        .update(users)
        .set({ 
          balance: newBalance, 
          hasDeposited: true,
          updatedAt: new Date()
        })
        .where(eq(users.id, user.id));

      console.log(`DB_DEPOSIT >>> Depósito processado com sucesso`);
      console.log(`DB_DEPOSIT >>> Novo saldo: ${newBalance}`);
      console.log(`DB_DEPOSIT >>> Transação registrada: ID=${transaction.id}`);
      console.log(`=== DB_DEPOSIT >>> FIM DO PROCESSAMENTO ===\n`);

      return transaction;
    } catch (error) {
      // Se ocorrer um erro do tipo UniqueConstraintViolation, pode ser devido a tentativa 
      // de inserir uma transação com o mesmo transactionId
      console.error(`DB_DEPOSIT >>> ERRO: ${error instanceof Error ? error.message : String(error)}`);
      
      // Verificar se o erro é de violação de unicidade
      if (error instanceof Error && 
         (error.message.includes('unique') || 
          error.message.includes('UNIQUE') || 
          error.message.includes('duplicate key'))) {
        
        console.log(`DB_DEPOSIT >>> Erro de duplicação detectado, buscando transação existente`);
        // Tentar recuperar a transação existente
        if (depositRequest.transactionId) {
          const existingTransaction = await this.getTransactionByTransactionId(depositRequest.transactionId);
          if (existingTransaction) {
            console.log(`DB_DEPOSIT >>> Transação existente encontrada, ID=${existingTransaction.id}`);
            console.log(`=== DB_DEPOSIT >>> FIM DO PROCESSAMENTO (RECUPERAÇÃO DE DUPLICAÇÃO) ===\n`);
            return existingTransaction;
          }
        }
      }
      
      // Se não conseguir recuperar, propagar o erro
      throw error;
    }
  }

  // Withdrawal request methods
  async createWithdrawalRequest(request: InsertWithdrawalRequest): Promise<WithdrawalRequest> {
    const [newRequest] = await db
      .insert(withdrawalRequests)
      .values(request)
      .returning();

    return newRequest;
  }

  async getWithdrawalRequests(): Promise<WithdrawalRequest[]> {
    return await db
      .select()
      .from(withdrawalRequests)
      .orderBy(desc(withdrawalRequests.createdAt));
  }

  async getUserWithdrawalRequests(userId: number): Promise<WithdrawalRequest[]> {
    return await db
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.userId, userId))
      .orderBy(desc(withdrawalRequests.createdAt));
  }

  async approveWithdrawalRequest(id: number, adminId: number): Promise<Transaction> {
    // Buscar a solicitação de saque
    const [withdrawalRequest] = await db
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.id, id));

    if (!withdrawalRequest) {
      throw new Error('Solicitação de saque não encontrada');
    }

    if (withdrawalRequest.status !== 'requested') {
      throw new Error('Esta solicitação de saque já foi processada');
    }

    // Atualizar o status da solicitação para 'approved'
    const [updatedRequest] = await db
      .update(withdrawalRequests)
      .set({ 
        status: 'approved',
        processedAt: new Date(),
        processedBy: adminId
      })
      .where(eq(withdrawalRequests.id, id))
      .returning();

    // Criar uma transação para registrar o saque
    const [transaction] = await db
      .insert(transactions)
      .values({
        userId: withdrawalRequest.userId,
        type: 'withdrawal',
        amount: withdrawalRequest.amount,
        status: 'completed', // Status definido diretamente como 'completed'
        bankAccount: withdrawalRequest.bankAccount,
        bankName: withdrawalRequest.bankName
      })
      .returning();

    return transaction;
  }

  async rejectWithdrawalRequest(id: number, adminId: number): Promise<Transaction> {
    // Buscar a solicitação de saque
    const [withdrawalRequest] = await db
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.id, id));

    if (!withdrawalRequest) {
      throw new Error('Solicitação de saque não encontrada');
    }

    if (withdrawalRequest.status !== 'requested') {
      throw new Error('Esta solicitação de saque já foi processada');
    }

    // Buscar o usuário
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, withdrawalRequest.userId));

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    // Calcular o valor a ser devolvido (80% do valor original - penalidade de 20%)
    const penaltyAmount = withdrawalRequest.amount * 0.2;
    const refundAmount = withdrawalRequest.amount - penaltyAmount;

    // Atualizar o saldo do usuário, adicionando 80% do valor de volta
    const newBalance = user.balance + refundAmount;
    await db
      .update(users)
      .set({ 
        balance: newBalance,
        updatedAt: new Date()
      })
      .where(eq(users.id, user.id));

    // Atualizar o status da solicitação para 'rejected'
    const [updatedRequest] = await db
      .update(withdrawalRequests)
      .set({ 
        status: 'rejected',
        processedAt: new Date(),
        processedBy: adminId
      })
      .where(eq(withdrawalRequests.id, id))
      .returning();

    // Criar uma transação para registrar o saque rejeitado
    const [transaction] = await db
      .insert(transactions)
      .values({
        userId: withdrawalRequest.userId,
        type: 'withdrawal',
        amount: withdrawalRequest.amount,
        status: 'failed', // O status é 'failed' pois o saque foi rejeitado
        bankAccount: withdrawalRequest.bankAccount,
        bankName: withdrawalRequest.bankName
      })
      .returning();

    return transaction;
  }

  // Product methods
  async getProducts(): Promise<Product[]> {
    return await db.select().from(products);
  }

  async getActiveProducts(): Promise<Product[]> {
    return await db
      .select()
      .from(products)
      .where(eq(products.active, true));
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, id));

    return product;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db
      .insert(products)
      .values(product)
      .returning();

    return newProduct;
  }

  async updateProduct(id: number, updates: Partial<InsertProduct>): Promise<Product> {
    const [updatedProduct] = await db
      .update(products)
      .set({ 
        ...updates,
        updatedAt: new Date() 
      })
      .where(eq(products.id, id))
      .returning();

    if (!updatedProduct) {
      throw new Error('Produto não encontrado');
    }

    return updatedProduct;
  }

  async deleteProduct(id: number): Promise<void> {
    await db
      .delete(products)
      .where(eq(products.id, id));
  }

  // Purchase methods
  async getUserPurchases(userId: number): Promise<Purchase[]> {
    return await db
      .select()
      .from(purchases)
      .where(eq(purchases.userId, userId))
      .orderBy(desc(purchases.createdAt));
  }

  async createPurchase(purchase: InsertPurchase): Promise<Purchase> {
    const [newPurchase] = await db
      .insert(purchases)
      .values(purchase)
      .returning();

    return newPurchase;
  }

  // Social links methods
  async getSocialLinks(): Promise<SocialLink[]> {
    return await db.select().from(socialLinks);
  }

  async getActiveSocialLinks(): Promise<SocialLink[]> {
    return await db
      .select()
      .from(socialLinks)
      .where(eq(socialLinks.active, true));
  }

  async getSocialLink(id: number): Promise<SocialLink | undefined> {
    const [link] = await db
      .select()
      .from(socialLinks)
      .where(eq(socialLinks.id, id));

    return link;
  }

  async createSocialLink(link: InsertSocialLink): Promise<SocialLink> {
    const [newLink] = await db
      .insert(socialLinks)
      .values(link)
      .returning();

    return newLink;
  }

  async updateSocialLink(id: number, updates: Partial<InsertSocialLink>): Promise<SocialLink> {
    const [updatedLink] = await db
      .update(socialLinks)
      .set({ 
        ...updates,
        updatedAt: new Date() 
      })
      .where(eq(socialLinks.id, id))
      .returning();

    if (!updatedLink) {
      throw new Error('Link social não encontrado');
    }

    return updatedLink;
  }

  async deleteSocialLink(id: number): Promise<void> {
    await db
      .delete(socialLinks)
      .where(eq(socialLinks.id, id));
  }

  // Bank methods
  async getAllBanks(): Promise<Bank[]> {
    return await db.select().from(banks);
  }

  async getBank(id: number): Promise<Bank | undefined> {
    const [bank] = await db
      .select()
      .from(banks)
      .where(eq(banks.id, id));

    return bank;
  }

  async createBank(bank: InsertBank): Promise<Bank> {
    const [newBank] = await db
      .insert(banks)
      .values(bank)
      .returning();

    return newBank;
  }

  async updateBank(id: number, updates: Partial<InsertBank>): Promise<Bank> {
    const [updatedBank] = await db
      .update(banks)
      .set({ 
        ...updates,
        updatedAt: new Date() 
      })
      .where(eq(banks.id, id))
      .returning();

    if (!updatedBank) {
      throw new Error('Banco não encontrado');
    }

    return updatedBank;
  }

  async deleteBank(id: number): Promise<boolean> {
    const result = await db
      .delete(banks)
      .where(eq(banks.id, id));
    
    return true; // Se não houver erros, consideramos como sucesso
  }

  // Settings methods
  async getAllSettings(): Promise<Setting[]> {
    return await db.select().from(settings);
  }

  async getSetting(key: string): Promise<Setting | undefined> {
    const [setting] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, key));

    return setting;
  }

  async createSetting(setting: InsertSetting): Promise<Setting> {
    const [newSetting] = await db
      .insert(settings)
      .values(setting)
      .returning();

    return newSetting;
  }

  async updateSetting(key: string, value: string): Promise<Setting> {
    const [updatedSetting] = await db
      .update(settings)
      .set({ 
        value,
        updatedAt: new Date() 
      })
      .where(eq(settings.key, key))
      .returning();

    if (!updatedSetting) {
      return this.createSetting({ key, value });
    }

    return updatedSetting;
  }

  // Carousel images methods
  async getAllCarouselImages(): Promise<CarouselImage[]> {
    return await db
      .select()
      .from(carouselImages)
      .orderBy(carouselImages.order);
  }

  async getActiveCarouselImages(): Promise<CarouselImage[]> {
    return await db
      .select()
      .from(carouselImages)
      .where(eq(carouselImages.active, true))
      .orderBy(carouselImages.order);
  }

  async getCarouselImage(id: number): Promise<CarouselImage | undefined> {
    const [image] = await db
      .select()
      .from(carouselImages)
      .where(eq(carouselImages.id, id));

    return image;
  }

  async createCarouselImage(image: InsertCarouselImage): Promise<CarouselImage> {
    const [newImage] = await db
      .insert(carouselImages)
      .values(image)
      .returning();

    return newImage;
  }

  async updateCarouselImage(id: number, updates: Partial<InsertCarouselImage>): Promise<CarouselImage> {
    const [updatedImage] = await db
      .update(carouselImages)
      .set({ 
        ...updates,
        updatedAt: new Date() 
      })
      .where(eq(carouselImages.id, id))
      .returning();

    if (!updatedImage) {
      throw new Error('Imagem não encontrada');
    }

    return updatedImage;
  }

  async deleteCarouselImage(id: number): Promise<boolean> {
    const result = await db
      .delete(carouselImages)
      .where(eq(carouselImages.id, id));
    
    return true; // Se não houver erros, consideramos como sucesso
  }
}

// Usar o armazenamento PostgreSQL em vez do armazenamento em memória
export const storage = new DatabaseStorage();

// Initialize with test data
(async () => {
  try {
    // Check if test user already exists
    let testUser = await storage.getUserByPhoneNumber("999999999");
    
    if (!testUser) {
      // Create test user with phone number 999999999 if doesn't exist
      testUser = await storage.createUser({
        phoneNumber: "999999999",
        password: "protótipo", // Plain password, will be handled by auth.ts
        referralCode: "AA1234",
        referredBy: null,
        isAdmin: true
      });
      
      // Definir um saldo inicial para teste
      await storage.updateUserBalance(testUser.id, 50000);
      console.log(`Usuário de teste criado com saldo inicial de KZ 50000`);
      console.log("Test user created:", testUser.phoneNumber);
    } else {
      console.log("Usuário de teste já existe, pulando criação");
    }

    // Verificar se já existem produtos
    const existingProducts = await storage.getProducts();
    
    // Só criar produtos se não existir nenhum
    if (existingProducts.length === 0) {
      // Criar produtos de teste
      const testProducts = [
        {
          name: "Produto Premium",
          description: "Produto com alto retorno para investidores experientes",
          price: 5000,
          returnRate: 3.0,
          cycleDays: 30,
          dailyIncome: 500,
          totalReturn: 15000,
          active: true
        },
        {
          name: "Produto Básico",
          description: "Produto para iniciantes com retorno moderado",
          price: 2000,
          returnRate: 2.0,
          cycleDays: 30,
          dailyIncome: 133,
          totalReturn: 4000,
          active: true
        },
        {
          name: "Produto VIP",
          description: "Produto exclusivo com alto retorno garantido",
          price: 10000,
          returnRate: 3.5,
          cycleDays: 30,
          dailyIncome: 1167,
          totalReturn: 35000,
          active: true
        }
      ];

      for (const productData of testProducts) {
        await storage.createProduct(productData);
      }

      console.log("Produtos de teste criados");
    } else {
      console.log("Produtos já existem, pulando criação");
    }

    // Verificar se já existem links sociais
    const existingLinks = await storage.getSocialLinks();
    
    if (existingLinks.length === 0) {
      // Criar links sociais padrão
      const socialLinksData = [
        {
          name: "WhatsApp",
          url: "https://wa.me/00000000000",
          icon: "FaWhatsapp",
          active: true
        },
        {
          name: "Telegram",
          url: "https://t.me/example",
          icon: "FaTelegram",
          active: true
        },
        {
          name: "Instagram",
          url: "https://instagram.com/example",
          icon: "FaInstagram",
          active: true
        }
      ];

      for (const linkData of socialLinksData) {
        await storage.createSocialLink(linkData);
      }

      console.log("Links sociais criados");
    } else {
      console.log("Links sociais já existem, pulando criação");
    }

    // Verificar se já existem bancos
    const existingBanks = await storage.getAllBanks();
    
    if (existingBanks.length === 0) {
      // Criar bancos padrão
      const banksData = [
        {
          name: "Banco Angolano de Investimentos (BAI)",
          logo: "bank-bai.png",
          active: true
        },
        {
          name: "Banco de Fomento Angola (BFA)",
          logo: "bank-bfa.png",
          active: true
        },
        {
          name: "Banco Económico (BE)",
          logo: "bank-be.png",
          active: true
        },
        {
          name: "Banco Millennium Atlântico (BMA)",
          logo: "bank-bma.png",
          active: true
        }
      ];

      for (const bankData of banksData) {
        await storage.createBank(bankData);
      }

      console.log("Bancos padrão criados");
    } else {
      console.log("Bancos já existem, pulando criação");
    }

    // Verificar se já existem configurações
    const existingSettings = await storage.getAllSettings();
    
    if (existingSettings.length === 0) {
      // Criar configurações iniciais
      const settingsData = [
        {
          key: "deposit_min",
          value: "1000"
        },
        {
          key: "withdrawal_min",
          value: "1400" // Atualizando para 1400 conforme solicitado
        },
        {
          key: "withdrawal_max",
          value: "50000" // Adicionando limite máximo de 50000
        },
        {
          key: "company_name",
          value: "S&P Global" // Atualizando nome da empresa
        },
        {
          key: "company_address",
          value: "Luanda, Angola"
        },
        {
          key: "level1_commission",
          value: "0.25"
        },
        {
          key: "level2_commission",
          value: "0.05"
        },
        {
          key: "level3_commission",
          value: "0.03"
        },
        {
          key: "service_hours_start",
          value: "10" // Horário de início (10h)
        },
        {
          key: "service_hours_end",
          value: "20" // Horário de término (20h)
        },
        {
          key: "withdrawal_rejection_penalty",
          value: "0.20" // Penalidade de 20% para saques rejeitados
        }
      ];

      for (const settingData of settingsData) {
        await storage.createSetting(settingData);
      }

      console.log("Configurações iniciais criadas");
    } else {
      console.log("Configurações já existem, pulando criação");
    }

  } catch (error) {
    console.error("Erro ao inicializar dados de teste:", error);
  }
})();

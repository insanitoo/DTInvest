import { 
  InsertUser, User, BankInfo, InsertBankInfo, 
  Transaction, InsertTransaction, Product, InsertProduct, 
  Purchase, InsertPurchase, SocialLink, InsertSocialLink,
  Bank, InsertBank, Setting, InsertSetting,
  CarouselImage, InsertCarouselImage
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

// Interface for storage operations
export interface IStorage {
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

  // Transações
  getTransactions(userId: number): Promise<Transaction[]>;
  getAllTransactions(): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransactionStatus(id: number, status: string): Promise<Transaction>;

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

// Memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private bankInfo: Map<number, BankInfo & { userId: number }>;
  private transactions: Map<number, Transaction>;
  private products: Map<number, Product>;
  private purchases: Map<number, Purchase>;
  private socialLinks: Map<number, SocialLink>;
  private banks: Map<number, Bank>;
  private settings: Map<string, Setting>;
  private carouselImages: Map<number, CarouselImage>;
  private currentUserId: number;
  private currentBankInfoId: number;
  private currentTransactionId: number;
  private currentProductId: number;
  private currentPurchaseId: number;
  private currentSocialLinkId: number;
  private currentBankId: number;
  private currentSettingId: number;
  private currentCarouselImageId: number;
  sessionStore: session.Store;

  // Método auxiliar para verificar e atualizar o saldo para depósitos concluídos
  async _verificarEAtualizarSaldoDeposito(transaction: Transaction): Promise<void> {
    console.log(`\n===== PROCESSANDO ATUALIZAÇÃO DE SALDO PARA DEPÓSITO ${transaction.status} =====`);
    console.log(`Tipo: ${transaction.type}, Valor: ${transaction.amount}, Usuário: ${transaction.userId}, Status: ${transaction.status}`);

    try {
      // Verificar se o tipo de transação é realmente depósito
      if (transaction.type !== 'deposit') {
        console.error(`ERRO: Tentativa de atualizar saldo para uma transação que não é depósito: ${transaction.type}`);
        return;
      }

      // Verificar se o status permite atualização de saldo
      if (transaction.status !== 'completed') {
        console.error(`ERRO: Tentativa de atualizar saldo para um depósito com status inválido: ${transaction.status}`);
        return;
      }

      // Buscar o usuário
      const user = await this.getUser(transaction.userId);
      if (!user) {
        console.error(`ERRO: Usuário ${transaction.userId} não encontrado`);
        throw new Error(`Usuário ${transaction.userId} não encontrado`);
      }

      console.log(`Usuário encontrado: ID ${user.id}, Telefone: ${user.phoneNumber}`);
      console.log(`Saldo atual: ${user.balance}, Valor do depósito: ${transaction.amount}`);

      // Verificar se já existem registros de transações anteriores que indicam que este depósito já foi processado
      // Isso evita processamento duplo de um mesmo depósito
      const transacoes = await this.getTransactions(user.id);
      const depositos = transacoes.filter(tx => 
        tx.type === 'deposit' && 
        tx.status === 'completed' &&
        tx.id === transaction.id
      );

      // Se houver mais de um registro, isso pode indicar que já atualizamos antes
      if (depositos.length > 1) {
        console.log(`ALERTA: Este depósito já possui ${depositos.length} registros processados`);
        console.log(`Verificando se o saldo atual já reflete o valor do depósito...`);

        // Verificar se o saldo já foi atualizado com base nas transações posteriores
        const dataDeposito = new Date(transaction.createdAt);
        const transacoesPosteriores = transacoes.filter(tx => 
          new Date(tx.createdAt) > dataDeposito && 
          tx.type === 'purchase'
        );

        if (transacoesPosteriores.length > 0) {
          console.log(`Existem ${transacoesPosteriores.length} transações após este depósito. O saldo já deve estar atualizado.`);
          return;
        }
      }

      // Calcular novo saldo
      const newBalance = user.balance + transaction.amount;
      console.log(`Novo saldo calculado: ${newBalance}`);

      // Atualizar saldo no banco de dados
      const updatedUser = await this.updateUserBalance(transaction.userId, newBalance);
      console.log(`SUCESSO: Saldo atualizado de ${user.balance} para ${updatedUser.balance}`);

      // Verificar se a atualização realmente foi persistida
      const verifiedUser = await this.getUser(transaction.userId);
      if (!verifiedUser) {
        console.error(`ERRO: Não foi possível verificar usuário após atualização`);
      } else if (verifiedUser.balance !== newBalance) {
        console.error(`ERRO CRÍTICO: Saldo não foi atualizado corretamente. Esperado=${newBalance}, atual=${verifiedUser.balance}`);
      } else {
        console.log(`VERIFICADO: Saldo do usuário ${transaction.userId} está correto: ${verifiedUser.balance}`);

        // Marcar que o usuário fez um depósito
        await this.updateUser(transaction.userId, { hasDeposited: true });
      }

      console.log(`===== FIM DO PROCESSAMENTO DE ATUALIZAÇÃO DE SALDO =====\n`);
    } catch (error) {
      console.error(`ERRO GRAVE ao processar atualização de saldo:`, error);
      // Não lançamos o erro para permitir que a transação continue atualizada
    }
  }

  constructor() {
    this.users = new Map();
    this.bankInfo = new Map();
    this.transactions = new Map();
    this.products = new Map();
    this.purchases = new Map();
    this.socialLinks = new Map();
    this.banks = new Map();
    this.settings = new Map();
    this.carouselImages = new Map();

    this.currentUserId = 1;
    this.currentBankInfoId = 1;
    this.currentTransactionId = 1;
    this.currentProductId = 1;
    this.currentPurchaseId = 1;
    this.currentSocialLinkId = 1;
    this.currentBankId = 1;
    this.currentSettingId = 1;
    this.currentCarouselImageId = 1;

    const MemoryStore = createMemoryStore(session);
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // 24 hours
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByPhoneNumber(phoneNumber: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.phoneNumber === phoneNumber,
    );
  }

  async getUserByReferralCode(referralCode: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.referralCode === referralCode,
    );
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const now = new Date();

    const user: User = {
      id,
      ...insertUser,
      balance: 0,
      level1Commission: 0,
      level2Commission: 0,
      level3Commission: 0,
      hasProduct: false,
      hasDeposited: false,
      createdAt: now,
      updatedAt: now,
      isAdmin: insertUser.hasOwnProperty('isAdmin') ? (insertUser as any).isAdmin : false,
      referredBy: insertUser.referredBy || null,
    };

    this.users.set(id, user);
    return user;
  }

  async updateUserBalance(userId: number, newBalance: number): Promise<User> {
    /**************************************************************************
     * NOVA IMPLEMENTAÇÃO DO SISTEMA DE ATUALIZAÇÃO DE SALDO
     * Versão 1.0 - Abril 2025
     * Sistema robusto e confiável para atualização atômica de saldo
     **************************************************************************/
    
    console.log(`\n=== BALANCE >>> INÍCIO DA ATUALIZAÇÃO DE SALDO ===`);
    console.log(`BALANCE >>> Usuário: ${userId}, Novo saldo: ${newBalance}`);
    
    // ETAPA 1: Verificação de parâmetros
    if (isNaN(newBalance) || !isFinite(newBalance) || newBalance < 0) {
      const errorMsg = `Valor de saldo inválido: ${newBalance}`;
      console.error(`BALANCE >>> ERRO: ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    // ETAPA 2: Obter dados atuais do usuário
    const user = await this.getUser(userId);
    if (!user) {
      const errorMsg = `Usuário ${userId} não encontrado`;
      console.error(`BALANCE >>> ERRO: ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    console.log(`BALANCE >>> Usuário encontrado: ${user.phoneNumber}`);
    console.log(`BALANCE >>> Saldo atual: ${user.balance}, Novo saldo: ${newBalance}`);
    
    // ETAPA 3: Verificar se a atualização é necessária
    if (Math.abs(user.balance - newBalance) < 0.01) {
      console.log(`BALANCE >>> Saldo já está correto (${user.balance}), nenhuma alteração necessária`);
      return user; // Retorna o usuário sem alterações
    }
    
    // ETAPA 4: Criar objeto de usuário atualizado
    const deltaBalance = newBalance - user.balance;
    const isDeposit = deltaBalance > 0;
    
    console.log(`BALANCE >>> Alteração: ${isDeposit ? '+' : ''}${deltaBalance} KZ (${isDeposit ? 'aumento' : 'redução'})`);
    
    const updatedUser: User = {
      ...user,
      balance: newBalance,
      updatedAt: new Date(),
      // Atualiza o indicador hasDeposited apenas se for um depósito
      hasDeposited: user.hasDeposited || isDeposit
    };
    
    // ETAPA 5: Implementação principal - Process Atomic
    try {
      // 5.1 - Aplicar a atualização com verificação atômica
      const oldBalance = user.balance;
      
      // Remover o usuário atual completamente - ruptura da referência
      this.users.delete(userId);
      
      // Inserir o novo estado atômico
      this.users.set(userId, updatedUser);
      
      // 5.2 - Verificar se a persistência funcionou
      const verifiedUser = this.users.get(userId);
      
      if (!verifiedUser) {
        throw new Error(`Falha crítica na operação - Usuário ${userId} desapareceu da base`);
      }
      
      if (Math.abs(verifiedUser.balance - newBalance) > 0.01) {
        throw new Error(`Falha na persistência do saldo - Esperado: ${newBalance}, Atual: ${verifiedUser.balance}`);
      }
      
      // 5.3 - Relatório de sucesso
      console.log(`BALANCE >>> SUCESSO: Saldo atualizado de ${oldBalance} para ${verifiedUser.balance}`);
      console.log(`BALANCE >>> Variação: ${isDeposit ? '+' : ''}${deltaBalance} KZ`);
      console.log(`=== BALANCE >>> FIM DA ATUALIZAÇÃO DE SALDO (SUCESSO) ===\n`);
      
      return verifiedUser;
    } 
    catch (error) {
      // 5.4 - Procedimento de recuperação em caso de falha
      console.error(`BALANCE >>> ERRO CRÍTICO: ${error instanceof Error ? error.message : String(error)}`);
      console.log(`BALANCE >>> Iniciando procedimento de recuperação...`);
      
      try {
        // Recuperação de emergência - implementação de baixo nível
        // Criar um objeto completamente novo para evitar contaminação
        const recoveryUser: User = {
          id: user.id,
          phoneNumber: user.phoneNumber,
          password: user.password,
          referralCode: user.referralCode,
          referredBy: user.referredBy,
          isAdmin: user.isAdmin,
          balance: newBalance, // Garante o novo valor
          level1Commission: user.level1Commission,
          level2Commission: user.level2Commission,
          level3Commission: user.level3Commission,
          hasProduct: user.hasProduct,
          hasDeposited: user.hasDeposited || isDeposit,
          createdAt: user.createdAt,
          updatedAt: new Date()
        };
        
        // Forçar atualização direta no Map
        this.users.delete(userId);
        this.users.set(userId, recoveryUser);
        
        // Verificar recuperação
        const finalCheck = this.users.get(userId);
        if (!finalCheck || Math.abs(finalCheck.balance - newBalance) > 0.01) {
          throw new Error(`Falha na recuperação de emergência`);
        } else {
          console.log(`BALANCE >>> Recuperação bem-sucedida! Saldo final: ${finalCheck.balance}`);
          console.log(`=== BALANCE >>> FIM DA ATUALIZAÇÃO DE SALDO (RECUPERAÇÃO) ===\n`);
          return finalCheck;
        }
      } 
      catch (recoveryError) {
        console.error(`BALANCE >>> FALHA FATAL NA RECUPERAÇÃO: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`);
        console.error(`=== BALANCE >>> FIM DA ATUALIZAÇÃO DE SALDO (FALHA) ===\n`);
        
        // Reestabelecer o estado original como último recurso
        this.users.set(userId, user);
        
        // Propagação do erro para tratamento em níveis superiores
        throw new Error(`Falha crítica na atualização de saldo: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  // Bank info methods
  async getBankInfoByUserId(userId: number): Promise<BankInfo | undefined> {
    const bankInfoEntry = Array.from(this.bankInfo.values()).find(
      (info) => info.userId === userId,
    );

    if (!bankInfoEntry) return undefined;

    return {
      bank: bankInfoEntry.bank,
      ownerName: bankInfoEntry.ownerName,
      accountNumber: bankInfoEntry.accountNumber,
    };
  }

  async createBankInfo(userId: number, bankInfoData: InsertBankInfo): Promise<BankInfo> {
    // Check if user exists
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    // Check if bank info already exists for user
    const existingBankInfo = Array.from(this.bankInfo.values()).find(
      (info) => info.userId === userId,
    );

    if (existingBankInfo) {
      throw new Error('Usuário já possui informações bancárias cadastradas');
    }

    const now = new Date();
    const id = this.currentBankInfoId++;

    const newBankInfo = {
      id,
      userId,
      ...bankInfoData,
      createdAt: now,
      updatedAt: now,
    };

    this.bankInfo.set(id, newBankInfo);

    return {
      bank: newBankInfo.bank,
      ownerName: newBankInfo.ownerName,
      accountNumber: newBankInfo.accountNumber,
    };
  }

  async updateBankInfo(userId: number, bankInfoData: InsertBankInfo): Promise<BankInfo> {
    // Check if user exists
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    // Check if bank info exists for user
    const existingBankInfo = Array.from(this.bankInfo.values()).find(
      (info) => info.userId === userId,
    );

    if (!existingBankInfo) {
      throw new Error('Informações bancárias não encontradas');
    }

    const now = new Date();
    const updatedBankInfo = {
      ...existingBankInfo,
      ...bankInfoData,
      updatedAt: now,
    };

    this.bankInfo.set(existingBankInfo.id, updatedBankInfo);

    return {
      bank: updatedBankInfo.bank,
      ownerName: updatedBankInfo.ownerName,
      accountNumber: updatedBankInfo.accountNumber,
    };
  }

  async deleteBankInfo(userId: number): Promise<void> {
    const existingBankInfo = Array.from(this.bankInfo.entries()).find(
      ([_, info]) => info.userId === userId,
    );

    if (!existingBankInfo) {
      throw new Error('Informações bancárias não encontradas');
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

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const id = this.currentTransactionId++;
    const now = new Date();

    const newTransaction: Transaction = {
      id,
      userId: transaction.userId,
      type: transaction.type,
      amount: transaction.amount,
      status: transaction.status,
      bankAccount: transaction.bankAccount === undefined ? null : transaction.bankAccount,
      bankName: transaction.bankName === undefined ? null : transaction.bankName,
      receipt: transaction.receipt === undefined ? null : transaction.receipt,
      createdAt: now,
      updatedAt: now,
    };

    this.transactions.set(id, newTransaction);
    return newTransaction;
  }

  async updateTransactionStatus(id: number, status: string): Promise<Transaction> {
    /**************************************************************************
     * NOVA IMPLEMENTAÇÃO DO SISTEMA DE ATUALIZAÇÃO DE TRANSAÇÕES
     * Criada do zero para garantir integridade e confiabilidade
     * Versão 1.0 - Abril 2025
     **************************************************************************/
    
    console.log(`\n--- TRANSACT >>> INÍCIO DA OPERAÇÃO [${id}:${status}] ---\n`);
    
    // ETAPA 1: Validação básica
    const transaction = this.transactions.get(id);
    if (!transaction) {
      console.error(`TRANSACT >>> ERRO: Transação ${id} não encontrada`);
      throw new Error('Transação não encontrada');
    }
    
    const validStatus = ['pending', 'processing', 'completed', 'failed'];
    if (!validStatus.includes(status)) {
      console.error(`TRANSACT >>> ERRO: Status inválido: ${status}`);
      throw new Error(`Status inválido: ${status}`);
    }
    
    // ETAPA 2: Informações de diagnóstico
    console.log(`TRANSACT >>> ID: ${id}, Tipo: ${transaction.type}, Valor: ${transaction.amount}`);
    console.log(`TRANSACT >>> Status atual: ${transaction.status}, Novo status: ${status}`);
    
    // ETAPA 3: Verificar usuário antes da atualização
    const user = await this.getUser(transaction.userId);
    if (!user) {
      console.error(`TRANSACT >>> ERRO: Usuário ${transaction.userId} não encontrado`);
      throw new Error(`Usuário ${transaction.userId} não encontrado`);
    }
    console.log(`TRANSACT >>> Usuário: ${user.phoneNumber}, Saldo atual: ${user.balance}`);
    
    // ETAPA 4: Verificar idempotência (mesmo status)
    if (transaction.status === status) {
      console.log(`TRANSACT >>> Status já é '${status}' - sem alterações necessárias`);
      return transaction; // Retorna sem alterações
    }
    
    // ETAPA 5: Criar e salvar transação com novo status
    const updatedTransaction: Transaction = {
      ...transaction,
      status: status,
      updatedAt: new Date()
    };
    
    // Salvar a transação atualizada
    this.transactions.set(id, updatedTransaction);
    
    // ETAPA 6: Verificar se a alteração foi aplicada corretamente
    const savedTransaction = this.transactions.get(id);
    if (!savedTransaction || savedTransaction.status !== status) {
      console.error(`TRANSACT >>> ERRO: Falha ao salvar status da transação`);
      throw new Error('Falha ao salvar alteração de status');
    }
    console.log(`TRANSACT >>> Status da transação atualizado com sucesso para: ${status}`);
    
    // ETAPA 7: Processar efeitos da atualização de transação
    let balanceUpdated = false;
    
    // 7.1 - Tratar depósito concluído (principal caso que causa problemas)
    if (status === 'completed' && transaction.type === 'deposit') {
      console.log(`\nTRANSACT >>> PROCESSANDO DEPÓSITO CONCLUÍDO`);
      
      try {
        // Calcular novo saldo
        const newBalance = user.balance + transaction.amount;
        console.log(`TRANSACT >>> Saldo atual: ${user.balance}, Depósito: ${transaction.amount}, Novo saldo: ${newBalance}`);
        
        // Atualizar saldo - OPERAÇÃO CRÍTICA
        const beforeUpdate = Date.now();
        const updatedUser = await this.updateUserBalance(user.id, newBalance);
        const afterUpdate = Date.now();
        console.log(`TRANSACT >>> Atualização de saldo completada em ${afterUpdate - beforeUpdate}ms`);
        
        // Verificar se a atualização funcionou
        if (Math.abs(updatedUser.balance - newBalance) < 0.01) {
          console.log(`TRANSACT >>> SUCESSO: Saldo atualizado para ${updatedUser.balance}`);
          balanceUpdated = true;
          
          // Atualizar status do usuário
          await this.updateUser(user.id, { 
            hasDeposited: true,
            updatedAt: new Date()
          });
        } else {
          console.error(`TRANSACT >>> ERRO: Saldo não foi atualizado corretamente!`);
          console.error(`TRANSACT >>> Esperado: ${newBalance}, Atual: ${updatedUser.balance}`);
          
          // PROCEDIMENTO DE RECUPERAÇÃO DE EMERGÊNCIA
          console.log(`TRANSACT >>> Iniciando procedimento de recuperação de emergência...`);
          
          // Recuperação direta - última tentativa
          this.users.delete(user.id);
          const recoveryUser = { 
            ...user, 
            balance: newBalance,
            hasDeposited: true,
            updatedAt: new Date()
          };
          this.users.set(user.id, recoveryUser);
          
          // Verificar recuperação
          const finalUser = this.users.get(user.id);
          if (finalUser && Math.abs(finalUser.balance - newBalance) < 0.01) {
            console.log(`TRANSACT >>> Recuperação de emergência bem-sucedida! Saldo final: ${finalUser.balance}`);
            balanceUpdated = true;
          } else {
            console.error(`TRANSACT >>> FALHA CRÍTICA: Não foi possível atualizar o saldo mesmo após tentativa de recuperação!`);
          }
        }
      } catch (error) {
        console.error(`TRANSACT >>> ERRO durante atualização de saldo:`, error);
      }
    }
    
    // 7.2 - Tratar saque falhado (estorno)
    else if (status === 'failed' && transaction.type === 'withdrawal') {
      console.log(`\nTRANSACT >>> PROCESSANDO SAQUE FALHO (ESTORNO)`);
      
      try {
        // Calcular valor a ser devolvido
        const newBalance = user.balance + transaction.amount;
        console.log(`TRANSACT >>> Saldo atual: ${user.balance}, Estorno: ${transaction.amount}, Novo saldo: ${newBalance}`);
        
        // Realizar estorno
        const updatedUser = await this.updateUserBalance(user.id, newBalance);
        
        if (Math.abs(updatedUser.balance - newBalance) < 0.01) {
          console.log(`TRANSACT >>> SUCESSO: Saldo estornado para ${updatedUser.balance}`);
          balanceUpdated = true;
        } else {
          console.error(`TRANSACT >>> ERRO: Falha no estorno de saque!`);
        }
      } catch (error) {
        console.error(`TRANSACT >>> ERRO durante estorno:`, error);
      }
    }
    
    // ETAPA 8: Concluir operação
    const finalUserState = await this.getUser(transaction.userId);
    console.log(`\nTRANSACT >>> RESUMO DA OPERAÇÃO:`);
    console.log(`TRANSACT >>> Transação ${id}: ${transaction.status} -> ${status}`);
    console.log(`TRANSACT >>> Usuário ${transaction.userId} (${user.phoneNumber}):`);
    console.log(`TRANSACT >>> Saldo inicial: ${user.balance}, Saldo final: ${finalUserState?.balance || 'N/A'}`);
    console.log(`TRANSACT >>> Atualização de saldo: ${balanceUpdated ? 'SUCESSO' : 'NÃO NECESSÁRIA/FALHA'}`);
    console.log(`\n--- TRANSACT >>> FIM DA OPERAÇÃO [${id}:${status}] ---\n`);
    
    return updatedTransaction;
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
    if (!existingLink) {      throw new Error('Link social não encontrado');
    }

    const updatedLink = {
      ...existingLink,
      ...link,
      updatedAt: new Date(),
    };

    this.socialLinks.set(id, updatedLink);
    return updatedLink;
  }

  asyncdeleteSocialLink(id: number): Promise<void> {
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
      .sort((a, b) => a.order - b.order);
  }

  async getActiveCarouselImages(): Promise<CarouselImage[]> {
    return Array.from(this.carouselImages.values())
      .filter(img => img.active)
      .sort((a, b) => a.order - b.order);
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
export const storage = new MemStorage();

// Initialize with test data
(async () => {
  try {
    // Create test user with phone number 999999999
    const testUser = await storage.createUser({
      phoneNumber: "999999999",
      password: "protótipo", // Plain password, will be handled by auth.ts
      referralCode: "AA1234",
      referredBy: null,
      isAdmin: true
    });

    // Definir um saldo inicial para teste (não passar pelo createUser para focar no problema real)
    const updatedUser = await storage.updateUserBalance(testUser.id, 50000);
    console.log(`Usuário de teste criado com saldo inicial de KZ ${updatedUser.balance}`);

    console.log("Test user created:", testUser.phoneNumber);

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

    // Criar configurações iniciais
    const settingsData = [
      {
        key: "deposit_min",
        value: "1000"
      },
      {
        key: "withdrawal_min",
        value: "2000"
      },
      {
        key: "company_name",
        value: "S&P Global"
      },
      {
        key: "support_email",
        value: "suporte@spglobal.com"
      },
      {
        key: "support_phone",
        value: "+244 000 000 000"
      },
      {
        key: "aboutUs",
        value: "A S&P Global é uma plataforma líder em investimentos e gerenciamento financeiro, oferecendo soluções inovadoras e seguras para nossos clientes."
      }
    ];

    for (const settingData of settingsData) {
      await storage.createSetting(settingData);
    }

    console.log("Configurações iniciais criadas");

  } catch (error) {
    console.error("Error creating test data:", error);
  }
})();
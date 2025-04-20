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
      createdAt: now,
      updatedAt: now,
    };

    this.transactions.set(id, newTransaction);
    return newTransaction;
  }

  async updateTransactionStatus(id: number, status: string): Promise<Transaction> {
    console.log(`Iniciando atualização da transação ${id} para status ${status}`);
    
    const transaction = this.transactions.get(id);
    if (!transaction) {
      console.error(`Transação ${id} não encontrada`);
      throw new Error('Transação não encontrada');
    }
    
    console.log(`Estado anterior da transação ${id}:`, transaction);
    
    // Validar se o status é válido para evitar estados inconsistentes
    const validStatus = ['pending', 'processing', 'completed', 'failed', 'approved'];
    if (!validStatus.includes(status)) {
      console.error(`Status inválido: ${status}. Valores permitidos: ${validStatus.join(', ')}`);
      throw new Error(`Status inválido: ${status}`);
    }
    
    // Não fazer nada se o status já for o mesmo (idempotência)
    if (transaction.status === status) {
      console.log(`Transação ${id} já está com status ${status}, nenhuma ação necessária`);
      return transaction;
    }

    const updatedTransaction = {
      ...transaction,
      status,
      updatedAt: new Date(),
    };

    console.log(`Novo estado da transação ${id}:`, updatedTransaction);
    
    // Atualizar o saldo do usuário quando o status for alterado para 'completed' ou 'approved'
    if ((status === 'completed' || status === 'approved') && 
        (transaction.status !== 'completed' && transaction.status !== 'approved')) {
      
      try {
        const user = await this.getUser(transaction.userId);
        if (!user) {
          throw new Error(`Usuário ${transaction.userId} não encontrado`);
        }

        let newBalance = user.balance;
        // Para depósitos aprovados/completados, adicionar ao saldo
        if (transaction.type === 'deposit') {
          newBalance = user.balance + transaction.amount;
          console.log(`Depósito: Atualizando saldo de ${user.balance} para ${newBalance}`);
        }
        // Para saques aprovados/completados, subtrair do saldo
        else if (transaction.type === 'withdrawal') {
          newBalance = user.balance - transaction.amount;
          console.log(`Saque: Atualizando saldo de ${user.balance} para ${newBalance}`);
        }

        // Atualizar o saldo
        await this.updateUserBalance(transaction.userId, newBalance);
        console.log(`Saldo atualizado com sucesso para ${newBalance}`);
      } catch (error) {
        console.error('Erro ao atualizar saldo:', error);
        throw error; // Propagar erro para reverter a transação
      }
    } else if (transaction.type === 'withdrawal' && status === 'failed') {
        // Para saques que falharam, devolvemos o valor ao saldo do usuário
        console.log(`Devolvendo valor ao usuário ${transaction.userId} para saque que falhou`);
        try {
          const user = await this.getUser(transaction.userId);
          if (user) {
            const newBalance = user.balance + transaction.amount; // Devolve o valor
            console.log(`Usuário ${transaction.userId}: saldo anterior = ${user.balance}, novo saldo = ${newBalance}`);
            await this.updateUserBalance(transaction.userId, newBalance);
            console.log(`Saldo do usuário ${transaction.userId} atualizado com sucesso para ${newBalance}`);
          }
        } catch (error) {
          console.error(`Erro ao devolver saldo do usuário ${transaction.userId}:`, error);
        }
      }
    }
    
    this.transactions.set(id, updatedTransaction);
    
    // Verificar se a atualização foi persistida corretamente
    const persistedTransaction = this.transactions.get(id);
    console.log(`Estado persistido da transação ${id}:`, persistedTransaction);
    
    if (persistedTransaction?.status !== status) {
      console.error(`Falha ao persistir o status: esperado=${status}, atual=${persistedTransaction?.status}`);
    } else {
      console.log(`Status da transação ${id} atualizado com sucesso para ${status}`);
    }
    
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
import { InsertUser, User, BankInfo, InsertBankInfo, Transaction, InsertTransaction, Product, InsertProduct, Purchase, InsertPurchase } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

// Interface for storage operations
export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByPhoneNumber(phoneNumber: string): Promise<User | undefined>;
  getUserByReferralCode(referralCode: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUserBalance(userId: number, newBalance: number): Promise<User>;
  updateUser(userId: number, updates: Partial<User>): Promise<User>; // Método para atualizar qualquer propriedade do usuário

  getBankInfoByUserId(userId: number): Promise<BankInfo | undefined>;
  updateBankInfo(userId: number, bankInfo: InsertBankInfo): Promise<BankInfo>;
  createBankInfo(userId: number, bankInfo: InsertBankInfo): Promise<BankInfo>;
  deleteBankInfo(userId: number): Promise<void>;

  getTransactions(userId: number): Promise<Transaction[]>;
  getAllTransactions(): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransactionStatus(id: number, status: string): Promise<Transaction>;
  
  // Métodos produtos
  getProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product>;
  deleteProduct(id: number): Promise<void>;
  getActiveProducts(): Promise<Product[]>;

  // Métodos compras
  getUserPurchases(userId: number): Promise<Purchase[]>;
  createPurchase(purchase: InsertPurchase): Promise<Purchase>;

  sessionStore: session.Store;
}

// Memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private bankInfo: Map<number, BankInfo & { userId: number }>;
  private transactions: Map<number, Transaction>;
  private products: Map<number, Product>;
  private purchases: Map<number, Purchase>;
  private currentUserId: number;
  private currentBankInfoId: number;
  private currentTransactionId: number;
  private currentProductId: number;
  private currentPurchaseId: number;
  sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.bankInfo = new Map();
    this.transactions = new Map();
    this.products = new Map();
    this.purchases = new Map();
    this.currentUserId = 1;
    this.currentBankInfoId = 1;
    this.currentTransactionId = 1;
    this.currentProductId = 1;
    this.currentPurchaseId = 1;

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

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const id = this.currentTransactionId++;
    const now = new Date();

    const newTransaction: Transaction = {
      id,
      ...transaction,
      createdAt: now,
      updatedAt: now,
    };

    this.transactions.set(id, newTransaction);
    return newTransaction;
  }

  async updateTransactionStatus(id: number, status: string): Promise<Transaction> {
    const transaction = this.transactions.get(id);
    if (!transaction) {
      throw new Error('Transação não encontrada');
    }

    const updatedTransaction = {
      ...transaction,
      status,
      updatedAt: new Date(),
    };

    this.transactions.set(id, updatedTransaction);
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
    
  } catch (error) {
    console.error("Error creating test data:", error);
  }
})();
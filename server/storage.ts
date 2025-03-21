import { users, products, userProducts, transactions, banks, settings, carouselImages, type User, type InsertUser, type Product, type InsertProduct, type UserProduct, type InsertUserProduct, type Transaction, type InsertTransaction, type Bank, type InsertBank, type Setting, type InsertSetting, type CarouselImage, type InsertCarouselImage, type BankInfo } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import { nanoid } from "nanoid";

const MemoryStore = createMemoryStore(session);

// CRUD operations interface
export interface IStorage {
  // Session store
  sessionStore: session.Store;

  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByPhoneNumber(phoneNumber: string): Promise<User | undefined>;
  getUserByReferralCode(referralCode: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User | undefined>;
  updateUserBalance(id: number, amount: number): Promise<User | undefined>;
  updateUserBankInfo(id: number, bankInfo: BankInfo): Promise<User | undefined>;
  getReferrals(userId: number, level: number): Promise<User[]>;
  getAllUsers(): Promise<User[]>;
  blockUser(id: number, isBlocked: boolean): Promise<User | undefined>;
  updateUserLastOnline(id: number): Promise<void>;

  // Product operations
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, updates: Partial<Product>): Promise<Product | undefined>;
  getAllProducts(): Promise<Product[]>;
  getActiveProducts(): Promise<Product[]>;
  deleteProduct(id: number): Promise<boolean>;
  
  // User product operations
  getUserProduct(id: number): Promise<UserProduct | undefined>;
  createUserProduct(userProduct: InsertUserProduct): Promise<UserProduct>;
  getUserProducts(userId: number): Promise<UserProduct[]>;
  updateUserProductDays(): Promise<void>;

  // Transaction operations
  getTransaction(id: number): Promise<Transaction | undefined>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransactionStatus(id: number, status: string, processedAt?: Date): Promise<Transaction | undefined>;
  getUserTransactions(userId: number): Promise<Transaction[]>;
  getAllTransactions(): Promise<Transaction[]>;
  
  // Bank operations
  getBank(id: number): Promise<Bank | undefined>;
  createBank(bank: InsertBank): Promise<Bank>;
  updateBank(id: number, updates: Partial<Bank>): Promise<Bank | undefined>;
  getAllBanks(): Promise<Bank[]>;
  getActiveBanks(): Promise<Bank[]>;
  deleteBank(id: number): Promise<boolean>;

  // Settings operations
  getSetting(key: string): Promise<Setting | undefined>;
  createSetting(setting: InsertSetting): Promise<Setting>;
  updateSetting(key: string, value: string): Promise<Setting | undefined>;
  getAllSettings(): Promise<Setting[]>;

  // Carousel image operations
  getCarouselImage(id: number): Promise<CarouselImage | undefined>;
  createCarouselImage(image: InsertCarouselImage): Promise<CarouselImage>;
  updateCarouselImage(id: number, updates: Partial<CarouselImage>): Promise<CarouselImage | undefined>;
  getAllCarouselImages(): Promise<CarouselImage[]>;
  getActiveCarouselImages(): Promise<CarouselImage[]>;
  deleteCarouselImage(id: number): Promise<boolean>;
  
  // Stats operations
  getTotalUsers(): Promise<number>;
  getTotalDeposits(): Promise<number>;
  getTotalWithdrawals(): Promise<number>;
  getPopularProducts(): Promise<{productId: number, name: string, count: number}[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private products: Map<number, Product>;
  private userProducts: Map<number, UserProduct>;
  private transactions: Map<number, Transaction>;
  private banks: Map<number, Bank>;
  private settingsMap: Map<string, Setting>;
  private carouselImages: Map<number, CarouselImage>;
  sessionStore: session.Store;
  
  currentUserId: number;
  currentProductId: number;
  currentUserProductId: number;
  currentTransactionId: number;
  currentBankId: number;
  currentSettingId: number;
  currentCarouselImageId: number;

  constructor() {
    this.users = new Map();
    this.products = new Map();
    this.userProducts = new Map();
    this.transactions = new Map();
    this.banks = new Map();
    this.settingsMap = new Map();
    this.carouselImages = new Map();
    
    this.currentUserId = 1;
    this.currentProductId = 1;
    this.currentUserProductId = 1;
    this.currentTransactionId = 1;
    this.currentBankId = 1;
    this.currentSettingId = 1;
    this.currentCarouselImageId = 1;
    
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
    
    // Create initial admin user
    // Cria o admin com senha já hasheada (hash para "darktrace.vip")
    this.users.set(1, {
      id: 1,
      phoneNumber: "admin",
      password: "3bba7c3de9200c34ce5eb557e31c97ea3bd8a888b58e46623a5b47fe71e73d50a2304a1503488e6ff1deebf834f764c2be3f46a5d71d9a4cb5c5e6997dfb71e5.1bf2b5bac415008c38e8df34c687c5ad",
      referralCode: "ADMIN123",
      referredBy: null,
      level1Referrals: 0,
      level2Referrals: 0,
      level3Referrals: 0,
      level1Commission: 0,
      level2Commission: 0,
      level3Commission: 0,
      balance: 100000,
      bankInfo: {},
      isAdmin: true,
      isBlocked: false,
      hasProduct: true,
      hasDeposited: true,
      dailyIncome: 1000,
      createdAt: new Date(),
      lastOnline: new Date()
    });
    
    // Cria um usuário normal com senha simples para teste (sem hash)
    this.users.set(2, {
      id: 2,
      phoneNumber: "999999999",
      password: "prototype", // Usaremos uma senha simples para teste
      referralCode: "USER123",
      referredBy: null,
      level1Referrals: 0,
      level2Referrals: 0,
      level3Referrals: 0,
      level1Commission: 0,
      level2Commission: 0,
      level3Commission: 0,
      balance: 1000,
      bankInfo: {},
      isAdmin: false,
      isBlocked: false,
      hasProduct: true,
      hasDeposited: true,
      dailyIncome: 500,
      createdAt: new Date(),
      lastOnline: new Date()
    });
    
    this.currentUserId = 3; // Próximo ID será 3
    
    // Create initial products
    this.createProduct({
      name: "Projeto 1",
      price: 5000,
      returnRate: 12,
      cycleDays: 50,
      dailyIncome: 600,
      totalReturn: 30000
    });
    
    this.createProduct({
      name: "Projeto 2",
      price: 10000,
      returnRate: 12,
      cycleDays: 50,
      dailyIncome: 1200,
      totalReturn: 60000
    });
    
    this.createProduct({
      name: "Projeto 3",
      price: 30000,
      returnRate: 12,
      cycleDays: 50,
      dailyIncome: 3600,
      totalReturn: 180000
    });
    
    // Create initial bank
    this.createBank({
      name: "BAI",
      ownerName: "S&P Global",
      accountNumber: "AO06 0040 0000 1234 5678 9012 3"
    });
    
    // Create initial settings
    this.createSetting({
      key: "aboutUs",
      value: "A S&P Global é uma plataforma líder em soluções de investimento com foco em segurança e inovação. Nossa missão é proporcionar aos nossos clientes oportunidades de crescimento financeiro com segurança cibernética de ponta."
    });
    
    // Create initial carousel images
    this.createCarouselImage({
      imageUrl: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=60"
    });
  }

  // User operations
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

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { 
      ...insertUser, 
      id,
      level1Referrals: 0,
      level2Referrals: 0,
      level3Referrals: 0,
      level1Commission: 0,
      level2Commission: 0,
      level3Commission: 0,
      balance: 0,
      hasDeposited: false,
      hasProduct: false,
      dailyIncome: 0,
      isAdmin: false,
      isBlocked: false,
      createdAt: new Date(),
      lastOnline: new Date()
    };
    this.users.set(id, user);
    
    // Update referral counts for the referrer
    if (user.referredBy) {
      const referrer = await this.getUser(user.referredBy);
      if (referrer) {
        await this.updateUser(referrer.id, {
          level1Referrals: referrer.level1Referrals + 1
        });
        
        // Update level 2 referrals
        if (referrer.referredBy) {
          const level2Referrer = await this.getUser(referrer.referredBy);
          if (level2Referrer) {
            await this.updateUser(level2Referrer.id, {
              level2Referrals: level2Referrer.level2Referrals + 1
            });
            
            // Update level 3 referrals
            if (level2Referrer.referredBy) {
              const level3Referrer = await this.getUser(level2Referrer.referredBy);
              if (level3Referrer) {
                await this.updateUser(level3Referrer.id, {
                  level3Referrals: level3Referrer.level3Referrals + 1
                });
              }
            }
          }
        }
      }
    }
    
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async updateUserBalance(id: number, amount: number): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { 
      ...user, 
      balance: user.balance + amount
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async updateUserBankInfo(id: number, bankInfo: BankInfo): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { 
      ...user, 
      bankInfo: bankInfo
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async getReferrals(userId: number, level: number): Promise<User[]> {
    const users = Array.from(this.users.values());
    
    if (level === 1) {
      return users.filter(user => user.referredBy === userId);
    } else if (level === 2) {
      const level1ReferralIds = users
        .filter(user => user.referredBy === userId)
        .map(user => user.id);
      
      return users.filter(user => 
        user.referredBy !== undefined && 
        level1ReferralIds.includes(user.referredBy)
      );
    } else if (level === 3) {
      const level1ReferralIds = users
        .filter(user => user.referredBy === userId)
        .map(user => user.id);
      
      const level2ReferralIds = users
        .filter(user => 
          user.referredBy !== undefined && 
          level1ReferralIds.includes(user.referredBy)
        )
        .map(user => user.id);
      
      return users.filter(user => 
        user.referredBy !== undefined && 
        level2ReferralIds.includes(user.referredBy)
      );
    }
    
    return [];
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async blockUser(id: number, isBlocked: boolean): Promise<User | undefined> {
    return this.updateUser(id, { isBlocked });
  }

  async updateUserLastOnline(id: number): Promise<void> {
    const user = await this.getUser(id);
    if (user) {
      await this.updateUser(id, { lastOnline: new Date() });
    }
  }

  // Product operations
  async getProduct(id: number): Promise<Product | undefined> {
    return this.products.get(id);
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const id = this.currentProductId++;
    const product: Product = { 
      ...insertProduct, 
      id,
      active: true,
      order: id
    };
    this.products.set(id, product);
    return product;
  }

  async updateProduct(id: number, updates: Partial<Product>): Promise<Product | undefined> {
    const product = this.products.get(id);
    if (!product) return undefined;
    
    const updatedProduct = { ...product, ...updates };
    this.products.set(id, updatedProduct);
    return updatedProduct;
  }

  async getAllProducts(): Promise<Product[]> {
    return Array.from(this.products.values());
  }

  async getActiveProducts(): Promise<Product[]> {
    return Array.from(this.products.values())
      .filter(product => product.active)
      .sort((a, b) => a.order - b.order);
  }

  async deleteProduct(id: number): Promise<boolean> {
    return this.products.delete(id);
  }

  // User product operations
  async getUserProduct(id: number): Promise<UserProduct | undefined> {
    return this.userProducts.get(id);
  }

  async createUserProduct(insertUserProduct: InsertUserProduct): Promise<UserProduct> {
    const id = this.currentUserProductId++;
    const userProduct: UserProduct = { 
      ...insertUserProduct, 
      id,
      isActive: true,
      purchasedAt: new Date()
    };
    this.userProducts.set(id, userProduct);
    
    // Update user hasProduct flag
    const user = await this.getUser(userProduct.userId);
    if (user) {
      await this.updateUser(user.id, { 
        hasProduct: true,
        dailyIncome: user.dailyIncome + userProduct.dailyIncome
      });
    }
    
    return userProduct;
  }

  async getUserProducts(userId: number): Promise<UserProduct[]> {
    return Array.from(this.userProducts.values())
      .filter(userProduct => userProduct.userId === userId);
  }

  async updateUserProductDays(): Promise<void> {
    for (const [id, userProduct] of this.userProducts.entries()) {
      if (userProduct.isActive && userProduct.daysRemaining > 0) {
        const updatedUserProduct = { 
          ...userProduct, 
          daysRemaining: userProduct.daysRemaining - 1
        };
        
        if (updatedUserProduct.daysRemaining === 0) {
          updatedUserProduct.isActive = false;
          
          // Update user dailyIncome when product expires
          const user = await this.getUser(userProduct.userId);
          if (user) {
            await this.updateUser(user.id, { 
              dailyIncome: Math.max(0, user.dailyIncome - userProduct.dailyIncome)
            });
          }
        }
        
        this.userProducts.set(id, updatedUserProduct);
      }
    }
  }

  // Transaction operations
  async getTransaction(id: number): Promise<Transaction | undefined> {
    return this.transactions.get(id);
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const id = this.currentTransactionId++;
    const transaction: Transaction = { 
      ...insertTransaction, 
      id,
      createdAt: new Date(),
      processedAt: undefined
    };
    this.transactions.set(id, transaction);
    return transaction;
  }

  async updateTransactionStatus(id: number, status: string, processedAt: Date = new Date()): Promise<Transaction | undefined> {
    const transaction = this.transactions.get(id);
    if (!transaction) return undefined;
    
    const updatedTransaction = { 
      ...transaction, 
      status,
      processedAt: processedAt
    };
    this.transactions.set(id, updatedTransaction);
    
    // If a deposit is completed, update user's hasDeposited flag
    if (transaction.type === 'deposit' && status === 'completed') {
      const user = await this.getUser(transaction.userId);
      if (user) {
        await this.updateUser(user.id, { hasDeposited: true });
        await this.updateUserBalance(user.id, transaction.amount);
      }
    } 
    // If a withdrawal is completed, no need to update balance as it's already deducted when creating the withdrawal
    
    return updatedTransaction;
  }

  async getUserTransactions(userId: number): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .filter(transaction => transaction.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getAllTransactions(): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Bank operations
  async getBank(id: number): Promise<Bank | undefined> {
    return this.banks.get(id);
  }

  async createBank(insertBank: InsertBank): Promise<Bank> {
    const id = this.currentBankId++;
    const bank: Bank = { 
      ...insertBank, 
      id,
      active: true
    };
    this.banks.set(id, bank);
    return bank;
  }

  async updateBank(id: number, updates: Partial<Bank>): Promise<Bank | undefined> {
    const bank = this.banks.get(id);
    if (!bank) return undefined;
    
    const updatedBank = { ...bank, ...updates };
    this.banks.set(id, updatedBank);
    return updatedBank;
  }

  async getAllBanks(): Promise<Bank[]> {
    return Array.from(this.banks.values());
  }

  async getActiveBanks(): Promise<Bank[]> {
    return Array.from(this.banks.values())
      .filter(bank => bank.active);
  }

  async deleteBank(id: number): Promise<boolean> {
    return this.banks.delete(id);
  }

  // Settings operations
  async getSetting(key: string): Promise<Setting | undefined> {
    return this.settingsMap.get(key);
  }

  async createSetting(insertSetting: InsertSetting): Promise<Setting> {
    const id = this.currentSettingId++;
    const setting: Setting = { 
      ...insertSetting, 
      id
    };
    this.settingsMap.set(setting.key, setting);
    return setting;
  }

  async updateSetting(key: string, value: string): Promise<Setting | undefined> {
    const setting = this.settingsMap.get(key);
    if (!setting) return undefined;
    
    const updatedSetting = { ...setting, value };
    this.settingsMap.set(key, updatedSetting);
    return updatedSetting;
  }

  async getAllSettings(): Promise<Setting[]> {
    return Array.from(this.settingsMap.values());
  }

  // Carousel image operations
  async getCarouselImage(id: number): Promise<CarouselImage | undefined> {
    return this.carouselImages.get(id);
  }

  async createCarouselImage(insertImage: InsertCarouselImage): Promise<CarouselImage> {
    const id = this.currentCarouselImageId++;
    const image: CarouselImage = { 
      ...insertImage, 
      id,
      order: id,
      active: true
    };
    this.carouselImages.set(id, image);
    return image;
  }

  async updateCarouselImage(id: number, updates: Partial<CarouselImage>): Promise<CarouselImage | undefined> {
    const image = this.carouselImages.get(id);
    if (!image) return undefined;
    
    const updatedImage = { ...image, ...updates };
    this.carouselImages.set(id, updatedImage);
    return updatedImage;
  }

  async getAllCarouselImages(): Promise<CarouselImage[]> {
    return Array.from(this.carouselImages.values());
  }

  async getActiveCarouselImages(): Promise<CarouselImage[]> {
    return Array.from(this.carouselImages.values())
      .filter(image => image.active)
      .sort((a, b) => a.order - b.order);
  }

  async deleteCarouselImage(id: number): Promise<boolean> {
    return this.carouselImages.delete(id);
  }

  // Stats operations
  async getTotalUsers(): Promise<number> {
    return this.users.size;
  }

  async getTotalDeposits(): Promise<number> {
    return Array.from(this.transactions.values())
      .filter(transaction => 
        transaction.type === 'deposit' && 
        transaction.status === 'completed'
      )
      .reduce((sum, transaction) => sum + transaction.amount, 0);
  }

  async getTotalWithdrawals(): Promise<number> {
    return Array.from(this.transactions.values())
      .filter(transaction => 
        transaction.type === 'withdrawal' && 
        transaction.status === 'completed'
      )
      .reduce((sum, transaction) => sum + transaction.amount, 0);
  }

  async getPopularProducts(): Promise<{productId: number, name: string, count: number}[]> {
    const productCounts = new Map<number, number>();
    
    for (const userProduct of this.userProducts.values()) {
      const count = productCounts.get(userProduct.productId) || 0;
      productCounts.set(userProduct.productId, count + 1);
    }
    
    const result: {productId: number, name: string, count: number}[] = [];
    
    for (const [productId, count] of productCounts.entries()) {
      const product = await this.getProduct(productId);
      if (product) {
        result.push({
          productId,
          name: product.name,
          count
        });
      }
    }
    
    return result.sort((a, b) => b.count - a.count);
  }
}

export const storage = new MemStorage();

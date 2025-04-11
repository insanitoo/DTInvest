import { InsertUser, User, BankInfo, InsertBankInfo, Transaction, InsertTransaction } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

// Interface for storage operations
export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByPhoneNumber(phoneNumber: string): Promise<User | undefined>;
  getUserByReferralCode(referralCode: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserBalance(userId: number, newBalance: number): Promise<User>;

  getBankInfoByUserId(userId: number): Promise<BankInfo | undefined>;
  updateBankInfo(userId: number, bankInfo: InsertBankInfo): Promise<BankInfo>;

  getTransactions(userId: number): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransactionStatus(id: number, status: string): Promise<Transaction>;

  sessionStore: session.Store;
}

// Memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private bankInfo: Map<number, BankInfo & { userId: number }>;
  private transactions: Map<number, Transaction>;
  private currentUserId: number;
  private currentBankInfoId: number;
  private currentTransactionId: number;
  sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.bankInfo = new Map();
    this.transactions = new Map();
    this.currentUserId = 1;
    this.currentBankInfoId = 1;
    this.currentTransactionId = 1;

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

  async updateBankInfo(userId: number, bankInfoData: Omit<BankInfo, "userId">): Promise<BankInfo> {
    // Check if user exists
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    // Check if bank info exists for user
    const existingBankInfo = Array.from(this.bankInfo.values()).find(
      (info) => info.userId === userId,
    );

    const now = new Date();

    if (existingBankInfo) {
      // Update existing bank info
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
    } else {
      // Create new bank info
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
  }

  // Transaction methods
  async getTransactions(userId: number): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .filter((tx) => tx.userId === userId)
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
}

// Export storage instance
export const storage = new MemStorage();

// Get dashboard stats
export async function getTotalUsers() {
  const result = await db.select({ count: sql`count(*)` }).from(users);
  return Number(result[0].count);
}

export async function getTotalDeposits() {
  const result = await db
    .select({ sum: sql`sum(amount)` })
    .from(transactions)
    .where(eq(transactions.type, 'deposit'))
    .where(eq(transactions.status, 'completed'));
  return Number(result[0].sum) || 0;
}

export async function getTotalWithdrawals() {
  const result = await db
    .select({ sum: sql`sum(amount)` })
    .from(transactions)
    .where(eq(transactions.type, 'withdrawal'))
    .where(eq(transactions.status, 'completed'));
  return Number(result[0].sum) || 0;
}

export async function getPopularProducts() {
  const result = await db
    .select({
      productId: products.id,
      name: products.name,
      count: sql`count(*)`.as('count')
    })
    .from(purchases)
    .innerJoin(products, eq(purchases.productId, products.id))
    .groupBy(products.id, products.name)
    .orderBy(sql`count(*) desc`)
    .limit(5);
  return result;
}

// Initialize with a test user
(async () => {
  try {
    const { hashPassword } = await import('./auth.js');

    // Create test user with phone number 999999999
    const testUser = await storage.createUser({
      phoneNumber: "999999999",
      password: await hashPassword("123456"),
      referralCode: "AA1234",
      referredBy: null,
      isAdmin: true
    });

    console.log("Test user created:", testUser.phoneNumber);
  } catch (error) {
    console.error("Error creating test user:", error);
  }
})();
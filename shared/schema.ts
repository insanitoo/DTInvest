import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  phoneNumber: text("phone_number").notNull().unique(),
  password: text("password").notNull(),
  balance: doublePrecision("balance").default(0).notNull(),
  referralCode: text("referral_code").notNull().unique(),
  referredBy: text("referred_by"),
  isAdmin: boolean("is_admin").default(false).notNull(),
  level1Commission: doublePrecision("level1_commission").default(0).notNull(),
  level2Commission: doublePrecision("level2_commission").default(0).notNull(),
  level3Commission: doublePrecision("level3_commission").default(0).notNull(),
  hasProduct: boolean("has_product").default(false).notNull(),
  hasDeposited: boolean("has_deposited").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Transaction schema (histórico de transações)
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // deposit, withdrawal, purchase, commission
  amount: doublePrecision("amount").notNull(),
  bankAccount: text("bank_account"),
  bankName: text("bank_name"),
  receipt: text("receipt"), // Comprovante para depósitos
  createdAt: timestamp("created_at").defaultNow().notNull(),
  transactionId: text("transaction_id"), // ID de referência única para depósitos
});

// Depósitos pendentes (aguardando aprovação do admin)
export const depositRequests = pgTable("deposit_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  amount: doublePrecision("amount").notNull(),
  bankName: text("bank_name"),
  receipt: text("receipt"),
  transactionId: text("transaction_id").notNull().unique(), // ID gerado para o usuário fornecer ao gerente
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Saques pendentes (aguardando aprovação/rejeição do admin)
export const withdrawalRequests = pgTable("withdrawal_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  amount: doublePrecision("amount").notNull(),
  status: text("status").notNull().default("requested"), // requested, approved, rejected
  bankAccount: text("bank_account"),
  bankName: text("bank_name"),
  ownerName: text("owner_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
  processedBy: integer("processed_by").references(() => users.id),
});

// Bank info schema
export const bankInfo = pgTable("bank_info", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id).unique(),
  bank: text("bank").notNull(),
  ownerName: text("owner_name").notNull(),
  accountNumber: text("account_number").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Products schema
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price: doublePrecision("price").notNull(),
  returnRate: doublePrecision("return_rate").notNull(),
  cycleDays: integer("cycle_days").notNull(),
  dailyIncome: doublePrecision("daily_income").notNull(),
  totalReturn: doublePrecision("total_return").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Purchases schema 
export const purchases = pgTable("purchases", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  productId: integer("product_id").notNull().references(() => products.id),
  amount: doublePrecision("amount").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Schema para links sociais
export const socialLinks = pgTable("social_links", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  icon: text("icon").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Schema para bancos (para serem selecionados pelos usuários)
export const banks = pgTable("banks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  logo: text("logo"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Schema para configurações gerais
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Schema para imagens do carrossel
export const carouselImages = pgTable("carousel_images", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  imageUrl: text("image_url").notNull(),
  linkUrl: text("link_url"),
  order: integer("order").default(0),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Insertion schemas
export const insertUserSchema = createInsertSchema(users).pick({
  phoneNumber: true,
  password: true,
  referralCode: true,
  referredBy: true,
  isAdmin: true,
});

// Nota: Temos 'approved' aqui, apesar de não ser mencionado no comentário do schema da tabela
// Isso poderia ser uma fonte de confusão, garantindo que todos os status possíveis estejam aqui
// Status de saque: solicitado, aprovado, rejeitado
export const withdrawalStatusEnum = z.enum(['requested', 'approved', 'rejected']);

// Schema para inserir transações (histórico final)
export const insertTransactionSchema = createInsertSchema(transactions).extend({
  userId: z.number(),
  type: z.enum(['deposit', 'withdrawal', 'commission', 'purchase']),
  amount: z.number().positive(),
  bankAccount: z.string().nullable(),
  bankName: z.string().nullable(),
  receipt: z.string().nullable(),
  transactionId: z.string().nullable()
});

// Schema para solicitar depósito
export const insertDepositRequestSchema = createInsertSchema(depositRequests).extend({
  userId: z.number(),
  amount: z.number().positive().min(1000, "Valor mínimo para depósito é KZ 1000"),
  bankName: z.string().nullable(),
  receipt: z.string().nullable(),
  transactionId: z.string()
});

// Schema para solicitar saque
export const insertWithdrawalRequestSchema = createInsertSchema(withdrawalRequests).extend({
  userId: z.number(),
  amount: z.number().positive().min(1400, "Valor mínimo para saque é KZ 1400").max(50000, "Valor máximo para saque é KZ 50000"),
  bankAccount: z.string(),
  bankName: z.string(),
  ownerName: z.string(),
  status: withdrawalStatusEnum.default('requested')
});

// Schema para processar saque (aprovar/rejeitar)
export const processWithdrawalSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  processedBy: z.number()
});

export const insertBankInfoSchema = createInsertSchema(bankInfo).pick({
  userId: true,
  bank: true,
  ownerName: true,
  accountNumber: true,
});

export const insertProductSchema = createInsertSchema(products).pick({
  name: true,
  description: true,
  price: true,
  returnRate: true,
  cycleDays: true,
  dailyIncome: true,
  totalReturn: true,
  active: true,
});

export const insertPurchaseSchema = createInsertSchema(purchases).pick({
  userId: true,
  productId: true,
  amount: true,
});

export const insertSocialLinkSchema = createInsertSchema(socialLinks).pick({
  name: true, 
  url: true,
  icon: true,
  active: true
});

export const insertBankSchema = createInsertSchema(banks).pick({
  name: true,
  logo: true,
  active: true
});

export const insertSettingSchema = createInsertSchema(settings).pick({
  key: true,
  value: true
});

export const insertCarouselImageSchema = createInsertSchema(carouselImages).pick({
  title: true,
  imageUrl: true,
  linkUrl: true,
  order: true,
  active: true
});

// Login data
export interface LoginData {
  phoneNumber: string;
  password: string;
  rememberMe?: boolean;
}

// Registration data
export interface RegistrationData {
  phoneNumber: string;
  password: string;
  referralCode?: string;
}

// Bank info type
export interface BankInfo {
  bank: string;
  ownerName: string;
  accountNumber: string;
}

// Interface para Investimentos do Usuário (baseado em Purchase + dados do produto)
export interface UserProduct {
  id: number;
  productId: number;
  productName: string;
  price: number;
  dailyIncome: number;
  isActive: boolean;
  daysRemaining: number;
  purchasedAt: Date;
}

// Types
export type User = typeof users.$inferSelect & { 
  bankInfo?: BankInfo;
};
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type DepositRequest = typeof depositRequests.$inferSelect;
export type InsertDepositRequest = z.infer<typeof insertDepositRequestSchema>;
export type WithdrawalRequest = typeof withdrawalRequests.$inferSelect;
export type InsertWithdrawalRequest = z.infer<typeof insertWithdrawalRequestSchema>;
export type InsertBankInfo = z.infer<typeof insertBankInfoSchema>;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Purchase = typeof purchases.$inferSelect;
export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;
export type SocialLink = typeof socialLinks.$inferSelect;
export type InsertSocialLink = z.infer<typeof insertSocialLinkSchema>;
export type Bank = typeof banks.$inferSelect;
export type InsertBank = z.infer<typeof insertBankSchema>;
export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type CarouselImage = typeof carouselImages.$inferSelect;
export type InsertCarouselImage = z.infer<typeof insertCarouselImageSchema>;
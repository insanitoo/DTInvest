import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  phoneNumber: text("phone_number").notNull().unique(),
  password: text("password").notNull(),
  referralCode: text("referral_code").notNull().unique(),
  referredBy: integer("referred_by").references(() => users.id),
  level1Referrals: integer("level1_referrals").default(0),
  level2Referrals: integer("level2_referrals").default(0),
  level3Referrals: integer("level3_referrals").default(0),
  level1Commission: doublePrecision("level1_commission").default(0),
  level2Commission: doublePrecision("level2_commission").default(0),
  level3Commission: doublePrecision("level3_commission").default(0),
  balance: doublePrecision("balance").default(0),
  hasDeposited: boolean("has_deposited").default(false),
  hasProduct: boolean("has_product").default(false),
  dailyIncome: doublePrecision("daily_income").default(0),
  bankInfo: json("bank_info").$type<BankInfo>().default({}),
  isAdmin: boolean("is_admin").default(false),
  isBlocked: boolean("is_blocked").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  lastOnline: timestamp("last_online").defaultNow(),
});

// Products table
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  price: doublePrecision("price").notNull(),
  returnRate: doublePrecision("return_rate").notNull(),
  cycleDays: integer("cycle_days").notNull(),
  dailyIncome: doublePrecision("daily_income").notNull(),
  totalReturn: doublePrecision("total_return").notNull(),
  active: boolean("active").default(true),
  order: integer("order").default(0),
});

// User products table
export const userProducts = pgTable("user_products", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  productId: integer("product_id").notNull().references(() => products.id),
  price: doublePrecision("price").notNull(),
  dailyIncome: doublePrecision("daily_income").notNull(),
  daysRemaining: integer("days_remaining").notNull(),
  isActive: boolean("is_active").default(true),
  purchasedAt: timestamp("purchased_at").defaultNow(),
});

// Transactions table
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // 'deposit', 'withdrawal', 'commission', 'purchase'
  amount: doublePrecision("amount").notNull(),
  status: text("status").notNull(), // 'pending', 'processing', 'completed', 'failed'
  bankAccount: text("bank_account"),
  bankName: text("bank_name"),
  receipt: text("receipt"),
  createdAt: timestamp("created_at").defaultNow(),
  processedAt: timestamp("processed_at"),
});

// Banks table
export const banks = pgTable("banks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ownerName: text("owner_name").notNull(),
  accountNumber: text("account_number").notNull(),
  active: boolean("active").default(true),
});

// Settings table
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

// Carousel images
export const carouselImages = pgTable("carousel_images", {
  id: serial("id").primaryKey(),
  imageUrl: text("image_url").notNull(),
  order: integer("order").default(0),
  active: boolean("active").default(true),
});

// Types
export type BankInfo = {
  bank?: string;
  ownerName?: string;
  accountNumber?: string;
};

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  level1Referrals: true,
  level2Referrals: true,
  level3Referrals: true,
  level1Commission: true,
  level2Commission: true,
  level3Commission: true,
  balance: true,
  dailyIncome: true,
  hasDeposited: true,
  hasProduct: true,
  isAdmin: true,
  isBlocked: true,
  createdAt: true,
  lastOnline: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  active: true,
  order: true,
});

export const insertUserProductSchema = createInsertSchema(userProducts).omit({
  id: true,
  isActive: true,
  purchasedAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});

export const insertBankSchema = createInsertSchema(banks).omit({
  id: true,
  active: true,
});

export const insertSettingSchema = createInsertSchema(settings).omit({
  id: true,
});

export const insertCarouselImageSchema = createInsertSchema(carouselImages).omit({
  id: true,
  order: true,
  active: true,
});

export const loginSchema = z.object({
  phoneNumber: z.string(),
  password: z.string(),
});

export const registrationSchema = z.object({
  phoneNumber: z.string()
    .min(9, "Número de telefone deve ter pelo menos 9 dígitos")
    .max(9, "Número de telefone deve ter no máximo 9 dígitos")
    .regex(/^9[0-9]{8}$/, "Número de telefone deve começar com 9 seguido de 8 dígitos"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  referralCode: z.string().min(1, "Código de convite é obrigatório"),
});

export const withdrawalSchema = z.object({
  amount: z.number().min(2000, "O valor mínimo para saque é KZ 2000"),
});

export const depositSchema = z.object({
  amount: z.number().min(1, "O valor deve ser maior que zero"),
  bankId: z.number(),
});

export const saveUserBankSchema = z.object({
  bank: z.string(),
  ownerName: z.string(),
  accountNumber: z.string(),
});

// Select types
export type User = typeof users.$inferSelect;
export type Product = typeof products.$inferSelect;
export type UserProduct = typeof userProducts.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Bank = typeof banks.$inferSelect;
export type Setting = typeof settings.$inferSelect;
export type CarouselImage = typeof carouselImages.$inferSelect;

// Insert types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertUserProduct = z.infer<typeof insertUserProductSchema>;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type InsertBank = z.infer<typeof insertBankSchema>;
export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type InsertCarouselImage = z.infer<typeof insertCarouselImageSchema>;
export type LoginData = z.infer<typeof loginSchema>;
export type RegistrationData = z.infer<typeof registrationSchema>;
export type WithdrawalData = z.infer<typeof withdrawalSchema>;
export type DepositData = z.infer<typeof depositSchema>;
export type SaveUserBankData = z.infer<typeof saveUserBankSchema>;

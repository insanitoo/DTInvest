import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { setupAdminRoutes } from "./admin";
import { transactions, withdrawalSchema, depositSchema, saveUserBankSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import cron from "node-cron";

// Check if a time is between 10:00 and 15:00 Angola time
function isWithinAngolaBusinessHours(): boolean {
  const now = new Date();
  const angolaTime = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Luanda" }));
  const hours = angolaTime.getHours();
  return hours >= 10 && hours < 15;
}

// Check if a day is a weekday (Monday to Friday)
function isWeekday(): boolean {
  const now = new Date();
  const angolaTime = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Luanda" }));
  const day = angolaTime.getDay();
  return day >= 1 && day <= 5; // 0 is Sunday, 6 is Saturday
}

// Middleware to check if user is authenticated
function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Não autenticado" });
}

// Middleware to check if user is an admin
function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated() && req.user.isAdmin) {
    return next();
  }
  res.status(403).json({ message: "Acesso não autorizado" });
}

// Middleware to check if user is blocked
function isNotBlocked(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated() && req.user.isBlocked) {
    return res.status(403).json({ message: "Conta congelada" });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

  // Setup admin routes
  setupAdminRoutes(app);

  // Update user's last online time on every authenticated request
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated()) {
      await storage.updateUserLastOnline(req.user.id);
    }
    next();
  });

  // Get all products
  app.get("/api/products", isAuthenticated, isNotBlocked, async (req: Request, res: Response) => {
    const products = await storage.getActiveProducts();
    res.json(products);
  });

  // Get user's investments/purchased products
  app.get("/api/user/investments", isAuthenticated, isNotBlocked, async (req: Request, res: Response) => {
    const userProducts = await storage.getUserProducts(req.user.id);
    
    // Fetch complete product details for each user product
    const investments = await Promise.all(userProducts.map(async (userProduct) => {
      const product = await storage.getProduct(userProduct.productId);
      return {
        ...userProduct,
        productName: product?.name || "Produto não encontrado"
      };
    }));
    
    res.json(investments);
  });

  // Purchase a product
  app.post("/api/products/:id/purchase", isAuthenticated, isNotBlocked, async (req: Request, res: Response) => {
    const productId = parseInt(req.params.id);
    const product = await storage.getProduct(productId);
    
    if (!product) {
      return res.status(404).json({ message: "Produto não encontrado" });
    }
    
    if (!product.active) {
      return res.status(400).json({ message: "Este produto não está disponível" });
    }
    
    const user = await storage.getUser(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }
    
    if (user.balance < product.price) {
      return res.status(400).json({ message: "Saldo insuficiente" });
    }
    
    // Deduct product price from user balance
    await storage.updateUserBalance(user.id, -product.price);
    
    // Create user product
    const userProduct = await storage.createUserProduct({
      userId: user.id,
      productId: product.id,
      price: product.price,
      dailyIncome: product.dailyIncome,
      daysRemaining: product.cycleDays,
      isActive: true
    });
    
    // Create transaction record
    await storage.createTransaction({
      userId: user.id,
      type: "purchase",
      amount: product.price,
      status: "completed"
    });
    
    // Update referral commissions if this is the first product purchase
    if (!user.hasProduct && user.referredBy) {
      const referrer = await storage.getUser(user.referredBy);
      if (referrer) {
        // Level 1 commission (25%)
        const level1Commission = product.price * 0.25;
        await storage.updateUserBalance(referrer.id, level1Commission);
        await storage.updateUser(referrer.id, {
          level1Commission: referrer.level1Commission + level1Commission
        });
        
        // Create commission transaction record
        await storage.createTransaction({
          userId: referrer.id,
          type: "commission",
          amount: level1Commission,
          status: "completed"
        });
        
        // Level 2 commission (5%)
        if (referrer.referredBy) {
          const level2Referrer = await storage.getUser(referrer.referredBy);
          if (level2Referrer) {
            const level2Commission = product.price * 0.05;
            await storage.updateUserBalance(level2Referrer.id, level2Commission);
            await storage.updateUser(level2Referrer.id, {
              level2Commission: level2Referrer.level2Commission + level2Commission
            });
            
            // Create commission transaction record
            await storage.createTransaction({
              userId: level2Referrer.id,
              type: "commission",
              amount: level2Commission,
              status: "completed"
            });
            
            // Level 3 commission (2%)
            if (level2Referrer.referredBy) {
              const level3Referrer = await storage.getUser(level2Referrer.referredBy);
              if (level3Referrer) {
                const level3Commission = product.price * 0.02;
                await storage.updateUserBalance(level3Referrer.id, level3Commission);
                await storage.updateUser(level3Referrer.id, {
                  level3Commission: level3Referrer.level3Commission + level3Commission
                });
                
                // Create commission transaction record
                await storage.createTransaction({
                  userId: level3Referrer.id,
                  type: "commission",
                  amount: level3Commission,
                  status: "completed"
                });
              }
            }
          }
        }
      }
    }
    
    res.json(userProduct);
  });

  // Create withdrawal request
  app.post("/api/withdrawals", isAuthenticated, isNotBlocked, async (req: Request, res: Response) => {
    try {
      const data = withdrawalSchema.parse(req.body);
      const user = req.user;
      
      // Check withdrawal restrictions
      if (!isWithinAngolaBusinessHours()) {
        return res.status(400).json({ message: "Saques disponíveis apenas das 10h às 15h (horário de Angola)" });
      }
      
      if (!isWeekday()) {
        return res.status(400).json({ message: "Saques disponíveis apenas de segunda a sexta" });
      }
      
      if (!user.hasProduct) {
        return res.status(400).json({ message: "É necessário comprar um produto antes de fazer saques" });
      }
      
      if (!user.hasDeposited) {
        return res.status(400).json({ message: "É necessário fazer um depósito antes de fazer saques" });
      }
      
      if (user.balance < data.amount) {
        return res.status(400).json({ message: "Saldo insuficiente" });
      }
      
      // Calculate 20% fee
      const fee = data.amount * 0.2;
      const netAmount = data.amount - fee;
      
      // Deduct withdrawal amount from user balance
      await storage.updateUserBalance(user.id, -data.amount);
      
      // Get user's bank info
      const bankInfo = user.bankInfo;
      
      // Create withdrawal transaction
      const withdrawal = await storage.createTransaction({
        userId: user.id,
        type: "withdrawal",
        amount: netAmount, // Store the net amount (after fee)
        status: "pending",
        bankName: bankInfo.bank,
        bankAccount: bankInfo.accountNumber
      });
      
      res.json(withdrawal);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        res.status(500).json({ message: "Erro ao processar o pedido" });
      }
    }
  });

  // Create deposit request
  app.post("/api/deposits", isAuthenticated, isNotBlocked, async (req: Request, res: Response) => {
    try {
      const data = depositSchema.parse(req.body);
      const user = req.user;
      
      // Get bank info
      const bank = await storage.getBank(data.bankId);
      if (!bank) {
        return res.status(404).json({ message: "Banco não encontrado" });
      }
      
      // Create deposit transaction
      const deposit = await storage.createTransaction({
        userId: user.id,
        type: "deposit",
        amount: data.amount,
        status: "pending",
        bankName: bank.name,
        bankAccount: bank.accountNumber,
        receipt: req.body.receipt
      });
      
      res.json(deposit);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        res.status(500).json({ message: "Erro ao processar o pedido" });
      }
    }
  });

  // Get user's transactions
  app.get("/api/transactions", isAuthenticated, isNotBlocked, async (req: Request, res: Response) => {
    const transactions = await storage.getUserTransactions(req.user.id);
    res.json(transactions);
  });

  // Get available banks for deposit
  app.get("/api/banks", isAuthenticated, isNotBlocked, async (req: Request, res: Response) => {
    const banks = await storage.getActiveBanks();
    res.json(banks);
  });

  // Save user's bank information
  app.post("/api/user/bank", isAuthenticated, isNotBlocked, async (req: Request, res: Response) => {
    try {
      const data = saveUserBankSchema.parse(req.body);
      
      const user = await storage.updateUserBankInfo(req.user.id, {
        bank: data.bank,
        ownerName: data.ownerName,
        accountNumber: data.accountNumber
      });
      
      res.json(user);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        res.status(500).json({ message: "Erro ao salvar informações bancárias" });
      }
    }
  });

  // Get user's referral information
  app.get("/api/user/referrals", isAuthenticated, isNotBlocked, async (req: Request, res: Response) => {
    const user = req.user;
    
    const level1Referrals = await storage.getReferrals(user.id, 1);
    const level2Referrals = await storage.getReferrals(user.id, 2);
    const level3Referrals = await storage.getReferrals(user.id, 3);
    
    res.json({
      level1: {
        count: level1Referrals.length,
        commission: user.level1Commission,
        referrals: level1Referrals.map(ref => ({
          id: ref.id,
          phoneNumber: ref.phoneNumber,
          hasProduct: ref.hasProduct
        }))
      },
      level2: {
        count: level2Referrals.length,
        commission: user.level2Commission,
        referrals: level2Referrals.map(ref => ({
          id: ref.id,
          phoneNumber: ref.phoneNumber,
          hasProduct: ref.hasProduct
        }))
      },
      level3: {
        count: level3Referrals.length,
        commission: user.level3Commission,
        referrals: level3Referrals.map(ref => ({
          id: ref.id,
          phoneNumber: ref.phoneNumber,
          hasProduct: ref.hasProduct
        }))
      }
    });
  });

  // Get carousel images
  app.get("/api/carousel", async (req: Request, res: Response) => {
    const images = await storage.getActiveCarouselImages();
    res.json(images);
  });

  // Get about us text
  app.get("/api/about", async (req: Request, res: Response) => {
    const aboutUs = await storage.getSetting("aboutUs");
    res.json({ content: aboutUs ? aboutUs.value : "" });
  });

  // Set up daily task to update product days
  cron.schedule("0 0 * * *", async () => {
    await storage.updateUserProductDays();
    console.log("Updated product days remaining");
  });

  const httpServer = createServer(app);
  return httpServer;
}

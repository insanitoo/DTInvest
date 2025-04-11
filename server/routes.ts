import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";

// Middleware para verificar se o usuário é administrador
function isAdmin(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Não autenticado" });
  }
  if (!req.user.isAdmin) {
    return res.status(403).json({ message: "Acesso negado" });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication
  setupAuth(app);

  // API routes
  // Transactions
  app.get("/api/transactions", (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Não autenticado" });
    }

    storage.getTransactions(req.user.id)
      .then(transactions => {
        res.json(transactions);
      })
      .catch(next);
  });
  
  // Admin routes
  // Get admin stats (usuários, estatísticas, etc.)
  app.get("/api/admin/stats", isAdmin, async (req, res) => {
    try {
      // Buscar todos os usuários e transações reais
      const allTransactions = await storage.getAllTransactions();
      
      // Calcular os valores totais de depósitos e saques
      const deposits = allTransactions
        .filter(tx => tx.type === 'deposit')
        .reduce((sum, tx) => sum + tx.amount, 0);
        
      const withdrawals = allTransactions
        .filter(tx => tx.type === 'withdrawal')
        .reduce((sum, tx) => sum + tx.amount, 0);
      
      // Dados de produtos (ainda fixos até implementarmos o armazenamento de produtos)
      const popularProducts = [
        {
          productId: 1,
          name: "Produto Premium",
          count: 10
        },
        {
          productId: 2,
          name: "Produto Básico",
          count: 5
        }
      ];
      
      // Contar o número total de usuários
      const users = await storage.getAllUsers();
      const totalUsers = users.length;
      
      const adminStats = {
        totalUsers,
        totalDeposits: deposits,
        totalWithdrawals: withdrawals,
        popularProducts
      };
      
      res.json(adminStats);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar estatísticas" });
    }
  });
  
  // Lista de todos os usuários
  app.get("/api/admin/users", isAdmin, async (req, res) => {
    try {
      // Buscar usuários reais
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar usuários" });
    }
  });
  
  // Lista de todas as transações
  app.get("/api/admin/transactions", isAdmin, async (req, res) => {
    try {
      // Buscar todas as transações reais do banco de dados
      const realTransactions = await storage.getAllTransactions();
      res.json(realTransactions);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar transações" });
    }
  });
  
  // Lista de produtos
  app.get("/api/admin/products", isAdmin, (req, res) => {
    // Para o protótipo, retornamos produtos de exemplo
    const products = [
      {
        id: 1,
        name: "Produto Premium",
        description: "Produto com alto retorno",
        price: 5000,
        returnRate: 3.0,
        cycleDays: 30,
        dailyIncome: 500,
        totalReturn: 15000,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 2,
        name: "Produto Básico",
        description: "Produto para iniciantes",
        price: 2000,
        returnRate: 2.0,
        cycleDays: 30,
        dailyIncome: 133,
        totalReturn: 4000,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    res.json(products);
  });
  
  // Criar produto
  app.post("/api/admin/products", isAdmin, (req, res) => {
    // Para o protótipo, fingimos que criamos o produto e retornamos o que foi enviado
    const product = {
      id: 3, // ID simulado
      ...req.body,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    res.status(201).json(product);
  });

  // Deposits
  app.post("/api/deposits", (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Não autenticado" });
    }

    const { amount } = req.body;

    if (!amount || amount < 1000) {
      return res.status(400).json({ message: "Valor mínimo para depósito é KZ 1000" });
    }

    storage.createTransaction({
      userId: req.user.id,
      type: "deposit",
      amount,
      status: "pending",
      bankAccount: null
    })
      .then(transaction => {
        res.status(201).json(transaction);
      })
      .catch(next);
  });

  // Withdrawals
  app.post("/api/withdrawals", async (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Não autenticado" });
    }

    const { amount } = req.body;
    const userId = req.user.id;

    try {
      if (!amount || amount < 2000) {
        return res.status(400).json({ message: "Valor mínimo para saque é KZ 2000" });
      }

      // Check user balance
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      if (user.balance < amount) {
        return res.status(400).json({ message: "Saldo insuficiente" });
      }

      // Check if user has products
      if (!user.hasProduct) {
        return res.status(400).json({ message: "É necessário comprar um produto antes de fazer saques" });
      }

      // Check if user has deposited before
      if (!user.hasDeposited) {
        return res.status(400).json({ message: "É necessário fazer um depósito antes de fazer saques" });
      }

      // Get bank info
      const bankInfo = await storage.getBankInfoByUserId(userId);
      if (!bankInfo) {
        return res.status(400).json({ message: "Configure suas informações bancárias antes de fazer saques" });
      }

      // Create withdrawal transaction
      const transaction = await storage.createTransaction({
        userId,
        type: "withdrawal",
        amount,
        status: "pending",
        bankAccount: `${bankInfo.bank} - ${bankInfo.accountNumber}`
      });

      // Update user balance
      const newBalance = user.balance - amount;
      await storage.updateUserBalance(userId, newBalance);

      return res.status(201).json(transaction);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/user/bank", async (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Não autenticado" });
    }

    const userId = req.user.id;
    const { bank, ownerName, accountNumber } = req.body;

    if (!bank || !ownerName || !accountNumber) {
      return res.status(400).json({ message: "Todos os campos são obrigatórios" });
    }

    try {
      // Primeiro verifica se já existe informação bancária
      const existingBank = await storage.getBankInfoByUserId(userId);
      if (existingBank) {
        // Se existe, atualiza
        const bankInfo = await storage.updateBankInfo(userId, { 
          bank, 
          ownerName, 
          accountNumber, 
          userId 
        });
        return res.status(200).json(bankInfo);
      } else {
        // Se não existe, cria novo
        const bankInfo = await storage.createBankInfo(userId, { 
          bank, 
          ownerName, 
          accountNumber, 
          userId 
        });
        return res.status(201).json(bankInfo);
      }
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/user/bank", async (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Não autenticado" });
    }

    try {
      await storage.deleteBankInfo(req.user.id);
      res.status(200).json({ message: "Informações bancárias removidas com sucesso" });
    } catch (error) {
      next(error);
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
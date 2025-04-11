import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";

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
        const bankInfo = await storage.updateBankInfo(userId, { bank, ownerName, accountNumber });
        return res.status(200).json(bankInfo);
      } else {
        // Se não existe, cria novo
        const bankInfo = await storage.createBankInfo(userId, { bank, ownerName, accountNumber });
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
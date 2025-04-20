import { Express, Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { storage } from "./storage";
import { insertProductSchema, insertBankSchema, insertSettingSchema, insertCarouselImageSchema, updateTransactionSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

// Middleware to check if user is an admin
function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Não autenticado" });
  }
  if (!req.user.isAdmin) {
    return res.status(403).json({ message: "Acesso não autorizado" });
  }
  return next();
}

export function setupAdminRoutes(app: Express) {
  // Get admin dashboard stats
  app.get("/api/admin/stats", isAdmin, async (req: Request, res: Response) => {
    try {
      const totalUsers = await storage.getTotalUsers();
      const totalDeposits = await storage.getTotalDeposits();
      const totalWithdrawals = await storage.getTotalWithdrawals();
      const popularProducts = await storage.getPopularProducts();
      
      res.json({
        totalUsers,
        totalDeposits,
        totalWithdrawals,
        popularProducts
      });
    } catch (error) {
      res.status(500).json({ message: "Erro ao obter estatísticas" });
    }
  });

  // Get all users
  app.get("/api/admin/users", isAdmin, async (req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Erro ao obter usuários" });
    }
  });

  // Get user detail
  app.get("/api/admin/users/:id", isAdmin, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Erro ao obter usuário" });
    }
  });

  // Block/unblock user
  app.put("/api/admin/users/:id/block", isAdmin, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const { isBlocked } = req.body;
      
      if (typeof isBlocked !== 'boolean') {
        return res.status(400).json({ message: "Parâmetro 'isBlocked' deve ser um booleano" });
      }
      
      const user = await storage.blockUser(userId, isBlocked);
      
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Erro ao atualizar usuário" });
    }
  });

  // Get all transactions
  app.get("/api/admin/transactions", isAdmin, async (req: Request, res: Response) => {
    try {
      const transactions = await storage.getAllTransactions();
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Erro ao obter transações" });
    }
  });

  // Get specific transaction
  app.get("/api/admin/transactions/:id", isAdmin, async (req: Request, res: Response) => {
    try {
      const transactionId = parseInt(req.params.id);
      const transaction = await storage.getTransaction(transactionId);
      
      if (!transaction) {
        return res.status(404).json({ message: "Transação não encontrada" });
      }
      
      res.json(transaction);
    } catch (error) {
      res.status(500).json({ message: "Erro ao obter transação" });
    }
  });

  // Update transaction status
  app.put("/api/admin/transactions/:id", isAdmin, async (req: Request, res: Response) => {
    try {
      const transactionId = parseInt(req.params.id);
      
      console.log('Dados recebidos:', req.body);
      
      let validatedData;
      try {
        validatedData = updateTransactionSchema.parse(req.body);
      } catch (validationError) {
        console.error('Erro detalhado de validação:', validationError);
        if (validationError instanceof ZodError) {
          return res.status(400).json({
            error: 'Erro de validação',
            details: validationError.errors.map(err => ({
              path: err.path.join('.'),
              message: err.message,
              received: err.received
            }))
          });
        }
        return res.status(400).json({ 
          error: 'Erro de validação',
          details: validationError instanceof Error ? validationError.message : 'Erro desconhecido'
        });
      }

      const { status } = validatedData;
      console.log(`Atualizando transação ${transactionId} para status: ${status}`);
      
      // Obter a transação atual para verificar se existe
      const existingTransaction = await storage.getTransaction(transactionId);
      if (!existingTransaction) {
        return res.status(404).json({ message: "Transação não encontrada" });
      }
      
      console.log('Transação atual:', existingTransaction);
      
      // Atualizar o status
      try {
        const updatedTransaction = await storage.updateTransactionStatus(transactionId, status);
        console.log('Transação atualizada com sucesso:', updatedTransaction);
        
        // Atualiza o cache das transações do usuário também
        await storage.getTransactions(updatedTransaction.userId);
        
        // Agora antes de retornar, buscamos todas as transações do usuário para garantir que o cache esteja atualizado
        const userTransactions = await storage.getTransactions(updatedTransaction.userId);
        console.log(`Transações do usuário ${updatedTransaction.userId} atualizadas no servidor:`, userTransactions);
        
        // Buscar todas as transações também para atualizar o cache de admin
        const allTransactions = await storage.getAllTransactions();
        console.log('Todas as transações atualizadas no servidor:', allTransactions);
        
        // Garante que o corpo da resposta seja sempre um JSON válido com a transação atualizada
        return res.status(200).json({ 
          success: true, 
          transaction: updatedTransaction,
          updatedAt: new Date().toISOString()
        });
      } catch (error) {
        console.error('Erro ao atualizar transação:', error);
        throw error;
      }
    } catch (error) {
      console.error('Erro geral ao processar atualização:', error);
      
      if (error instanceof Error) {
        return res.status(500).json({ message: error.message || "Erro ao atualizar transação" });
      }
      
      res.status(500).json({ message: "Erro ao atualizar transação" });
    }
  });

  // Get all products
  app.get("/api/admin/products", isAdmin, async (req: Request, res: Response) => {
    try {
      const products = await storage.getAllProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Erro ao obter produtos" });
    }
  });

  // Create product
  app.post("/api/admin/products", isAdmin, async (req: Request, res: Response) => {
    try {
      const productData = insertProductSchema.parse(req.body);
      
      const product = await storage.createProduct(productData);
      res.status(201).json(product);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        res.status(500).json({ message: "Erro ao criar produto" });
      }
    }
  });

  // Update product
  app.put("/api/admin/products/:id", isAdmin, async (req: Request, res: Response) => {
    try {
      const productId = parseInt(req.params.id);
      
      const product = await storage.updateProduct(productId, req.body);
      
      if (!product) {
        return res.status(404).json({ message: "Produto não encontrado" });
      }
      
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Erro ao atualizar produto" });
    }
  });

  // Delete product
  app.delete("/api/admin/products/:id", isAdmin, async (req: Request, res: Response) => {
    try {
      const productId = parseInt(req.params.id);
      
      const success = await storage.deleteProduct(productId);
      
      if (!success) {
        return res.status(404).json({ message: "Produto não encontrado" });
      }
      
      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir produto" });
    }
  });

  // Get all banks
  app.get("/api/admin/banks", isAdmin, async (req: Request, res: Response) => {
    try {
      const banks = await storage.getAllBanks();
      res.json(banks);
    } catch (error) {
      res.status(500).json({ message: "Erro ao obter bancos" });
    }
  });

  // Create bank
  app.post("/api/admin/banks", isAdmin, async (req: Request, res: Response) => {
    try {
      const bankData = insertBankSchema.parse(req.body);
      
      const bank = await storage.createBank(bankData);
      res.status(201).json(bank);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        res.status(500).json({ message: "Erro ao criar banco" });
      }
    }
  });

  // Update bank
  app.put("/api/admin/banks/:id", isAdmin, async (req: Request, res: Response) => {
    try {
      const bankId = parseInt(req.params.id);
      
      const bank = await storage.updateBank(bankId, req.body);
      
      if (!bank) {
        return res.status(404).json({ message: "Banco não encontrado" });
      }
      
      res.json(bank);
    } catch (error) {
      res.status(500).json({ message: "Erro ao atualizar banco" });
    }
  });

  // Delete bank
  app.delete("/api/admin/banks/:id", isAdmin, async (req: Request, res: Response) => {
    try {
      const bankId = parseInt(req.params.id);
      
      const success = await storage.deleteBank(bankId);
      
      if (!success) {
        return res.status(404).json({ message: "Banco não encontrado" });
      }
      
      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir banco" });
    }
  });

  // Get all settings
  app.get("/api/admin/settings", isAdmin, async (req: Request, res: Response) => {
    try {
      const settings = await storage.getAllSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Erro ao obter configurações" });
    }
  });

  // Update or create setting
  app.put("/api/admin/settings/:key", isAdmin, async (req: Request, res: Response) => {
    try {
      const key = req.params.key;
      const { value } = req.body;
      
      if (typeof value !== 'string') {
        return res.status(400).json({ message: "Valor deve ser uma string" });
      }
      
      let setting = await storage.getSetting(key);
      
      if (setting) {
        setting = await storage.updateSetting(key, value);
      } else {
        setting = await storage.createSetting({ key, value });
      }
      
      res.json(setting);
    } catch (error) {
      res.status(500).json({ message: "Erro ao atualizar configuração" });
    }
  });

  // Get all carousel images
  app.get("/api/admin/carousel", isAdmin, async (req: Request, res: Response) => {
    try {
      const images = await storage.getAllCarouselImages();
      res.json(images);
    } catch (error) {
      res.status(500).json({ message: "Erro ao obter imagens do carrossel" });
    }
  });

  // Create carousel image
  app.post("/api/admin/carousel", isAdmin, async (req: Request, res: Response) => {
    try {
      const imageData = insertCarouselImageSchema.parse(req.body);
      
      const image = await storage.createCarouselImage(imageData);
      res.status(201).json(image);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        res.status(500).json({ message: "Erro ao criar imagem do carrossel" });
      }
    }
  });

  // Update carousel image
  app.put("/api/admin/carousel/:id", isAdmin, async (req: Request, res: Response) => {
    try {
      const imageId = parseInt(req.params.id);
      
      const image = await storage.updateCarouselImage(imageId, req.body);
      
      if (!image) {
        return res.status(404).json({ message: "Imagem não encontrada" });
      }
      
      res.json(image);
    } catch (error) {
      res.status(500).json({ message: "Erro ao atualizar imagem do carrossel" });
    }
  });

  // Delete carousel image
  app.delete("/api/admin/carousel/:id", isAdmin, async (req: Request, res: Response) => {
    try {
      const imageId = parseInt(req.params.id);
      
      const success = await storage.deleteCarouselImage(imageId);
      
      if (!success) {
        return res.status(404).json({ message: "Imagem não encontrada" });
      }
      
      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir imagem do carrossel" });
    }
  });
}

import { Express, Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { storage } from "./storage";
import { insertProductSchema, insertBankSchema, insertSettingSchema, insertCarouselImageSchema, updateTransactionSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { hashPassword } from "./auth";

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
  // Rota para redefinir senha de usuário (apenas admin)
  app.post("/api/admin/reset-password", isAdmin, async (req: Request, res: Response) => {
    try {
      const { phoneNumber, newPassword } = req.body;
      
      if (!phoneNumber || !newPassword) {
        return res.status(400).json({ 
          success: false, 
          message: "Número de telefone e nova senha são obrigatórios" 
        });
      }

      // Verificar se o usuário existe
      const user = await storage.getUserByPhoneNumber(phoneNumber);
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          message: "Usuário não encontrado" 
        });
      }

      // Gerar hash da nova senha
      const hashedPassword = await hashPassword(newPassword);
      
      // Atualizar o usuário com a nova senha
      const updatedUser = await storage.updateUser(user.id, {
        password: hashedPassword
      });

      // Responder com sucesso
      res.status(200).json({ 
        success: true, 
        message: `Senha redefinida com sucesso para o usuário ${phoneNumber}` 
      });
    } catch (error: any) {
      console.error("Erro ao redefinir senha:", error);
      res.status(500).json({ 
        success: false, 
        message: "Erro ao redefinir senha do usuário", 
        error: error.message 
      });
    }
  });
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

      // Buscar referrals para o admin ver (item 1 e 9 da lista)
      const allUsers = await storage.getAllUsers();
      
      // MODIFICAÇÃO: Agora o referred_by armazena o número de telefone do referenciador, não o código
      // Referrals nível 1
      const level1Referrals = allUsers.filter(u => u.referredBy === user.phoneNumber)
        .map(u => ({
          id: u.id,
          phoneNumber: u.phoneNumber,
          hasProduct: u.hasProduct,
          balance: u.balance,
        }));

      // Referrals nível 2
      // Precisamos usar o número de telefone de cada usuário nível 1 para buscar os nível 2
      const level1PhoneNumbers = level1Referrals.map(r => 
        allUsers.find(u => u.id === r.id)?.phoneNumber
      ).filter(Boolean);
      
      const level2Referrals = allUsers.filter(u => 
        u.referredBy && level1PhoneNumbers.includes(u.referredBy)
      ).map(u => ({
        id: u.id,
        phoneNumber: u.phoneNumber,
        hasProduct: u.hasProduct,
        balance: u.balance,
      }));

      // Referrals nível 3
      // Precisamos usar o número de telefone de cada usuário nível 2 para buscar os nível 3
      const level2PhoneNumbers = level2Referrals.map(r => 
        allUsers.find(u => u.id === r.id)?.phoneNumber
      ).filter(Boolean);
      
      const level3Referrals = allUsers.filter(u => 
        u.referredBy && level2PhoneNumbers.includes(u.referredBy)
      ).map(u => ({
        id: u.id,
        phoneNumber: u.phoneNumber,
        hasProduct: u.hasProduct,
        balance: u.balance,
      }));
      
      // Adicionar contagem de referrals ao usuário
      const userWithReferrals = {
        ...user,
        referrals: {
          level1: level1Referrals,
          level2: level2Referrals,
          level3: level3Referrals,
          counts: {
            level1: level1Referrals.length,
            level2: level2Referrals.length, 
            level3: level3Referrals.length
          }
        }
      };
      
      res.json(userWithReferrals);
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

  // Get withdrawal requests
  app.get("/api/admin/withdrawal-requests", isAdmin, async (req: Request, res: Response) => {
    try {
      const withdrawalRequests = await storage.getWithdrawalRequests();
      res.json(withdrawalRequests);
    } catch (error) {
      res.status(500).json({ 
        error: "Erro ao buscar solicitações de saque", 
        message: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Get all transactions
  app.get("/api/admin/transactions", isAdmin, async (req: Request, res: Response) => {
    try {
      console.log('Buscando todas as transações para admin...');
      const transactions = await storage.getAllTransactions();
      console.log(`Total de transações encontradas: ${transactions.length}`);
      console.log('IDs das transações disponíveis:', transactions.map(t => t.id));
      console.log('Transações:', transactions);
      res.json(transactions);
    } catch (error) {
      console.error('Erro ao buscar transações:', error);
      res.status(500).json({ 
        message: "Erro ao obter transações",
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
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

  // Atualizar status de transação - NOVO SISTEMA 
  app.put("/api/admin/transactions/:id", isAdmin, async (req: Request, res: Response) => {
    /*******************************************************************
     * IMPLEMENTAÇÃO NOVA E SIMPLIFICADA PARA ATUALIZAÇÃO DE TRANSAÇÕES
     * Criado do zero para garantir robustez e consistência
     * Versão 1.0 - Abril 2025 
     *******************************************************************/

    try {
      console.log(`\n=== ADMIN API >>> INÍCIO ATUALIZAÇÃO DE TRANSAÇÃO ===\n`);
      const transactionId = req.params.id; // Changed to string

      // ETAPA 1: Validação básica da requisição
      if (!req.body || typeof req.body !== 'object') {
        console.error('ADMIN API >>> Corpo da requisição inválido');
        return res.status(400).json({
          success: false,
          message: "Corpo da requisição inválido"
        });
      }

      console.log('ADMIN API >>> Dados recebidos:', req.body);

      // ETAPA 2: Validar o status solicitado
      const status = req.body.status;
      const validStatuses = ['pending', 'processing', 'completed', 'failed'];

      if (!status || typeof status !== 'string' || !validStatuses.includes(status)) {
        console.error(`ADMIN API >>> Status inválido: '${status}'`);
        return res.status(400).json({
          success: false,
          message: `Status inválido. Valores permitidos: ${validStatuses.join(', ')}`
        });
      }

      console.log(`ADMIN API >>> Atualizando transação ${transactionId} para status: ${status}`);

      // ETAPA 3: Verificar se a transação existe
      // CORREÇÃO: Tentar encontrar transação primeiro por ID interno (número) e depois por transactionId
      let transaction;
      
      // Tentar primeiro como ID interno
      const numericId = parseInt(transactionId);
      if (!isNaN(numericId)) {
        console.log(`ADMIN API >>> Tentando buscar transação pelo ID interno ${numericId}`);
        transaction = await storage.getTransaction(numericId);
      }
      
      // Se não encontrou por ID interno, buscar por transactionId
      if (!transaction) {
        console.log(`ADMIN API >>> Tentando buscar transação pelo transactionId ${transactionId}`);
        transaction = await storage.getTransactionByTransactionId(transactionId);
      }
      
      // Se ainda não encontrou, mostrar erro
      if (!transaction) {
        // Log para diagnóstico
        console.error(`ADMIN API >>> Transação ${transactionId} não encontrada`);
        console.log(`ADMIN API >>> Listando algumas transações disponíveis para depuração:`);
        
        const allTransactions = await storage.getAllTransactions();
        const sampleTransactions = allTransactions.slice(0, Math.min(5, allTransactions.length));
        
        console.log(sampleTransactions.map(t => ({
          id: t.id,
          transactionId: t.transactionId,
          type: t.type,
          amount: t.amount
        })));
        
        return res.status(404).json({
          success: false,
          message: "Transação não encontrada"
        });
      }

      // ETAPA 4: Verificar usuário antes da atualização (para diagnóstico posterior)
      const userBefore = await storage.getUser(transaction.userId);
      if (!userBefore) {
        console.error(`ADMIN API >>> Usuário ${transaction.userId} não encontrado`);
        return res.status(500).json({
          success: false,
          message: "Usuário da transação não encontrado"
        });
      }

      console.log(`ADMIN API >>> Usuário ${userBefore.phoneNumber}, Saldo atual: ${userBefore.balance}`);

      // Para fins de diagnóstico, calcular o saldo esperado após a operação
      const expectedBalance = (status === 'completed' && transaction.type === 'deposit') 
        ? userBefore.balance + transaction.amount
        : userBefore.balance;

      // ETAPA 5: Realizar a atualização da transação
      console.log(`ADMIN API >>> Executando atualização para status ${status}...`);
      try {
        // Chamada para o novo sistema de atualização de transações
        const startTime = Date.now();
        const updatedTransaction = await storage.updateTransactionStatus(transactionId, status);
        const endTime = Date.now();

        console.log(`ADMIN API >>> Atualização concluída em ${endTime - startTime}ms`);
        console.log(`ADMIN API >>> Transação ${transactionId} processada`);

        // ETAPA 6: Verificar resultado da operação - usuário após a atualização
        const userAfter = await storage.getUser(transaction.userId);
        if (!userAfter) {
          throw new Error(`Usuário ${transaction.userId} não encontrado após atualização`);
        }

        console.log(`ADMIN API >>> Saldo antes: ${userBefore.balance}, Saldo depois: ${userAfter.balance}`);

        // Verificar se o saldo foi atualizado corretamente para depósitos concluídos
        const balanceUpdated = (status === 'completed' && transaction.type === 'deposit') 
          ? Math.abs(userAfter.balance - expectedBalance) < 0.01 
          : true;

        if (!balanceUpdated) {
          console.error(`ADMIN API >>> ALERTA: Saldo não foi atualizado corretamente!`);
          console.error(`ADMIN API >>> Esperado: ${expectedBalance}, Atual: ${userAfter.balance}`);
        } else {
          console.log(`ADMIN API >>> Verificação de saldo OK`);
        }

        // ETAPA 7: Montar resposta detalhada com dados atualizados
        console.log(`ADMIN API >>> Preparando resposta para o cliente...`);

        // Garantir cabeçalhos corretos para prevenir problemas no cliente
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');

        // Construir resposta completa com todas as informações necessárias
        const responseData = {
          success: true,
          message: "Transação atualizada com sucesso",
          transaction: {
            id: updatedTransaction.id,
            userId: updatedTransaction.userId,
            type: updatedTransaction.type,
            amount: updatedTransaction.amount,
            createdAt: updatedTransaction.createdAt,
            bankAccount: updatedTransaction.bankAccount || null,
            bankName: updatedTransaction.bankName || null,
            receipt: updatedTransaction.receipt || null,
            transactionId: updatedTransaction.transactionId || null
          },
          user: {
            id: userAfter.id,
            phoneNumber: userAfter.phoneNumber,
            balance: userAfter.balance,
            hasDeposited: userAfter.hasDeposited,
            hasProduct: userAfter.hasProduct,
            // Informações adicionais para auditoria
            previousBalance: userBefore.balance,
            balanceChange: userAfter.balance - userBefore.balance
          },
          meta: {
            processedAt: new Date().toISOString(),
            expectedBalance: expectedBalance,
            balanceUpdated: balanceUpdated,
            processingTime: `${endTime - startTime}ms`,
            transactionType: transaction.type,
            requestedStatus: status
          }
        };

        // CORRIGIDO: Enviar resposta com res.json() em vez de res.send() para garantir Content-Type correto
        console.log(`ADMIN API >>> Enviando resposta JSON...`);
        console.log(`\n=== ADMIN API >>> FIM ATUALIZAÇÃO DE TRANSAÇÃO ===\n`);
        return res.status(200).json(responseData);

      } catch (error) {
        console.error('ADMIN API >>> Erro durante atualização:', error);
        return res.status(500).json({
          success: false,
          message: error instanceof Error ? error.message : "Erro desconhecido durante atualização",
          error: String(error)
        });
      }
    } catch (error) {
      console.error('ADMIN API >>> Erro geral:', error);
      return res.status(500).json({
        success: false,
        message: "Erro ao processar solicitação",
        error: error instanceof Error ? error.message : String(error)
      });
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
  
  // Aprovar solicitação de saque
  app.put("/api/admin/withdrawal/:id/approve", isAdmin, async (req: Request, res: Response) => {
    try {
      const withdrawalId = parseInt(req.params.id);
      
      // Aprovar o saque e criar transação correspondente
      const transaction = await storage.approveWithdrawalRequest(withdrawalId, req.user?.id || 0);
      
      // Atualizar o status da transação para "completed"
      await storage.updateTransactionStatus(transaction.id, "completed");
      
      res.status(200).json({ 
        success: true, 
        message: "Saque aprovado com sucesso", 
        transaction
      });
    } catch (error: any) {
      console.error("Erro ao aprovar saque:", error);
      res.status(500).json({ 
        success: false, 
        message: error.message || "Erro ao aprovar saque" 
      });
    }
  });

  // Rejeitar solicitação de saque (devolvendo o valor integral)
  app.put("/api/admin/withdrawal/:id/reject", isAdmin, async (req: Request, res: Response) => {
    try {
      const withdrawalId = parseInt(req.params.id);
      
      // Rejeitar o saque e devolver o valor integral
      const transaction = await storage.rejectWithdrawalRequest(withdrawalId, req.user?.id || 0);
      
      // Atualizar o status da transação para "failed" (mas o valor já foi devolvido)
      await storage.updateTransactionStatus(transaction.id, "failed");
      
      res.status(200).json({ 
        success: true, 
        message: "Saque rejeitado com sucesso. O valor foi devolvido integralmente ao usuário.", 
        transaction
      });
    } catch (error: any) {
      console.error("Erro ao rejeitar saque:", error);
      res.status(500).json({ 
        success: false, 
        message: error.message || "Erro ao rejeitar saque" 
      });
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
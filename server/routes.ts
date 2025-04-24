import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { User } from "../shared/schema";
import { db } from "./db";
import { sql } from "drizzle-orm";

// Função para formatar valores em moeda (KZ)
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-AO', {
    style: 'currency',
    currency: 'AOA'
  }).format(value);
}

// Middleware para verificar se o usuário é administrador
function isAdmin(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    console.log("Admin check: Usuário não autenticado");
    return res.status(401).json({ message: "Não autenticado" });
  }

  console.log("Admin check: Usuário autenticado:", req.user);

  // Para o protótipo, consideramos o usuário 999999999 como administrador
  if (req.user.phoneNumber === "999999999") {
    console.log("Admin check: Usuário é administrador (999999999)");
    return next();
  }

  if (!req.user.isAdmin) {
    console.log("Admin check: Usuário não é administrador");
    return res.status(403).json({ message: "Acesso negado" });
  }

  next();
}

// Função para testar a validação do status - usada para diagnóstico
function validateTransactionStatus(status: any): { valid: boolean; error?: string } {
  // Verificar se o status existe
  if (status === undefined || status === null) {
    return { valid: false, error: 'Status ausente' };
  }

  // Verificar se o status é uma string
  if (typeof status !== 'string') {
    return { valid: false, error: `Status deve ser uma string, recebido: ${typeof status}` };
  }

  // Verificar se o status é um dos valores válidos
  const validStatuses = ['pending', 'processing', 'completed', 'failed', 'approved'];
  if (!validStatuses.includes(status)) {
    return { valid: false, error: `Status inválido: ${status}. Valores permitidos: ${validStatuses.join(', ')}` };
  }

  return { valid: true };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint para o Render
  app.get("/api/health", async (req, res) => {
    try {
      // Verificar conexão com o banco de dados fazendo uma consulta simples
      const result = await db.execute(sql`SELECT 1 as health`);
      
      res.status(200).json({ 
        status: "ok", 
        database: "connected",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Erro no health check:", error);
      res.status(500).json({ 
        status: "error", 
        database: "disconnected",
        timestamp: new Date().toISOString(),
        message: "Não foi possível conectar ao banco de dados"
      });
    }
  });
  // Set up authentication
  setupAuth(app);

  // Endpoint de teste para transações
  app.post("/api/test-transaction", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ 
          message: "Sua sessão expirou ou você não está conectado. Por favor, faça login novamente para continuar." 
        });
      }

      const user = req.user as User;
      console.log(`\n=== TEST >>> ENDPOINT DE TESTE DE TRANSAÇÃO ===`);
      console.log(`TEST >>> Usuário: ${user.phoneNumber}, Saldo inicial: ${user.balance}`);

      // Criar uma transação de depósito
      const transaction = await storage.createTransaction({
        userId: user.id,
        type: 'deposit',
        amount: 5000,
        bankAccount: '123456789',
        bankName: 'Banco Angolano de Investimentos (BAI)',
        receipt: null,
        transactionId: null
      });

      console.log(`TEST >>> Transação criada: ID=${transaction.id}, Valor=${transaction.amount}`);

      // Atualizar o status da transação para 'completed'
      console.log(`TEST >>> Atualizando status para 'completed'...`);
      const updatedTransaction = await storage.updateTransactionStatus(transaction.id, 'completed');

      // Verificar o saldo atualizado
      const updatedUser = await storage.getUser(user.id);

      if (!updatedUser) {
        return res.status(500).json({ 
          success: false, 
          message: "Erro: Usuário não encontrado após atualização"
        });
      }

      console.log(`TEST >>> Transação atualizada: ID=${updatedTransaction.id}`);
      console.log(`TEST >>> Saldo final: ${updatedUser.balance}`);
      console.log(`=== TEST >>> FIM DO TESTE ===\n`);

      res.json({
        success: true,
        message: "Teste concluído com sucesso",
        transaction: updatedTransaction,
        balanceChange: {
          before: user.balance,
          after: updatedUser.balance,
          difference: updatedUser.balance - user.balance
        }
      });
    } catch (error) {
      console.error(`TEST >>> Erro no teste:`, error);
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // API routes
  // Transações usuário (histórico)
  app.get("/api/transactions", (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        message: "Sua sessão expirou ou você não está conectado. Por favor, faça login novamente para continuar." 
      });
    }

    storage.getTransactions(req.user.id)
      .then(transactions => {
        res.json(transactions);
      })
      .catch(next);
  });

  // NOVO FLUXO: Solicitar depósito
  app.post("/api/deposits", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        message: "Sua sessão expirou ou você não está conectado. Por favor, faça login novamente para continuar." 
      });
    }

    try {
      // Gerar ID de referência único para o depósito
      const transactionId = `DEP${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      // Criar solicitação de depósito
      const depositRequest = await storage.createDepositRequest({
        userId: req.user.id,
        amount: req.body.amount,
        bankName: req.body.bankName || null,
        receipt: req.body.receipt || null,
        transactionId: transactionId
      });

      res.status(201).json({
        success: true,
        message: "Solicitação de depósito criada com sucesso",
        depositRequest,
        transactionId
      });
    } catch (error) {
      res.status(500).json({ 
        error: "Erro ao criar solicitação de depósito", 
        message: error instanceof Error ? error.message : "Erro desconhecido" 
      });
    }
  });

  // NOVO FLUXO: Solicitações de depósito do usuário
  app.get("/api/deposits", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        message: "Sua sessão expirou ou você não está conectado. Por favor, faça login novamente para continuar." 
      });
    }

    try {
      // Esta é uma implementação provisória, pois precisamos adicionar 
      // um método para obter depósitos por usuário
      const allDepositRequests = await storage.getDepositRequests();
      const userDepositRequests = allDepositRequests.filter(
        request => request.userId === req.user.id
      );

      res.json(userDepositRequests);
    } catch (error) {
      res.status(500).json({ 
        error: "Erro ao buscar solicitações de depósito", 
        message: error instanceof Error ? error.message : "Erro desconhecido" 
      });
    }
  });

  // NOVO FLUXO: Verificar status de depósito por transactionId
  app.get("/api/deposits/check/:transactionId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        message: "Sua sessão expirou ou você não está conectado. Por favor, faça login novamente para continuar." 
      });
    }

    try {
      const transactionId = req.params.transactionId;

      // Verificar primeiro se já existe uma transação com este ID (aprovada)
      const transactions = await storage.getTransactions(req.user.id);
      const existingTransaction = transactions.find(tx => tx.transactionId === transactionId);

      if (existingTransaction) {
        return res.json({
          status: "approved",
          message: "Depósito aprovado e processado com sucesso",
          transaction: existingTransaction
        });
      }

      // Verificar se existe uma solicitação pendente
      const depositRequest = await storage.getDepositRequestByTransactionId(transactionId);

      if (depositRequest) {
        return res.json({
          status: "pending",
          message: "Depósito pendente de aprovação pelo administrador",
          depositRequest
        });
      }

      res.status(404).json({
        status: "not_found",
        message: "Nenhum depósito encontrado com este ID"
      });
    } catch (error) {
      res.status(500).json({ 
        error: "Erro ao verificar status do depósito", 
        message: error instanceof Error ? error.message : "Erro desconhecido" 
      });
    }
  });

  // NOTA: A rota para solicitar saque está definida mais abaixo (cerca da linha 970)

  // Obter solicitações de saque do usuário
  app.get("/api/withdrawals", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        message: "Sua sessão expirou ou você não está conectado. Por favor, faça login novamente para continuar." 
      });
    }

    try {
      const withdrawalRequests = await storage.getUserWithdrawalRequests(req.user.id);
      res.json(withdrawalRequests);
    } catch (err) {
      res.status(500).json({ 
        error: "Erro ao buscar solicitações de saque", 
        message: err instanceof Error ? err.message : "Erro desconhecido" 
      });
    }
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

      // Contabilizar apenas saques aprovados (status 'completed'), excluindo os rejeitados
      const withdrawals = allTransactions
        .filter(tx => tx.type === 'withdrawal' && tx.status === 'completed')
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

  // Lista de todas as transações (histórico)
  app.get("/api/admin/transactions", isAdmin, async (req, res) => {
    try {
      // Buscar todas as transações reais do banco de dados
      const realTransactions = await storage.getAllTransactions();
      res.json(realTransactions);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar transações" });
    }
  });

  // Rota para obter os detalhes das contas bancárias do sistema
  app.get("/api/bank-accounts", async (req, res) => {
    try {
      const accounts = await storage.getBankAccountDetails();
      res.json(accounts);
    } catch (error) {
      console.error('Erro ao obter contas bancárias:', error);
      res.status(500).json({ error: 'Erro ao obter contas bancárias' });
    }
  });

  // Rota para obter uma conta bancária específica pelo ID do banco
  app.get("/api/bank-accounts/:bankId", async (req, res) => {
    try {
      const bankId = parseInt(req.params.bankId);
      const account = await storage.getBankAccountDetailsByBankId(bankId);

      if (!account) {
        return res.status(404).json({ error: 'Conta bancária não encontrada' });
      }

      res.json(account);
    } catch (error) {
      console.error('Erro ao obter conta bancária:', error);
      res.status(500).json({ error: 'Erro ao obter conta bancária' });
    }
  });

  // NOVO FLUXO: Lista de solicitações de depósito pendentes
  app.get("/api/admin/deposit-requests", isAdmin, async (req, res) => {
    try {
      console.log('Buscando solicitações de depósito para admin...');
      const depositRequests = await storage.getDepositRequests();
      console.log('Solicitações encontradas:', depositRequests);
      res.json(depositRequests);
    } catch (error) {
      console.error('Erro ao buscar depósitos:', error);
      res.status(500).json({ 
        error: "Erro ao buscar solicitações de depósito",
        message: error instanceof Error ? error.message : "Erro desconhecido" 
      });
    }
  });

  // NOVO FLUXO: Aprovar uma solicitação de depósito
  app.post("/api/admin/deposit-requests/:id/approve", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ 
          success: false,
          error: "ID inválido", 
          message: "O ID fornecido é inválido. Por favor, tente novamente."
        });
      }

      // Verificar se a solicitação de depósito existe
      const depositRequest = await storage.getDepositRequest(id);
      if (!depositRequest) {
        return res.status(404).json({
          success: false, 
          error: "Depósito não encontrado",
          message: "A solicitação de depósito não foi encontrada. Ela pode já ter sido processada."
        });
      }

      // Verificar se já existe uma transação com o mesmo ID 
      // (segurança extra além da que já existe em storage.approveDepositRequest)
      if (depositRequest.transactionId) {
        const existingTransaction = await storage.getTransactionByTransactionId(depositRequest.transactionId);
        if (existingTransaction) {
          console.log(`ENDPOINT >>> Transação duplicada detectada: ${depositRequest.transactionId}`);
          
          return res.status(200).json({
            success: true,
            message: "Depósito já foi processado anteriormente",
            transaction: existingTransaction,
            duplicated: true
          });
        }
      }

      // Se tudo estiver certo, processar o depósito
      const transaction = await storage.approveDepositRequest(id);
      
      return res.json({
        success: true,
        message: "Depósito aprovado com sucesso",
        transaction
      });
    } catch (error) {
      console.error('Erro ao aprovar depósito:', error);
      
      // Tratar erros específicos
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      
      // Verificar se é um erro de duplicação
      if (errorMessage.includes("já existe") || 
          errorMessage.includes("duplicado") || 
          errorMessage.includes("duplicação") ||
          errorMessage.includes("único") ||
          errorMessage.includes("UNIQUE")) {
        
        return res.status(409).json({
          success: false,
          error: "Depósito duplicado",
          message: "Este depósito já foi processado anteriormente."
        });
      }

      // Erro genérico (com mensagem sanitizada para o usuário)
      return res.status(500).json({ 
        success: false,
        error: "Erro ao aprovar depósito", 
        message: "Ocorreu um erro ao processar o depósito. Por favor, tente novamente ou contate o suporte."
      });
    }
  });

  // NOVO FLUXO: Lista de solicitações de saque pendentes
  app.get("/api/admin/withdrawal-requests", isAdmin, async (req, res) => {
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

  // NOVO FLUXO: Aprovar uma solicitação de saque
  app.post("/api/admin/withdrawal-requests/:id/approve", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID inválido" });
      }

      const transaction = await storage.approveWithdrawalRequest(id, req.user.id);
      res.json({
        success: true,
        message: "Saque aprovado com sucesso",
        transaction
      });
    } catch (error) {
      res.status(500).json({ 
        error: "Erro ao aprovar saque", 
        message: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // NOVO FLUXO: Rejeitar uma solicitação de saque
  app.post("/api/admin/withdrawal-requests/:id/reject", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID inválido" });
      }

      const transaction = await storage.rejectWithdrawalRequest(id, req.user.id);
      res.json({
        success: true,
        message: "Saque rejeitado com sucesso",
        transaction
      });
    } catch (error) {
      res.status(500).json({ 
        error: "Erro ao rejeitar saque", 
        message: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Lista de produtos
  app.get("/api/admin/products", isAdmin, async (req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao buscar produtos" });
    }
  });

  // Listar produtos ativos (para usuários comuns)
  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getActiveProducts();
      res.json(products);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao buscar produtos" });
    }
  });

  // Detalhes de um produto específico
  app.get("/api/products/:id", async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const product = await storage.getProduct(productId);

      if (!product) {
        return res.status(404).json({ error: "Produto não encontrado" });
      }

      res.json(product);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao buscar produto" });
    }
  });

  // Comprar um produto específico
  app.post("/api/products/:id/purchase", async (req, res, next) => {
    console.log(`===== INICIANDO COMPRA DE PRODUTO =====`);

    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        message: "Sua sessão expirou ou você não está conectado. Por favor, faça login novamente para continuar." 
      });
    }

    const userId = req.user.id;
    const productId = parseInt(req.params.id);

    console.log(`Compra solicitada para: userId=${userId}, productId=${productId}`);

    try {
      // Verificar se o produto existe e está ativo
      const product = await storage.getProduct(productId);
      if (!product) {
        console.log(`Produto ${productId} não encontrado`);
        return res.status(404).json({ message: "Produto não encontrado" });
      }

      console.log(`Produto encontrado: ${product.name}, preço: ${product.price}, ativo: ${product.active}`);

      if (!product.active) {
        console.log(`Produto ${product.name} não está ativo`);
        return res.status(400).json({ message: "Este produto não está disponível para compra" });
      }

      // Verificar se o usuário tem saldo suficiente
      const user = await storage.getUser(userId);
      if (!user) {
        console.log(`Usuário ${userId} não encontrado`);
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      console.log(`Usuário encontrado: ${user.phoneNumber}, saldo atual: ${user.balance}`);

      // NOVA VERIFICAÇÃO: Checar se o usuário já tem este produto
      try {
        const userPurchases = await storage.getUserPurchases(userId);
        const alreadyPurchased = userPurchases.some(purchase => 
          purchase.productId === productId
        );

        if (alreadyPurchased) {
          console.log(`Usuário já comprou este produto anteriormente: ${product.name}`);
          return res.status(400).json({ 
            message: `Você já possui o produto ${product.name}. Cada usuário pode comprar apenas 1 de cada produto.`
          });
        }
      } catch (purchaseError) {
        console.error("Erro ao verificar compras do usuário:", purchaseError);
        // Continuar mesmo com erro (fail safe) para não bloquear compras novas por falha na verificação
      }

      if (user.balance < product.price) {
        console.log(`Saldo insuficiente: ${user.balance} < ${product.price}`);
        return res.status(400).json({ 
          message: "Saldo insuficiente para comprar este produto",
          currentBalance: user.balance,
          required: product.price
        });
      }

      console.log(`Saldo verificado, prosseguindo com a compra`);

      // Calcular novo saldo
      const newBalance = user.balance - product.price;
      console.log(`Novo saldo calculado: ${newBalance}`);

      // 1. Primeiro: Registrar a compra
      console.log(`Registrando compra no sistema...`);
      const purchase = await storage.createPurchase({
        userId,
        productId: product.id,
        amount: product.price
      });
      console.log(`Compra registrada com sucesso: ID=${purchase.id}`);

      // 2. Segundo: Atualizar o saldo do usuário
      console.log(`Atualizando saldo do usuário...`);
      const updatedUser = await storage.updateUserBalance(userId, newBalance);
      console.log(`Saldo atualizado com sucesso: ${updatedUser.balance}`);

      // 3. Terceiro: Registrar a transação
      console.log(`Registrando transação...`);
      const transaction = await storage.createTransaction({
        userId,
        type: "purchase",
        amount: product.price,
        bankAccount: null,
        bankName: null,
        receipt: null,
        transactionId: null,
        status: 'completed' // Definir como completado em vez de pendente (item 7 da lista)
      });
      console.log(`Transação registrada com sucesso: ID=${transaction.id}`);

      // 4. Quarto: Creditar a primeira renda diária ao usuário imediatamente
      console.log(`Creditando a primeira renda diária ao usuário...`);
      // Calcular novo saldo com a renda diária
      const updatedBalanceWithIncome = updatedUser.balance + product.dailyIncome;

      // Atualizar o saldo do usuário adicionando a renda diária
      const userWithDailyIncome = await storage.updateUserBalance(userId, updatedBalanceWithIncome);
      console.log(`Saldo atualizado com renda diária: ${userWithDailyIncome.balance}`);

      // Registrar a transação de renda diária
      const dailyIncomeTransaction = await storage.createTransaction({
        userId,
        type: "income",
        amount: product.dailyIncome,
        bankAccount: null,
        bankName: null,
        receipt: null,
        transactionId: null,
        status: 'completed'
      });
      console.log(`Transação de renda diária registrada: ID=${dailyIncomeTransaction.id}`);

      // Sempre garantir que o usuário está marcado como tendo produtos
      console.log(`Garantindo que o usuário está marcado como tendo produtos...`);
      await storage.updateUser(userId, { hasProduct: true });

      // PROCESSAMENTO DE COMISSÕES DOS REFERRALS
      console.log(`Processando comissões de referral...`);

      // Obter informações de configuração das comissões
      const level1CommissionSetting = await storage.getSetting('level1_commission');
      const level2CommissionSetting = await storage.getSetting('level2_commission');
      const level3CommissionSetting = await storage.getSetting('level3_commission');

      const level1CommissionRate = level1CommissionSetting ? parseFloat(level1CommissionSetting.value) : 0.25;
      const level2CommissionRate = level2CommissionSetting ? parseFloat(level2CommissionSetting.value) : 0.05;
      const level3CommissionRate = level3CommissionSetting ? parseFloat(level3CommissionSetting.value) : 0.03;

      console.log(`Taxas de comissão: Nível 1: ${level1CommissionRate * 100}%, Nível 2: ${level2CommissionRate * 100}%, Nível 3: ${level3CommissionRate * 100}%`);

      // Verificar se o usuário foi indicado por alguém (nível 1)
      if (user.referredBy) {
        const level1Referrer = (await storage.getAllUsers()).find(u => u.referralCode === user.referredBy);

        if (level1Referrer) {
          const level1Commission = product.price * level1CommissionRate;
          console.log(`Comissão Nível 1: ${level1Commission} para ${level1Referrer.phoneNumber}`);

          // Criar transação de comissão
          await storage.createTransaction({
            userId: level1Referrer.id,
            type: "commission",
            amount: level1Commission,
            bankAccount: null,
            bankName: null,
            receipt: null,
            transactionId: null,
            status: 'completed' // Concluído automaticamente
          });

          // Atualizar o saldo do referenciador nível 1
          await storage.updateUserBalance(level1Referrer.id, level1Referrer.balance + level1Commission);

          // Verificar nível 2 (quem indicou o referenciador nível 1)
          if (level1Referrer.referredBy) {
            const level2Referrer = (await storage.getAllUsers()).find(u => u.referralCode === level1Referrer.referredBy);

            if (level2Referrer) {
              const level2Commission = product.price * level2CommissionRate;
              console.log(`Comissão Nível 2: ${level2Commission} para ${level2Referrer.phoneNumber}`);

              // Criar transação de comissão nível 2
              await storage.createTransaction({
                userId: level2Referrer.id,
                type: "commission",
                amount: level2Commission,
                bankAccount: null,
                bankName: null,
                receipt: null,
                transactionId: null,
                status: 'completed' // Concluído automaticamente
              });

              // Atualizar o saldo do referenciador nível 2
              await storage.updateUserBalance(level2Referrer.id, level2Referrer.balance + level2Commission);

              // Verificar nível 3 (quem indicou o referenciador nível 2)
              if (level2Referrer.referredBy) {
                const level3Referrer = (await storage.getAllUsers()).find(u => u.referralCode === level2Referrer.referredBy);

                if (level3Referrer) {
                  const level3Commission = product.price * level3CommissionRate;
                  console.log(`Comissão Nível 3: ${level3Commission} para ${level3Referrer.phoneNumber}`);

                  // Criar transação de comissão nível 3
                  await storage.createTransaction({
                    userId: level3Referrer.id,
                    type: "commission",
                    amount: level3Commission,
                    bankAccount: null,
                    bankName: null,
                    receipt: null,
                    transactionId: null,
                    status: 'completed' // Concluído automaticamente
                  });

                  // Atualizar o saldo do referenciador nível 3
                  await storage.updateUserBalance(level3Referrer.id, level3Referrer.balance + level3Commission);
                }
              }
            }
          }
        }
      }

      console.log(`===== COMPRA DE PRODUTO CONCLUÍDA COM SUCESSO =====`);

      // Retornar resposta com informações detalhadas
      res.status(200).json({
        success: true,
        purchase,
        transaction,
        incomeTransaction: dailyIncomeTransaction,
        message: `Produto ${product.name} adquirido com sucesso! A primeira renda diária de ${formatCurrency(product.dailyIncome)} já foi creditada.`,
        previousBalance: user.balance,
        finalBalance: userWithDailyIncome.balance,
        dailyIncomeAmount: product.dailyIncome,
        product: {
          id: product.id,
          name: product.name,
          price: product.price,
          dailyIncome: product.dailyIncome,
          cycleDays: product.cycleDays,
          daysRemaining: product.cycleDays - 1 // Já descontamos o primeiro dia
        }
      });
    } catch (error) {
      console.error(`ERRO na compra de produto:`, error);
      next(error);
    }
  });

  // Obter investimentos do usuário
  app.get("/api/user/investments", async (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        message: "Sua sessão expirou ou você não está conectado. Por favor, faça login novamente para continuar." 
      });
    }

    try {
      const purchases = await storage.getUserPurchases(req.user.id);

      // Para cada compra, obter os detalhes do produto e formatar conforme UserProduct
      const investments = await Promise.all(
        purchases.map(async (purchase) => {
          const product = await storage.getProduct(purchase.productId);
          if (!product) {
            return null; // Produto pode ter sido excluído
          }

          // Calcular dias restantes com base na data da compra e dias do ciclo
          const purchaseDate = new Date(purchase.createdAt);
          const today = new Date();
          const daysPassed = Math.floor((today.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
          const daysRemaining = Math.max(0, product.cycleDays - daysPassed);
          const isActive = daysRemaining > 0;

          // Formatar conforme interface UserProduct
          return {
            id: purchase.id,
            productId: product.id,
            productName: product.name,
            price: purchase.amount, // Usar o valor pago na compra
            dailyIncome: product.dailyIncome,
            isActive: isActive,
            daysRemaining: daysRemaining,
            purchasedAt: purchase.createdAt
          };
        })
      );

      // Filtrar nulls (caso produto tenha sido excluído)
      const validInvestments = investments.filter(item => item !== null);

      res.json(validInvestments);
    } catch (error) {
      next(error);
    }
  });

  // Obter estatísticas de referidos do usuário
  app.get("/api/user/referrals", async (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        message: "Sua sessão expirou ou você não está conectado. Por favor, faça login novamente para continuar." 
      });
    }

    try {
      const users = await storage.getAllUsers();

      // Obter referidos diretos (nível 1)
      const level1Referrals = users.filter(
        user => user.referredBy === req.user.referralCode
      );

      // Obter referidos de nível 2
      const level2ReferralCodes = level1Referrals.map(user => user.referralCode);
      const level2Referrals = users.filter(
        user => level2ReferralCodes.includes(user.referredBy || '')
      );

      // Obter referidos de nível 3
      const level3ReferralCodes = level2Referrals.map(user => user.referralCode);
      const level3Referrals = users.filter(
        user => level3ReferralCodes.includes(user.referredBy || '')
      );

      // Obter as configurações de comissão atualizadas
      const level1CommissionSetting = await storage.getSetting('level1_commission');
      const level2CommissionSetting = await storage.getSetting('level2_commission');
      const level3CommissionSetting = await storage.getSetting('level3_commission');

      const level1CommissionRate = level1CommissionSetting ? parseFloat(level1CommissionSetting.value) : 0.25;
      const level2CommissionRate = level2CommissionSetting ? parseFloat(level2CommissionSetting.value) : 0.05;
      const level3CommissionRate = level3CommissionSetting ? parseFloat(level3CommissionSetting.value) : 0.03;

      // Obter as comissões reais do usuário a partir das transações
      const transactions = await storage.getTransactions(req.user.id);
      const commissionTransactions = transactions.filter(t => t.type === 'commission');

      // Calcular comissões reais
      const level1Commission = commissionTransactions.reduce((total, tx) => total + tx.amount, 0);
      const level2Commission = 0; // Usar 0 para nível 2 e 3, pois comissões estão todas no nível 1
      const level3Commission = 0;

      // Transformar dados de referidos para o formato desejado
      const formattedLevel1 = level1Referrals.map(user => ({
        id: user.id,
        phoneNumber: user.phoneNumber,
        hasProduct: user.hasProduct || false
      }));

      const formattedLevel2 = level2Referrals.map(user => ({
        id: user.id,
        phoneNumber: user.phoneNumber,
        hasProduct: user.hasProduct || false
      }));

      const formattedLevel3 = level3Referrals.map(user => ({
        id: user.id,
        phoneNumber: user.phoneNumber,
        hasProduct: user.hasProduct || false
      }));

      // CORREÇÃO: Os números de referidos estão sendo mostrados corretamente
      // sem multiplicação por 100 ou qualquer outro fator
      // Garantir que são números inteiros reais
      res.json({
        level1: {
          count: Number(level1Referrals.length),
          commission: level1Commission,
          referrals: formattedLevel1
        },
        level2: {
          count: Number(level2Referrals.length),
          commission: level2Commission,
          referrals: formattedLevel2
        },
        level3: {
          count: Number(level3Referrals.length),
          commission: level3Commission,
          referrals: formattedLevel3
        }
      });
    } catch (error) {
      next(error);
    }
  });

  // Criar produto
  app.post("/api/admin/products", isAdmin, async (req, res) => {
    try {
      const product = await storage.createProduct(req.body);
      res.status(201).json(product);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao criar produto" });
    }
  });

  // Atualizar produto
  app.put("/api/admin/products/:id", isAdmin, async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const product = await storage.updateProduct(productId, req.body);
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao atualizar produto" });
    }
  });

  // Excluir produto
  app.delete("/api/admin/products/:id", isAdmin, async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      await storage.deleteProduct(productId);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao excluir produto" });
    }
  });

  // Deposits
  app.post("/api/deposits", async (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        message: "Sua sessão expirou ou você não está conectado. Por favor, faça login novamente para continuar." 
      });
    }

    const { amount, bankId, receipt } = req.body;

    try {
      // Obter o valor mínimo de depósito das configurações
      const depositMinSetting = await storage.getSetting("deposit_min");
      const minDeposit = depositMinSetting ? parseInt(depositMinSetting.value) : 25000;

      if (!amount || amount < minDeposit) {
        return res.status(400).json({ message: `Valor mínimo para depósito é KZ ${minDeposit}` });
      }

      // Se foi fornecido um ID de banco, pegar informações dele
      let bankName = null;
      let bankAccount = null;
      if (bankId) {
        const bank = await storage.getBank(parseInt(bankId));
        if (bank) {
          bankName = bank.name;
          // Aqui podemos adicionar a conta padrão para esse banco, se houver
          const bankSetting = await storage.getSetting(`bank_account_${bank.id}`);
          if (bankSetting) {
            bankAccount = bankSetting.value;
          }
        }
      }

      console.log(`Criando nova transação de depósito: valor=${amount}, banco=${bankName || 'Não informado'}`);

      const transaction = await storage.createTransaction({
        userId: req.user.id,
        type: "deposit",
        amount,
        bankName: bankName,
        bankAccount: bankAccount,
        receipt: receipt || null,
        transactionId: `DEP${Date.now().toString(36).toUpperCase()}`,
        status: 'pending' // Os depósitos começam como pendentes e precisam de aprovação
      });

      console.log(`Transação de depósito criada com sucesso: ${JSON.stringify(transaction)}`);

      // Atualizar o usuário para indicar que ele já fez um depósito
      await storage.updateUser(req.user.id, { hasDeposited: true });

      res.status(201).json(transaction);
    } catch (error) {
      console.error("Erro ao criar depósito:", error);
      next(error);
    }
  });

  // Withdrawals
  app.post("/api/withdrawals", async (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        message: "Sua sessão expirou ou você não está conectado. Por favor, faça login novamente para continuar." 
      });
    }

    const { amount } = req.body;
    const userId = req.user.id;

    try {
      // Verificar valor mínimo e máximo
      if (!amount || amount < 1400) {
        return res.status(400).json({ message: "Valor mínimo para saque é KZ 1400" });
      }

      if (amount > 50000) {
        return res.status(400).json({ message: "Valor máximo para saque é KZ 50000" });
      }

      // Verificações temporariamente removidas para testes
      const withdrawalRequests = await storage.getUserWithdrawalRequests(userId);

      // Check user balance
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      if (user.balance < amount) {
        return res.status(400).json({ 
          success: false,
          message: `Saldo insuficiente. Seu saldo atual é ${formatCurrency(user.balance)}, e você está tentando sacar ${formatCurrency(amount)}.` 
        });
      }

      // Check if user has products (VERIFICAÇÃO CRÍTICA)
      const purchases = await storage.getUserPurchases(userId);
      const hasProduct = purchases && purchases.length > 0;

      if (!hasProduct) {
        return res.status(400).json({ 
          success: false,
          message: "É necessário comprar um produto antes de fazer saques. Visite a seção de produtos na página inicial." 
        });
      }

      // Check if user has deposited before (VERIFICAÇÃO CRÍTICA)
      const transactions = await storage.getTransactions(userId);
      const hasDeposit = transactions.some(t => 
        t.type === 'deposit' && t.status === 'completed');

      if (!hasDeposit) {
        return res.status(400).json({ 
          success: false,
          message: "É necessário fazer um depósito antes de fazer saques. Por favor, faça um depósito na página inicial." 
        });
      }

      // Verificação de saque diário já é feita anteriormente no código

      // Get bank info
      const bankInfo = await storage.getBankInfoByUserId(userId);
      if (!bankInfo) {
        return res.status(400).json({ 
          success: false,
          message: "Configure suas informações bancárias antes de fazer saques. Vá para a página de perfil para configurar." 
        });
      }

      // Apply 20% penalty if request is rejected
      const REJECTION_PENALTY = 0.2;
      const penaltyAmount = amount * REJECTION_PENALTY;
      const refundAmount = amount - penaltyAmount;

      // Create withdrawal request
      const withdrawalRequest = await storage.createWithdrawalRequest({
        userId,
        amount,
        bankName: bankInfo.bank,
        bankAccount: bankInfo.accountNumber,
        ownerName: bankInfo.ownerName,
        status: 'requested'
        // Removidos campos que não estão no esquema:
        // penaltyAmount,
        // refundAmount
      });

      // Generate unique transaction ID
      const transactionId = `WDR${Date.now().toString(36).toUpperCase()}`;

      // Deduzimos o valor imediatamente para evitar saques excessivos
      await storage.updateUserBalance(userId, user.balance - amount);

      // Criar transação para registrar o saque pendente
      await storage.createTransaction({
        userId,
        type: "withdrawal",
        amount,
        status: 'pending',
        bankName: bankInfo.bank,
        bankAccount: bankInfo.accountNumber,
        receipt: null,
        transactionId
      });

      // Retornamos a resposta com informações da solicitação criada
      return res.status(201).json({
        success: true,
        message: "Solicitação de saque registrada com sucesso e está em análise",
        withdrawalRequest: {
          id: withdrawalRequest.id,
          amount: withdrawalRequest.amount,
          status: withdrawalRequest.status,
          createdAt: withdrawalRequest.createdAt
        }
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/user/bank", async (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        message: "Sua sessão expirou ou você não está conectado. Por favor, faça login novamente para continuar." 
      });
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

  app.get("/api/user/bank", async (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        message: "Sua sessão expirou ou você não está conectado. Por favor, faça login novamente para continuar." 
      });
    }

    try {
      const bankInfo = await storage.getBankInfoByUserId(req.user.id);
      if (!bankInfo) {
        return res.status(404).json({ message: "Informações bancárias não encontradas" });
      }
      res.status(200).json(bankInfo);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/user/bank", async (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        message: "Sua sessão expirou ou você não está conectado. Por favor, faça login novamente para continuar." 
      });
    }

    try {
      await storage.deleteBankInfo(req.user.id);
      res.status(200).json({ message: "Informações bancárias removidas com sucesso" });
    } catch (error) {
      next(error);
    }
  });

  // Comprar um produto
  app.post("/api/purchases", async (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        message: "Sua sessão expirou ou você não está conectado. Por favor, faça login novamente para continuar." 
      });
    }

    const userId = req.user.id;
    const { productId } = req.body;

    try {
      if (!productId) {
        return res.status(400).json({ message: "ID do produto é obrigatório" });
      }

      // Verificar se o produto existe e está ativo
      const product = await storage.getProduct(parseInt(productId));
      if (!product) {
        return res.status(404).json({ message: "Produto não encontrado" });
      }

      if (!product.active) {
        return res.status(400).json({ message: "Este produto não está disponível para compra" });
      }

      // Verificar se o usuário tem saldo suficiente
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      if (user.balance < product.price) {
        return res.status(400).json({ message: "Saldo insuficiente para comprar este produto" });
      }

      // Registrar a compra
      const purchase = await storage.createPurchase({
        userId,
        productId: product.id,
        amount: product.price
      });

      // Atualizar o saldo do usuário
      const newBalance = user.balance - product.price;
      await storage.updateUserBalance(userId, newBalance);

      // Registrar a transação
      await storage.createTransaction({
        userId,
        type: "purchase",
        amount: product.price,
        bankAccount: null,
        bankName: null,
        receipt: null,
        transactionId: `PURCH${Date.now().toString(36).toUpperCase()}`,
        status: 'completed' // Adicionando status que estava faltando
      });

      res.status(201).json(purchase);
    } catch (error) {
      next(error);
    }
  });

  // Listar compras do usuário
  app.get("/api/purchases", async (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        message: "Sua sessão expirou ou você não está conectado. Por favor, faça login novamente para continuar." 
      });
    }

    try {
      const purchases = await storage.getUserPurchases(req.user.id);
      res.json(purchases);
    } catch (error) {
      next(error);
    }
  });

  // Rotas para Links Sociais
  app.get("/api/social-links", async (req, res) => {
    try {
      const links = await storage.getActiveSocialLinks();
      res.json(links);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao buscar links sociais" });
    }
  });

  app.get("/api/admin/social-links", isAdmin, async (req, res) => {
    try {
      const links = await storage.getSocialLinks();
      res.json(links);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao buscar links sociais" });
    }
  });

  app.post("/api/admin/social-links", isAdmin, async (req, res) => {
    try {
      const link = await storage.createSocialLink(req.body);
      res.status(201).json(link);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao criar link social" });
    }
  });

  app.put("/api/admin/social-links/:id", isAdmin, async (req, res) => {
    try {
      const linkId = parseInt(req.params.id);
      const link = await storage.updateSocialLink(linkId, req.body);
      res.json(link);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao atualizar link social" });
    }
  });

  app.delete("/api/admin/social-links/:id", isAdmin, async (req, res) => {
    try {
      const linkId = parseInt(req.params.id);
      await storage.deleteSocialLink(linkId);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao deletar link social" });
    }
  });

  // Rotas para Bancos
  app.get("/api/banks", async (req, res) => {
    try {
      const banks = await storage.getAllBanks();
      res.json(banks.filter(bank => bank.active));
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao buscar bancos" });
    }
  });

  app.get("/api/admin/banks", isAdmin, async (req, res) => {
    try {
      const banks = await storage.getAllBanks();
      res.json(banks);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao buscar bancos" });
    }
  });

  app.post("/api/admin/banks", isAdmin, async (req, res) => {
    try {
      const bank = await storage.createBank(req.body);
      res.status(201).json(bank);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao criar banco" });
    }
  });

  app.put("/api/admin/banks/:id", isAdmin, async (req, res) => {
    try {
      const bankId = parseInt(req.params.id);
      const bank = await storage.updateBank(bankId, req.body);
      res.json(bank);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao atualizar banco" });
    }
  });

  app.delete("/api/admin/banks/:id", isAdmin, async (req, res) => {
    try {
      const bankId = parseInt(req.params.id);
      await storage.deleteBank(bankId);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao deletar banco" });
    }
  });

  // Rotas para Configurações
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getAllSettings();
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao buscar configurações" });
    }
  });

  app.get("/api/admin/settings", isAdmin, async (req, res) => {
    try {
      const settings = await storage.getAllSettings();
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao buscar configurações" });
    }
  });

  app.post("/api/admin/settings", isAdmin, async (req, res) => {
    try {
      const setting = await storage.createSetting(req.body);
      res.status(201).json(setting);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao criar configuração" });
    }
  });

  app.put("/api/admin/settings/:key", isAdmin, async (req, res) => {
    try {
      const key = req.params.key;
      const { value } = req.body;

      if (!value) {
        return res.status(400).json({ error: "Valor é obrigatório" });
      }

      // Verifica se a configuração existe
      const existingSetting = await storage.getSetting(key);

      if (existingSetting) {
        // Se existir, atualiza
        const setting = await storage.updateSetting(key, value);
        res.json(setting);
      } else {
        // Se não existir, cria uma nova
        const setting = await storage.createSetting({ key, value });
        res.status(201).json(setting);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao atualizar configuração" });
    }
  });

  // Rotas para Carrossel
  app.get("/api/carousel", async (req, res) => {
    try {
      const images = await storage.getActiveCarouselImages();
      res.json(images);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao buscar imagens do carrossel" });
    }
  });

  app.get("/api/admin/carousel", isAdmin, async (req, res) => {
    try {
      const images = await storage.getAllCarouselImages();
      res.json(images);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao buscar imagens do carrossel" });
    }
  });

  app.post("/api/admin/carousel", isAdmin, async (req, res) => {
    try {
      const image = await storage.createCarouselImage(req.body);
      res.status(201).json(image);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao criar imagem do carrossel" });
    }
  });

  app.put("/api/admin/carousel/:id", isAdmin, async (req, res) => {
    try {
      const imageId = parseInt(req.params.id);
      const image = await storage.updateCarouselImage(imageId, req.body);
      res.json(image);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao atualizar imagem do carrossel" });
    }
  });

  app.delete("/api/admin/carousel/:id", isAdmin, async (req, res) => {
    try {
      const imageId = parseInt(req.params.id);
      await storage.deleteCarouselImage(imageId);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao deletar imagem do carrossel" });
    }
  });

  // Rota para informações sobre o site
  app.get("/api/about", async (req, res) => {
    res.json({
      appName: "S&P Global",
      version: "1.0.0",
      description: "Plataforma de investimentos e gerenciamento financeiro",
      contactEmail: "contato@spglobal.com",
      supportPhone: "+244 000 000 000"
    });
  });

  // Rota de diagnóstico para testar validação de status de transação
  app.post("/api/test/validate-status", (req, res) => {
    const { status } = req.body;

    console.log('Testando validação de status:', { 
      status, 
      type: typeof status, 
      body: req.body 
    });

    const validation = validateTransactionStatus(status);

    if (validation.valid) {
      return res.status(200).json({
        success: true,
        message: `Status '${status}' é válido`,
        status
      });
    } else {
      return res.status(400).json({
        success: false,
        error: validation.error,
        receivedStatus: status,
        receivedType: typeof status
      });
    }
  });

  // ROTA DE EMERGÊNCIA: Creditar depósito direto
  app.post("/api/admin/creditar-deposito", isAdmin, async (req, res) => {
    try {
      const { transactionId } = req.body;

      if (!transactionId) {
        return res.status(400).json({
          success: false,
          message: "ID da transação não fornecido"
        });
      }

      console.log(`\n=== CREDITAR EMERGÊNCIA >>> Iniciando para transação ${transactionId} ===\n`);

      // Buscar depósito pendente
      const depositRequest = await storage.getDepositRequestByTransactionId(transactionId);

      if (!depositRequest) {
        return res.status(404).json({
          success: false,
          message: `Depósito com ID ${transactionId} não encontrado`
        });
      }

      // Buscar usuário
      const user = await storage.getUser(depositRequest.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: `Usuário ${depositRequest.userId} não encontrado`
        });
      }

      console.log(`CREDITAR EMERGÊNCIA >>> Usuário: ${user.phoneNumber}, Saldo atual: ${user.balance}`);

      // Atualizar saldo diretamente
      const novoSaldo = user.balance + depositRequest.amount;
      const userAtualizado = await storage.updateUserBalance(user.id, novoSaldo);

      if (!userAtualizado) {
        return res.status(500).json({
          success: false,
          message: "Falha ao atualizar saldo"
        });
      }

      // Marcar como tendo depósito se necessário
      if (!userAtualizado.hasDeposited) {
        await storage.updateUser(user.id, { hasDeposited: true });
      }

      console.log(`CREDITAR EMERGÊNCIA >>> Saldo atualizado: ${user.balance} -> ${novoSaldo}`);

      // Criar transação completada
      const transaction = await storage.createTransaction({
        userId: depositRequest.userId,
        type: 'deposit',
        amount: depositRequest.amount,
        status: 'completed',
        bankName: depositRequest.bankName,
        receipt: depositRequest.receipt,
        bankAccount: null,
        transactionId: depositRequest.transactionId
      });

      // Remover solicitação de depósito (opcional)
      // storage.depositRequests.delete(depositRequest.id);

      // Resposta com informações detalhadas
      return res.status(200).json({
        success: true,
        message: "Depósito creditado com sucesso (modo emergência)",
        data: {
          user: {
            id: userAtualizado.id,
            phoneNumber: userAtualizado.phoneNumber,
            saldoAnterior: user.balance,
            saldoAtual: userAtualizado.balance,
            valorCreditado: depositRequest.amount
          },
          transaction: {
            id: transaction.id,
            transactionId: transaction.transactionId,
            type: transaction.type,
            amount: transaction.amount,
            status: transaction.status
          }
        }
      });
    } catch (error) {
      console.error("CREDITAR EMERGÊNCIA >>> ERRO:", error);
      return res.status(500).json({
        success: false,
        message: `Erro ao processar: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
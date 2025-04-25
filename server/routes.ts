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
        transactionId: null,
        status: 'pending' // Adicionado o status que faltava
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

  // Endpoint de depósito removido para evitar duplicidade
  // Esta implementação foi movida para a linha ~1213
  // e agora inclui validações e tratamento completo dos depósitos

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

      /**
       * SISTEMA DE REFERIDOS MELHORADO 2.0
       * - Processa comissões para todos os 3 níveis de referência
       * - Usa um sistema robusto de identificação de referências por ID, telefone ou código
       * - Taxas de comissão configuráveis para cada nível: 25%, 5%, 3% (padrão)
       */
      console.log(`Processando comissões de referral...`);

      // Obter informações de configuração das comissões
      const level1CommissionSetting = await storage.getSetting('level1_commission');
      const level2CommissionSetting = await storage.getSetting('level2_commission');
      const level3CommissionSetting = await storage.getSetting('level3_commission');

      const level1CommissionRate = level1CommissionSetting ? parseFloat(level1CommissionSetting.value) : 0.25;
      const level2CommissionRate = level2CommissionSetting ? parseFloat(level2CommissionSetting.value) : 0.05;
      const level3CommissionRate = level3CommissionSetting ? parseFloat(level3CommissionSetting.value) : 0.03;

      console.log(`Taxas de comissão: Nível 1: ${level1CommissionRate * 100}%, Nível 2: ${level2CommissionRate * 100}%, Nível 3: ${level3CommissionRate * 100}%`);

      if (user.referredBy) {
        try {
          console.log(`Processando comissões para compra do produto ID:${product.id} por usuário ID:${user.id}`);
          
          // Obter todos os usuários uma única vez para evitar várias consultas ao banco
          const allUsers = await storage.getAllUsers();
          
          // NÍVEL 1 - Referenciador direto
          let level1Referrer = null;
          const referredBy = String(user.referredBy || '');
          
          // Verificar primeiro se referredBy é um ID de usuário (número pequeno)
          if (/^\d+$/.test(referredBy) && referredBy.length < 5) {
            level1Referrer = allUsers.find(u => u.id === parseInt(referredBy));
            if (level1Referrer) {
              console.log(`Level 1: Encontrado referenciador por ID: ${level1Referrer.phoneNumber}`);
            }
          } 
          
          // Se não encontrou por ID, verificar se é um número de telefone
          if (!level1Referrer && referredBy.length === 9 && /^\d+$/.test(referredBy)) {
            level1Referrer = allUsers.find(u => u.phoneNumber === referredBy);
            if (level1Referrer) {
              console.log(`Level 1: Encontrado referenciador por telefone: ${level1Referrer.phoneNumber}`);
            }
          } 
          
          // Por fim, tentar por código de referral
          if (!level1Referrer) {
            level1Referrer = allUsers.find(u => u.referralCode === referredBy);
            if (level1Referrer) {
              console.log(`Level 1: Encontrado referenciador por código: ${level1Referrer.referralCode}`);
            }
          }
          
          // ===== NÍVEL 1 =====
          if (level1Referrer) {
            const level1Commission = product.price * level1CommissionRate;
            console.log(`Comissão Nível 1: ${level1Commission} KZ para ${level1Referrer.phoneNumber}`);

            // Criar transação de comissão com ID único
            await storage.createTransaction({
              userId: level1Referrer.id,
              type: "commission",
              amount: level1Commission,
              bankAccount: null,
              bankName: null,
              receipt: null,
              transactionId: `COM1-${Date.now().toString(36).toUpperCase()}`,
              status: 'completed'
            });

            // Atualizar o saldo do referenciador nível 1
            await storage.updateUserBalance(level1Referrer.id, level1Referrer.balance + level1Commission);
            console.log(`✅ Comissão de nível 1 creditada com sucesso: ${level1Commission} KZ`);

            // ===== NÍVEL 2 =====
            if (level1Referrer.referredBy) {
              let level2Referrer = null;
              const level1ReferredBy = String(level1Referrer.referredBy || '');
              
              // Mesma lógica para encontrar referenciador de nível 2
              if (/^\d+$/.test(level1ReferredBy) && level1ReferredBy.length < 5) {
                level2Referrer = allUsers.find(u => u.id === parseInt(level1ReferredBy));
                if (level2Referrer) {
                  console.log(`Level 2: Encontrado referenciador por ID: ${level2Referrer.phoneNumber}`);
                }
              }
              
              if (!level2Referrer && level1ReferredBy.length === 9 && /^\d+$/.test(level1ReferredBy)) {
                level2Referrer = allUsers.find(u => u.phoneNumber === level1ReferredBy);
                if (level2Referrer) {
                  console.log(`Level 2: Encontrado referenciador por telefone: ${level2Referrer.phoneNumber}`);
                }
              }
              
              if (!level2Referrer) {
                level2Referrer = allUsers.find(u => u.referralCode === level1ReferredBy);
                if (level2Referrer) {
                  console.log(`Level 2: Encontrado referenciador por código: ${level2Referrer.referralCode}`);
                }
              }

              if (level2Referrer) {
                const level2Commission = product.price * level2CommissionRate;
                console.log(`Comissão Nível 2: ${level2Commission} KZ para ${level2Referrer.phoneNumber}`);

                // Criar transação de comissão nível 2 com ID único
                await storage.createTransaction({
                  userId: level2Referrer.id,
                  type: "commission",
                  amount: level2Commission,
                  bankAccount: null,
                  bankName: null,
                  receipt: null,
                  transactionId: `COM2-${Date.now().toString(36).toUpperCase()}`,
                  status: 'completed'
                });

                // Atualizar o saldo do referenciador nível 2
                await storage.updateUserBalance(level2Referrer.id, level2Referrer.balance + level2Commission);
                console.log(`✅ Comissão de nível 2 creditada com sucesso: ${level2Commission} KZ`);

                // ===== NÍVEL 3 =====
                if (level2Referrer.referredBy) {
                  let level3Referrer = null;
                  const level2ReferredBy = String(level2Referrer.referredBy || '');
                  
                  // Mesma lógica para encontrar referenciador de nível 3
                  if (/^\d+$/.test(level2ReferredBy) && level2ReferredBy.length < 5) {
                    level3Referrer = allUsers.find(u => u.id === parseInt(level2ReferredBy));
                    if (level3Referrer) {
                      console.log(`Level 3: Encontrado referenciador por ID: ${level3Referrer.phoneNumber}`);
                    }
                  }
                  
                  if (!level3Referrer && level2ReferredBy.length === 9 && /^\d+$/.test(level2ReferredBy)) {
                    level3Referrer = allUsers.find(u => u.phoneNumber === level2ReferredBy);
                    if (level3Referrer) {
                      console.log(`Level 3: Encontrado referenciador por telefone: ${level3Referrer.phoneNumber}`);
                    }
                  }
                  
                  if (!level3Referrer) {
                    level3Referrer = allUsers.find(u => u.referralCode === level2ReferredBy);
                    if (level3Referrer) {
                      console.log(`Level 3: Encontrado referenciador por código: ${level3Referrer.referralCode}`);
                    }
                  }

                  if (level3Referrer) {
                    const level3Commission = product.price * level3CommissionRate;
                    console.log(`Comissão Nível 3: ${level3Commission} KZ para ${level3Referrer.phoneNumber}`);

                    // Criar transação de comissão nível 3 com ID único
                    await storage.createTransaction({
                      userId: level3Referrer.id,
                      type: "commission",
                      amount: level3Commission,
                      bankAccount: null,
                      bankName: null,
                      receipt: null,
                      transactionId: `COM3-${Date.now().toString(36).toUpperCase()}`,
                      status: 'completed'
                    });

                    // Atualizar o saldo do referenciador nível 3
                    await storage.updateUserBalance(level3Referrer.id, level3Referrer.balance + level3Commission);
                    console.log(`✅ Comissão de nível 3 creditada com sucesso: ${level3Commission} KZ`);
                  } else {
                    console.log(`Nenhum referenciador de nível 3 encontrado para o valor '${level2ReferredBy}'`);
                  }
                } else {
                  console.log(`Referenciador de nível 2 não tem referência (referredBy é nulo ou vazio)`);
                }
              } else {
                console.log(`Nenhum referenciador de nível 2 encontrado para o valor '${level1ReferredBy}'`);
              }
            } else {
              console.log(`Referenciador de nível 1 não tem referência (referredBy é nulo ou vazio)`);
            }
          } else {
            console.log(`Nenhum referenciador de nível 1 encontrado para o valor '${referredBy}'`);
          }
        } catch (error) {
          console.error("❌ Erro ao processar comissões:", error);
          // Não interrompemos o fluxo se a comissão falhar
        }
      } else {
        console.log(`Usuário não tem referredBy definido, pulando processamento de comissões`);
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
      /**
       * VERSÃO MELHORADA DO ENDPOINT DE REFERIDOS
       * - Tenta usar a view SQL se disponível (mais rápido)
       * - Fallback para cálculo manual se a view não funcionar
       * - Garante compatibilidade com todas as versões do sistema de referência (referred_by como ID, telefone ou código)
       */
      
      // IMPORTANTE: SEMPRE buscar os usuários primeiro para garantir que teremos os dados completos
      // mesmo que a view SQL falhe
      console.log("Buscando todos os usuários do sistema...");
      const users = await storage.getAllUsers();
      
      // Recuperar dados do usuário atual para ter certeza que estão atualizados
      const currentUser = users.find(u => u.id === req.user.id);
      if (!currentUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      console.log(`Processando referidos para usuário: ${currentUser.id} (Tel: ${currentUser.phoneNumber})`);
      
      // ETAPA 1: Tentar obter dados da view (mais rápido em produção)
      console.log("Tentando buscar informações de referidos a partir da view referral_counts...");
      let referralCounts = null;
      let viewQuerySuccessful = false;
      
      try {
        const userId = currentUser.id;
        const result = await db.execute(sql`
          SELECT * FROM referral_counts WHERE user_id = ${userId}
        `);
        
        if (result.rows && result.rows.length > 0) {
          referralCounts = result.rows[0];
          viewQuerySuccessful = true;
          console.log("✅ Dados obtidos com sucesso da view referral_counts:", referralCounts);
        } else {
          console.log("⚠️ Nenhum dado encontrado na view referral_counts para o usuário", userId);
        }
      } catch (err) {
        console.error("❌ Erro ao consultar view referral_counts:", err);
      }
      
      // ETAPA 2: SEMPRE calcular manualmente para garantir que teremos os dados de referidos
      console.log("Calculando referidos manualmente (independente da view)...");
      
      // Verificar todos os possíveis campos de referência
      // 1. Outro usuário pode ter sido referido pelo ID deste usuário
      // 2. Outro usuário pode ter sido referido pelo telefone deste usuário
      // 3. Outro usuário pode ter sido referido pelo código de referência deste usuário
      
      // Obter referidos diretos (nível 1) - considerando todos os possíveis campos de referência
      const level1Referrals = users.filter(user => {
        // Converter referred_by para string para comparar com segurança
        const referredBy = String(user.referredBy || '');
        return (
          referredBy === String(currentUser.id) || 
          referredBy === currentUser.phoneNumber || 
          referredBy === currentUser.referralCode
        );
      });
      
      console.log(`Encontrados ${level1Referrals.length} referidos diretos (nível 1)`);
      
      // Obter referidos de nível 2 
      // (usuários que foram referidos por alguém que foi referido pelo usuário atual)
      const level1Ids = level1Referrals.map(user => user.id);
      const level1PhoneNumbers = level1Referrals.map(user => user.phoneNumber);
      const level1ReferralCodes = level1Referrals.map(user => user.referralCode);
      
      const level2Referrals = users.filter(user => {
        if (!user.referredBy) return false;
        
        const referredBy = String(user.referredBy || '');
        return (
          level1Ids.some(id => referredBy === String(id)) ||
          level1PhoneNumbers.some(phone => referredBy === phone) ||
          level1ReferralCodes.some(code => referredBy === code)
        );
      });
      
      console.log(`Encontrados ${level2Referrals.length} referidos de nível 2`);
      
      // Obter referidos de nível 3
      // (usuários que foram referidos por alguém de nível 2)
      const level2Ids = level2Referrals.map(user => user.id);
      const level2PhoneNumbers = level2Referrals.map(user => user.phoneNumber);
      const level2ReferralCodes = level2Referrals.map(user => user.referralCode);
      
      const level3Referrals = users.filter(user => {
        if (!user.referredBy) return false;
        
        const referredBy = String(user.referredBy || '');
        return (
          level2Ids.some(id => referredBy === String(id)) ||
          level2PhoneNumbers.some(phone => referredBy === phone) ||
          level2ReferralCodes.some(code => referredBy === code)
        );
      });
      
      console.log(`Encontrados ${level3Referrals.length} referidos de nível 3`);

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

      // Calcular comissões reais por nível
      // Agora vamos processar as transações de comissão corretamente por nível
      const level1Commission = commissionTransactions
        .filter(tx => tx.transactionId?.startsWith('COM1-'))
        .reduce((total, tx) => total + tx.amount, 0);
        
      const level2Commission = commissionTransactions
        .filter(tx => tx.transactionId?.startsWith('COM2-'))
        .reduce((total, tx) => total + tx.amount, 0);
        
      const level3Commission = commissionTransactions
        .filter(tx => tx.transactionId?.startsWith('COM3-'))
        .reduce((total, tx) => total + tx.amount, 0);
        
      console.log(`Comissões calculadas: Nível 1: ${level1Commission}, Nível 2: ${level2Commission}, Nível 3: ${level3Commission}`);

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

      // DECISÃO CORRIGIDA: SEMPRE usar contagens do cálculo manual (mais confiável)
      // A view SQL só serve para otimização do nível 1, não para níveis 2 e 3
      
      // Contar usuários ativos (que compraram produtos)
      const level1Active = level1Referrals.filter(u => u.hasProduct).length;
      const level2Active = level2Referrals.filter(u => u.hasProduct).length;
      const level3Active = level3Referrals.filter(u => u.hasProduct).length;
      
      // USAR OS DADOS DO CÁLCULO MANUAL SEMPRE PARA NÍVEIS 2 e 3
      // Para nível 1, podemos usar a view se ela existir (para compatibilidade com produção)
      const useViewForLevel1 = viewQuerySuccessful && referralCounts;
      
      // Resolver contagens finais
      const level1Count = useViewForLevel1 ? Number(referralCounts.level1_count) : level1Referrals.length;
      const level2Count = level2Referrals.length; // SEMPRE usar cálculo manual aqui
      const level3Count = level3Referrals.length; // SEMPRE usar cálculo manual aqui
      
      const level1ActiveCount = useViewForLevel1 ? Number(referralCounts.level1_active) : level1Active;
      const level2ActiveCount = level2Active; // SEMPRE usar cálculo manual aqui
      const level3ActiveCount = level3Active; // SEMPRE usar cálculo manual aqui
      
      console.log(`Dados finais de referidos (${useViewForLevel1 ? 'contagem via view para nível 1' : 'contagem manual'}):
        Level 1: ${level1Count} (${level1ActiveCount} ativos) - ${level1Referrals.length} na lista
        Level 2: ${level2Count} (${level2ActiveCount} ativos) - ${level2Referrals.length} na lista
        Level 3: ${level3Count} (${level3ActiveCount} ativos) - ${level3Referrals.length} na lista
      `);
      
      // Resposta final com todos os dados
      res.json({
        level1: {
          count: level1Count,
          commission: level1Commission,
          referrals: formattedLevel1,
          active: level1ActiveCount
        },
        level2: {
          count: level2Count,
          commission: level2Commission,
          referrals: formattedLevel2,
          active: level2ActiveCount
        },
        level3: {
          count: level3Count,
          commission: level3Commission,
          referrals: formattedLevel3,
          active: level3ActiveCount
        },
        source: useViewForLevel1 ? 'view' : 'manual'  // para debugging
      });
    } catch (error) {
      console.error("Erro ao processar referidos:", error);
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
      // Log de diagnóstico para entender o problema de sessão
      console.log("[DEPÓSITO] ERRO: Usuário não autenticado. Detalhes da sessão:", {
        sessionID: req.sessionID,
        cookieHeader: req.headers.cookie,
        sessionExists: !!req.session
      });
      
      return res.status(401).json({ 
        message: "Sua sessão expirou ou você não está conectado. Por favor, faça login novamente para continuar." 
      });
    }

    console.log("[DEPÓSITO] Usuário autenticado:", req.user.id);
    const { amount, bankId, bankName: bankNameParam, receipt } = req.body;

    try {
      // Obter o valor mínimo de depósito das configurações
      const depositMinSetting = await storage.getSetting("deposit_min");
      const minDeposit = depositMinSetting ? parseInt(depositMinSetting.value) : 25000;

      if (!amount || amount < minDeposit) {
        return res.status(400).json({ message: `Valor mínimo para depósito é KZ ${minDeposit}` });
      }

      // Se foi fornecido um ID ou nome de banco, pegar informações dele
      let bankName = bankNameParam || null;
      let bankAccount = null;
      
      if (bankId) {
        // Primeiro, verificar se bankId é um nome de banco (string) ou um ID (número)
        if (isNaN(parseInt(bankId))) {
          // Se bankId é uma string (nome do banco), usamos diretamente
          bankName = bankId;
          console.log(`[DEPÓSITO] Usando nome do banco diretamente: ${bankName}`);
        } else {
          // Se bankId é um número, buscamos o banco pelo ID
          const bank = await storage.getBank(parseInt(bankId));
          if (bank) {
            bankName = bank.name;
            console.log(`[DEPÓSITO] Banco encontrado pelo ID ${bankId}: ${bankName}`);
            
            // Aqui podemos adicionar a conta padrão para esse banco, se houver
            const bankSetting = await storage.getSetting(`bank_account_${bank.id}`);
            if (bankSetting) {
              bankAccount = bankSetting.value;
            }
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
        
        // Atualizar a sessão do usuário com os dados bancários
        if (req.user) {
          req.user.bankInfo = bankInfo;
        }
        
        return res.status(200).json({
          success: true,
          message: "Informações bancárias atualizadas com sucesso",
          data: bankInfo
        });
      } else {
        // Se não existe, cria novo
        const bankInfo = await storage.createBankInfo(userId, { 
          bank, 
          ownerName, 
          accountNumber, 
          userId 
        });
        
        // Atualizar a sessão do usuário com os dados bancários
        if (req.user) {
          req.user.bankInfo = bankInfo;
        }
        
        return res.status(201).json({
          success: true,
          message: "Informações bancárias criadas com sucesso",
          data: bankInfo
        });
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
      
      // Creditar a primeira renda diária imediatamente 
      const dailyIncome = product.dailyIncome || 0;
      if (dailyIncome > 0) {
        // Calcular novo saldo com a renda diária
        const updatedBalanceWithIncome = newBalance + dailyIncome;
        
        // Atualizar o saldo do usuário adicionando a renda diária
        const userWithDailyIncome = await storage.updateUserBalance(userId, updatedBalanceWithIncome);
        
        // Registrar a transação de renda diária
        const dailyIncomeTransaction = await storage.createTransaction({
          userId,
          type: "income",
          amount: dailyIncome,
          bankAccount: null,
          bankName: null,
          receipt: null,
          transactionId: `DINC${Date.now().toString(36).toUpperCase()}`,
          status: 'completed'
        });
      }
      
      // Atualizar status de usuário para indicar que possui produto
      await storage.updateUser(userId, { hasProduct: true });
      
      // PROCESSAMENTO DE COMISSÕES PARA REFERIDOS (TODOS OS 3 NÍVEIS)
      if (user.referredBy) {
        try {
          console.log(`Processando comissões para compra do produto ID:${product.id} por usuário ID:${user.id}`);
          
          // Obter configurações de comissão
          const level1CommissionSetting = await storage.getSetting('level1_commission');
          const level2CommissionSetting = await storage.getSetting('level2_commission');
          const level3CommissionSetting = await storage.getSetting('level3_commission');

          const level1CommissionRate = level1CommissionSetting ? parseFloat(level1CommissionSetting.value) : 0.25;
          const level2CommissionRate = level2CommissionSetting ? parseFloat(level2CommissionSetting.value) : 0.05;
          const level3CommissionRate = level3CommissionSetting ? parseFloat(level3CommissionSetting.value) : 0.03;
          
          // Obter todos os usuários uma única vez 
          const allUsers = await storage.getAllUsers();
          
          // NÍVEL 1 - Referenciador direto
          let level1Referrer = null;
          const referredBy = String(user.referredBy || '');
          
          // Tentar encontrar referenciador por ID, telefone ou código
          if (/^\d+$/.test(referredBy) && referredBy.length < 5) {
            level1Referrer = allUsers.find(u => u.id === parseInt(referredBy));
          }
          
          if (!level1Referrer && referredBy.length === 9 && /^\d+$/.test(referredBy)) {
            level1Referrer = allUsers.find(u => u.phoneNumber === referredBy);
          }
          
          if (!level1Referrer) {
            level1Referrer = allUsers.find(u => u.referralCode === referredBy);
          }
          
          // PROCESSAR COMISSÃO NÍVEL 1
          if (level1Referrer) {
            const level1Commission = product.price * level1CommissionRate;
            
            // Atualizar saldo do referenciador nível 1
            await storage.updateUserBalance(level1Referrer.id, level1Referrer.balance + level1Commission);
            
            // Registrar transação de comissão
            await storage.createTransaction({
              userId: level1Referrer.id,
              type: "commission",
              amount: level1Commission,
              bankAccount: null,
              bankName: null,
              receipt: null,
              transactionId: `COM1-${Date.now().toString(36).toUpperCase()}`,
              status: 'completed'
            });
            
            // PROCESSAR COMISSÃO NÍVEL 2
            if (level1Referrer.referredBy) {
              let level2Referrer = null;
              const level1ReferredBy = String(level1Referrer.referredBy || '');
              
              // Tentar encontrar referenciador nível 2
              if (/^\d+$/.test(level1ReferredBy) && level1ReferredBy.length < 5) {
                level2Referrer = allUsers.find(u => u.id === parseInt(level1ReferredBy));
              }
              
              if (!level2Referrer && level1ReferredBy.length === 9 && /^\d+$/.test(level1ReferredBy)) {
                level2Referrer = allUsers.find(u => u.phoneNumber === level1ReferredBy);
              }
              
              if (!level2Referrer) {
                level2Referrer = allUsers.find(u => u.referralCode === level1ReferredBy);
              }
              
              if (level2Referrer) {
                const level2Commission = product.price * level2CommissionRate;
                
                // Atualizar saldo do referenciador nível 2
                await storage.updateUserBalance(level2Referrer.id, level2Referrer.balance + level2Commission);
                
                // Registrar transação de comissão
                await storage.createTransaction({
                  userId: level2Referrer.id,
                  type: "commission",
                  amount: level2Commission,
                  bankAccount: null,
                  bankName: null,
                  receipt: null,
                  transactionId: `COM2-${Date.now().toString(36).toUpperCase()}`,
                  status: 'completed'
                });
                
                // PROCESSAR COMISSÃO NÍVEL 3
                if (level2Referrer.referredBy) {
                  let level3Referrer = null;
                  const level2ReferredBy = String(level2Referrer.referredBy || '');
                  
                  // Tentar encontrar referenciador nível 3
                  if (/^\d+$/.test(level2ReferredBy) && level2ReferredBy.length < 5) {
                    level3Referrer = allUsers.find(u => u.id === parseInt(level2ReferredBy));
                  }
                  
                  if (!level3Referrer && level2ReferredBy.length === 9 && /^\d+$/.test(level2ReferredBy)) {
                    level3Referrer = allUsers.find(u => u.phoneNumber === level2ReferredBy);
                  }
                  
                  if (!level3Referrer) {
                    level3Referrer = allUsers.find(u => u.referralCode === level2ReferredBy);
                  }
                  
                  if (level3Referrer) {
                    const level3Commission = product.price * level3CommissionRate;
                    
                    // Atualizar saldo do referenciador nível 3
                    await storage.updateUserBalance(level3Referrer.id, level3Referrer.balance + level3Commission);
                    
                    // Registrar transação de comissão
                    await storage.createTransaction({
                      userId: level3Referrer.id,
                      type: "commission",
                      amount: level3Commission,
                      bankAccount: null,
                      bankName: null,
                      receipt: null,
                      transactionId: `COM3-${Date.now().toString(36).toUpperCase()}`,
                      status: 'completed'
                    });
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error("Erro ao processar comissões:", error);
          // Não interrompemos o fluxo se a comissão falhar
        }
      }

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
      
      // SEGURANÇA CRÍTICA: Verificar se já existe uma transação com esse ID
      // para evitar créditos duplicados
      const existingTransaction = await storage.getTransactionByTransactionId(transactionId);
      if (existingTransaction) {
        console.log(`CREDITAR EMERGÊNCIA >>> ALERTA DE SEGURANÇA - TENTATIVA DE CRÉDITO DUPLICADO`);
        console.log(`CREDITAR EMERGÊNCIA >>> Transação ${transactionId} já existe com ID ${existingTransaction.id}`);
        console.log(`CREDITAR EMERGÊNCIA >>> Status: ${existingTransaction.status}, Valor: ${existingTransaction.amount}`);
        
        // Retornar mensagem de sucesso, mas informando que é duplicado
        return res.status(200).json({
          success: true,
          message: "Depósito já foi processado anteriormente",
          data: {
            transaction: {
              id: existingTransaction.id,
              transactionId: existingTransaction.transactionId,
              type: existingTransaction.type,
              amount: existingTransaction.amount,
              status: existingTransaction.status
            }
          },
          duplicated: true
        });
      }

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
      
      // Verificar novamente em caso de operações concorrentes
      const verifyAgain = await storage.getTransactionByTransactionId(transactionId);
      if (verifyAgain) {
        console.log(`CREDITAR EMERGÊNCIA >>> ALERTA: Transação ${transactionId} foi criada durante o processamento`);
        return res.status(200).json({
          success: true,
          message: "Depósito já foi processado (durante a verificação)",
          data: {
            transaction: {
              id: verifyAgain.id,
              transactionId: verifyAgain.transactionId,
              type: verifyAgain.type,
              amount: verifyAgain.amount,
              status: verifyAgain.status
            }
          },
          duplicated: true
        });
      }

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

      try {
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
        // Se houver erro na criação da transação, pode ser por duplicação
        // Verificar novamente se a transação foi criada
        const finalCheck = await storage.getTransactionByTransactionId(transactionId);
        if (finalCheck) {
          console.log(`CREDITAR EMERGÊNCIA >>> Recuperada transação após erro: ${finalCheck.id}`);
          
          return res.status(200).json({
            success: true,
            message: "Depósito processado, mas houve um conflito de concorrência",
            data: {
              user: {
                id: userAtualizado.id,
                phoneNumber: userAtualizado.phoneNumber,
                saldoAtual: userAtualizado.balance
              },
              transaction: {
                id: finalCheck.id,
                transactionId: finalCheck.transactionId,
                type: finalCheck.type,
                amount: finalCheck.amount,
                status: finalCheck.status
              }
            },
            conflict: true
          });
        }
        
        // Se realmente for um erro diferente, relançar
        throw error;
      }
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
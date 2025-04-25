/**
 * Módulo para processamento de tarefas agendadas
 * Responsável por gerenciar tarefas que precisam ser executadas em horários específicos
 * como o processamento de rendimentos diários à meia-noite
 */

import { db } from "./db";
import { storage } from "./storage";
import { eq, and, sql, not, isNull } from "drizzle-orm";
import { purchases, products, users, transactions } from "@shared/schema";

/**
 * Configura o temporizador para executar à meia-noite
 * @param callback Função a ser executada à meia-noite
 */
function scheduleForMidnight(callback: () => void) {
  const now = new Date();
  const night = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1, // próximo dia
    0, // hora 0 (meia-noite)
    0, // minuto 0
    5 // 5 segundos após meia-noite para garantir a virada do dia
  );
  
  // Calcula a diferença em milissegundos até a meia-noite
  const msToMidnight = night.getTime() - now.getTime();
  
  console.log(`Agendando tarefa para executar em ${Math.round(msToMidnight / (1000 * 60 * 60) * 100) / 100} horas (meia-noite)`);
  
  // Agenda a execução para a meia-noite
  setTimeout(() => {
    console.log(`🕛 EXECUTANDO TAREFA AGENDADA - ${new Date().toISOString()}`);
    callback();
    // Reagenda para a próxima meia-noite após executar
    scheduleForMidnight(callback);
  }, msToMidnight);
}

/**
 * Processa os rendimentos diários de produtos ativos
 * Adiciona o valor do rendimento diário ao saldo do usuário
 * e registra uma transação correspondente
 */
async function processDailyIncome() {
  console.log("🔄 Iniciando processamento de rendimentos diários");
  console.log(`Data e hora atual: ${new Date().toISOString()}`);
  console.log(`Hora local de Angola: ${new Date().toLocaleString('pt-AO', { timeZone: 'Africa/Luanda' })}`);
  
  try {
    // Obtém todos os produtos ativos
    const activeProducts = await db.select().from(products).where(eq(products.active, true));
    console.log(`Encontrados ${activeProducts.length} produtos ativos`);
    
    if (activeProducts.length === 0) {
      console.log("Nenhum produto ativo encontrado. Pulando processamento de rendimentos.");
      return;
    }
    
    // Obtém todas as compras
    const allPurchases = await db.select({
      id: purchases.id,
      userId: purchases.userId,
      productId: purchases.productId,
      createdAt: purchases.createdAt
    }).from(purchases);
    
    console.log(`Encontradas ${allPurchases.length} compras para processamento`);
    
    if (allPurchases.length === 0) {
      console.log("Nenhuma compra encontrada. Pulando processamento de rendimentos.");
      return;
    }
    
    // Iniciar o registro de log do ciclo
    console.log("🔄 NOVO CICLO DE RENDIMENTOS DIÁRIOS INICIADO");
    console.log(`Data/hora: ${new Date().toISOString()}`);
    console.log(`Total de produtos ativos: ${activeProducts.length}`);
    console.log(`Total de compras para processar: ${allPurchases.length}`);

    // Para cada compra, processa o rendimento diário
    for (const purchase of allPurchases) {
      try {
        // Encontra o produto correspondente a esta compra
        const product = activeProducts.find(p => p.id === purchase.productId);
        if (!product) {
          console.log(`Produto ${purchase.productId} não encontrado para compra ${purchase.id}, pulando`);
          continue;
        }

        // Obtém os dados atuais do usuário
        const user = await storage.getUser(purchase.userId);
        if (!user) {
          console.error(`Usuário ${purchase.userId} não encontrado para a compra ${purchase.id}`);
          continue;
        }

        // Atualiza o saldo do usuário
        const updatedBalance = user.balance + product.dailyIncome;
        await storage.updateUserBalance(user.id, updatedBalance);

        // Gera um ID único para a transação incluindo a data atual para rastreamento de ciclo
        const now = new Date();
        const cycleDate = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
        const uniqueId = `INC${cycleDate}-${purchase.id}`;
        
        // Registra a transação com identificador de ciclo
        const transaction = await db.insert(transactions).values({
          userId: user.id,
          amount: product.dailyIncome,
          type: "income",
          status: "completed",
          bankAccount: null,
          bankName: null, 
          receipt: null,
          transactionId: uniqueId
        }).returning();

        console.log(`Rendimento processado para usuário ${user.id}: +${product.dailyIncome} KZ do produto ${product.name} (Ciclo: ${cycleDate})`);
      } catch (error) {
        console.error(`Erro ao processar rendimento para compra ${purchase.id}:`, error);
      }
    }

    console.log("✅ Processamento de rendimentos diários concluído com sucesso");
  } catch (error) {
    console.error("❌ Erro ao processar rendimentos diários:", error);
  }
}

/**
 * Inicializa as tarefas agendadas
 */
export function initScheduledTasks() {
  console.log("🔄 Inicializando sistema de tarefas agendadas");
  
  // Agenda a tarefa de processamento de rendimentos para executar à meia-noite
  scheduleForMidnight(processDailyIncome);
  
  console.log("✅ Sistema de tarefas agendadas inicializado com sucesso");
}
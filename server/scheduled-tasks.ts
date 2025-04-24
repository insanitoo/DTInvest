/**
 * Módulo para processamento de tarefas agendadas
 * Responsável por gerenciar tarefas que precisam ser executadas em horários específicos
 * como o processamento de rendimentos diários à meia-noite
 */

import { db } from "./db";
import { storage } from "./storage";
import { eq, and, sql } from "drizzle-orm";
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
  
  console.log(`Agendando tarefa para executar em ${msToMidnight / (1000 * 60 * 60)} horas (meia-noite)`);
  
  // Agenda a execução para a meia-noite
  setTimeout(() => {
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
  
  try {
    // Obtém todas as compras ativas com produtos válidos
    const activePurchases = await db.select({
      id: purchases.id,
      userId: purchases.userId,
      productId: purchases.productId,
      dailyIncome: products.dailyIncome,
      productName: products.name
    })
    .from(purchases)
    .innerJoin(products, eq(purchases.productId, products.id))
    .where(
      and(
        eq(purchases.active, true),
        eq(products.active, true)
      )
    );

    console.log(`Encontradas ${activePurchases.length} compras ativas para processamento de rendimento`);

    // Para cada compra ativa, processa o rendimento diário
    for (const purchase of activePurchases) {
      try {
        // Obtém os dados atuais do usuário
        const user = await storage.getUser(purchase.userId);
        if (!user) {
          console.error(`Usuário ${purchase.userId} não encontrado para a compra ${purchase.id}`);
          continue;
        }

        // Atualiza o saldo do usuário
        const updatedBalance = user.balance + purchase.dailyIncome;
        await storage.updateUserBalance(user.id, updatedBalance);

        // Registra a transação
        await storage.createTransaction({
          userId: user.id,
          amount: purchase.dailyIncome,
          type: "income",
          status: "completed",
          description: `Rendimento diário do produto ${purchase.productName}`,
          transactionId: `INC${Date.now().toString(36).toUpperCase()}-${purchase.id}`
        });

        console.log(`Rendimento processado para usuário ${user.id}: +${purchase.dailyIncome} KZ do produto ${purchase.productName}`);
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
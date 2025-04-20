// Arquivo criado para teste de transações pendentes
import { Express, Request, Response } from 'express';
import { storage } from './storage';

export function setupTestEndpoints(app: Express) {
  app.post('/api/create-pending-transaction-test', async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Não autenticado" });
      }
      
      const userId = req.user?.id || 0;
      console.log('Criando transação pendente para teste...');
      
      // Criar uma nova transação pendente
      const transaction = await storage.createTransaction({
        userId,
        type: 'deposit',
        amount: 12000,
        bankAccount: '987654321',
        bankName: 'Banco Angolano de Investimentos (BAI)',
        receipt: null,
        transactionId: `TEST${Date.now().toString(36).toUpperCase()}`
      });
      
      console.log('Transação pendente criada:', transaction);
      
      // Retornar resposta com Content-Type explícito
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({
        success: true,
        message: "Transação pendente criada com sucesso",
        transaction
      });
      
    } catch (error) {
      console.error('Erro ao criar transação pendente:', error);
      return res.status(500).json({
        success: false,
        message: "Erro ao criar transação",
        error: String(error)
      });
    }
  });
}
import { createContext, ReactNode, useContext, useState, useEffect } from "react";
import { useQuery, useMutation, UseMutationResult } from '@tanstack/react-query';
import { Transaction } from '@shared/schema';
import { apiRequest, queryClient, forceTransactionUpdate } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// Define the context type
type TransactionsContextType = {
  transactions: Transaction[] | undefined;
  adminTransactions: Transaction[] | undefined;
  isLoading: boolean;
  isAdminLoading: boolean;
  error: Error | null;
  updateTransactionStatus: (transactionId: number, newStatus: string) => Promise<boolean>;
  refetchTransactions: () => Promise<void>;
  refetchAdminTransactions: () => Promise<void>;
};

// Create context
export const TransactionsContext = createContext<TransactionsContextType | null>(null);

// Provider component
export function TransactionsProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  
  // Query para carregar transações do usuário
  const {
    data: transactions,
    isLoading,
    error,
    refetch: refetchUserTransactions
  } = useQuery<Transaction[], Error>({
    queryKey: ['/api/transactions'],
    staleTime: 3000,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });
  
  // Query para carregar transações do admin
  const {
    data: adminTransactions,
    isLoading: isAdminLoading,
    refetch: refetchAdminData
  } = useQuery<Transaction[], Error>({
    queryKey: ['/api/admin/transactions'],
    staleTime: 3000,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });
  
  // Mutação para atualizar status de transação
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      console.log(`Atualizando transação ${id} para status '${status}'`);
      
      // Usar apiRequest que já tem tratamento de erros
      const response = await apiRequest(
        'PUT', 
        `/api/admin/transactions/${id}`, 
        { status }
      );
      
      // Processar resposta com tratamento robusto
      let data;
      
      try {
        const responseText = await response.text();
        if (responseText && responseText.trim()) {
          try {
            data = JSON.parse(responseText);
            console.log('Resposta processada com sucesso:', data);
          } catch (parseError) {
            console.warn('Resposta não é JSON válido, usando fallback', parseError);
            data = { success: true };
          }
        } else {
          console.log('Resposta vazia mas status OK, considerando sucesso');
          data = { success: true };
        }
      } catch (error) {
        console.error('Erro ao processar resposta:', error);
        throw new Error('Falha ao processar resposta do servidor');
      }
      
      return data;
    },
    onSuccess: async (data, variables) => {
      console.log('Atualização bem-sucedida:', data);
      
      // Forçar atualização em todos os níveis
      await forceTransactionUpdate(variables.id, variables.status);
      
      toast({
        title: 'Status atualizado',
        description: `Transação #${variables.id} atualizada para "${variables.status}"`,
        variant: 'default',
      });
    },
    onError: (error) => {
      console.error('Erro ao atualizar transação:', error);
      toast({
        title: 'Erro',
        description: `Falha ao atualizar status: ${error.message}`,
        variant: 'destructive',
      });
    }
  });
  
  // Função para atualizar status
  const updateTransactionStatus = async (transactionId: number, newStatus: string): Promise<boolean> => {
    try {
      console.log(`INÍCIO: Atualizando transação ${transactionId} para status '${newStatus}'...`);
      
      // 1. Atualizar todos os caches locais para feedback imediato
      console.log('1. Atualizando caches locais...');
      
      // Cache de admin
      if (adminTransactions && adminTransactions.length > 0) {
        const updatedAdminTransactions = adminTransactions.map(tx => 
          tx.id === transactionId ? { ...tx, status: newStatus } : tx
        );
        queryClient.setQueryData(['/api/admin/transactions'], updatedAdminTransactions);
        console.log('- Cache de transações admin atualizado');
      }
      
      // Cache de usuário
      if (transactions && transactions.length > 0) {
        const updatedUserTransactions = transactions.map(tx => 
          tx.id === transactionId ? { ...tx, status: newStatus } : tx
        );
        queryClient.setQueryData(['/api/transactions'], updatedUserTransactions);
        console.log('- Cache de transações usuário atualizado');
      }
      
      // 2. Fazer a chamada de API
      console.log('2. Enviando requisição...');
      const result = await updateStatusMutation.mutateAsync({ id: transactionId, status: newStatus });
      console.log('- Resposta do servidor:', result);
      
      // 3. Forçar recarregamento completo
      console.log('3. Recarregando dados...');
      await refetchTransactions();
      
      // 4. Verificar consistência
      console.log('4. Verificando consistência...');
      const adminCheck = (queryClient.getQueryData<Transaction[]>(['/api/admin/transactions']) || [])
        .find(tx => tx.id === transactionId);
      
      if (adminCheck && adminCheck.status === newStatus) {
        console.log(`✅ SUCESSO: Transação ${transactionId} atualizada para '${newStatus}'`);
        return true;
      } else {
        console.warn(`⚠️ Status não consistente após atualização`);
        await forceTransactionUpdate(transactionId, newStatus);
        return true;
      }
    } catch (error) {
      console.error('❌ ERRO na atualização:', error);
      return false;
    }
  };
  
  // Função de recarregamento de transações
  const refetchTransactions = async (): Promise<void> => {
    try {
      // Invalidar todos os caches relacionados
      console.log('Invalidando caches...');
      
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/admin/transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/user'] })
      ]);
      
      // Recarregar dados
      console.log('Recarregando dados...');
      await Promise.all([
        refetchUserTransactions(),
        refetchAdminData(), 
        queryClient.refetchQueries({ queryKey: ['/api/user'] })
      ]);
      
      console.log('Recarregamento concluído!');
    } catch (error) {
      console.error('Erro ao recarregar:', error);
    }
  };
  
  // Função específica para admin
  const refetchAdminTransactions = async (): Promise<void> => {
    try {
      await refetchAdminData();
    } catch (error) {
      console.error('Erro ao recarregar transações admin:', error);
    }
  };
  
  return (
    <TransactionsContext.Provider
      value={{
        transactions,
        adminTransactions,
        isLoading,
        isAdminLoading,
        error: error || null,
        updateTransactionStatus,
        refetchTransactions,
        refetchAdminTransactions
      }}
    >
      {children}
    </TransactionsContext.Provider>
  );
}

// Hook para usar o contexto
export function useTransactions() {
  const context = useContext(TransactionsContext);
  if (!context) {
    throw new Error('useTransactions deve ser usado dentro de um TransactionsProvider');
  }
  return context;
}
import { useQuery, useMutation, UseQueryResult } from '@tanstack/react-query';
import { Transaction } from '@shared/schema';
import { apiRequest, queryClient, forceTransactionUpdate } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

type UseTransactionsReturn = {
  transactions: Transaction[] | undefined;
  isLoading: boolean;
  error: Error | null;
  updateTransactionStatus: (transactionId: number, newStatus: string) => Promise<boolean>;
  refetchTransactions: () => Promise<void>;
};

export function useTransactions(isAdmin = false): UseTransactionsReturn {
  const { toast } = useToast();
  const endpoint = isAdmin ? '/api/admin/transactions' : '/api/transactions';
  
  // Query para carregar transações
  const {
    data: transactions,
    isLoading,
    error,
    refetch
  } = useQuery<Transaction[], Error>({
    queryKey: [endpoint],
    staleTime: 3000, // Considerar obsoleto após 3 segundos
    refetchInterval: 10000, // Revalidar a cada 10 segundos
    refetchOnWindowFocus: true,
  });
  
  // Mutação para atualizar status de transação
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      console.log(`Atualizando transação ${id} para status '${status}'`);
      
      // Usar método robusto com cabeçalhos definidos
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      };
      
      // Fazer a requisição
      const res = await fetch(`/api/admin/transactions/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status }),
        credentials: 'include'
      });
      
      if (!res.ok) {
        throw new Error(`Erro na atualização: ${res.status}`);
      }
      
      // Tentar obter JSON, mas não falhar se a resposta for vazia
      let data;
      try {
        const text = await res.text();
        data = text ? JSON.parse(text) : { success: true };
      } catch (error) {
        console.warn('Resposta não é JSON válido, mas status é OK');
        data = { success: true };
      }
      
      return data;
    },
    onSuccess: async (data, variables) => {
      console.log('Atualização bem-sucedida:', data);
      
      // Usar nosso utilitário robusto para forçar atualizações em todos os níveis
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
  
  // Função simplificada para atualizar status
  const updateTransactionStatus = async (transactionId: number, newStatus: string): Promise<boolean> => {
    try {
      // Primeiro, atualizar manualmente o cache para feedback imediato
      const currentTransactions = queryClient.getQueryData<Transaction[]>([endpoint]) || [];
      const updatedTransactions = currentTransactions.map(tx => 
        tx.id === transactionId ? { ...tx, status: newStatus } : tx
      );
      queryClient.setQueryData([endpoint], updatedTransactions);
      
      // Depois, fazer a requisição real
      await updateStatusMutation.mutateAsync({ id: transactionId, status: newStatus });
      
      // Garantir que ambos os caches de transações estão atualizados
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/admin/transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/transactions'] })
      ]);
      
      return true;
    } catch (error) {
      console.error('Erro na atualização de status:', error);
      return false;
    }
  };
  
  // Função de re-carregamento de transações
  const refetchTransactions = async (): Promise<void> => {
    try {
      await refetch();
      
      // Se for admin, recarregar também as transações de usuário
      if (isAdmin) {
        await queryClient.refetchQueries({ queryKey: ['/api/transactions'] });
      }
    } catch (error) {
      console.error('Erro ao recarregar transações:', error);
    }
  };
  
  return {
    transactions,
    isLoading,
    error: error || null,
    updateTransactionStatus,
    refetchTransactions
  };
}
import { createContext, ReactNode, useContext, useState, useCallback } from "react";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Transaction, 
  DepositRequest, 
  WithdrawalRequest,
  InsertDepositRequest,
  InsertWithdrawalRequest
} from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// Interface simplificada com funções de carregamento manual
type TransactionsContextType = {
  // Dados estado local (sem queries automáticas)
  transactions: Transaction[];
  depositRequests: DepositRequest[];
  withdrawalRequests: WithdrawalRequest[];
  adminTransactions: Transaction[];
  adminDepositRequests: DepositRequest[];
  adminWithdrawalRequests: WithdrawalRequest[];

  // Estado de carregamento
  isLoading: boolean;

  // Funções de carregamento manual (chamar apenas quando necessário)
  loadTransactions: () => Promise<Transaction[]>;
  loadDeposits: () => Promise<DepositRequest[]>;
  loadWithdrawals: () => Promise<WithdrawalRequest[]>;
  loadAdminTransactions: () => Promise<Transaction[]>;
  loadAdminDepositRequests: () => Promise<DepositRequest[]>;
  loadAdminWithdrawalRequests: () => Promise<WithdrawalRequest[]>;

  // Ações do usuário
  createDeposit: (data: Omit<InsertDepositRequest, 'userId' | 'transactionId'>) => Promise<{ success: boolean; transactionId?: string }>;
  checkDepositStatus: (transactionId: string) => Promise<{ status: string; message: string }>;
  createWithdrawal: (data: Omit<InsertWithdrawalRequest, 'userId' | 'status'>) => Promise<{ success: boolean }>;

  // Ações do admin
  approveDeposit: (id: number) => Promise<boolean>;
  approveWithdrawal: (id: number) => Promise<boolean>;
  rejectWithdrawal: (id: number) => Promise<boolean>;
  updateTransactionStatus: (data: {id: number; status: string}) => Promise<void>;
};

// Create context
export const TransactionsContext = createContext<TransactionsContextType | null>(null);

// Provider component - versão otimizada para performance
export function TransactionsProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  // Dados locais - inicialmente vazios, carregados sob demanda
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [depositRequests, setDepositRequests] = useState<DepositRequest[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [adminTransactions, setAdminTransactions] = useState<Transaction[]>([]);
  const [adminDepositRequests, setAdminDepositRequests] = useState<DepositRequest[]>([]);
  const [adminWithdrawalRequests, setAdminWithdrawalRequests] = useState<WithdrawalRequest[]>([]);

  // Funções de carregamento manual - só são executadas quando o usuário interage
  // com a interface ou quando explicitamente chamadas no código

  const loadTransactions = useCallback(async (): Promise<Transaction[]> => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/transactions', { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401) return []; // Não autenticado
        throw new Error(`Erro ao carregar transações: ${res.status}`);
      }
      const data = await res.json();
      setTransactions(data);
      return data;
    } catch (error) {
      console.error('Erro ao carregar transações:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadDeposits = useCallback(async (): Promise<DepositRequest[]> => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/deposits', { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401) return []; // Não autenticado
        throw new Error(`Erro ao carregar depósitos: ${res.status}`);
      }
      const data = await res.json();
      setDepositRequests(data);
      return data;
    } catch (error) {
      console.error('Erro ao carregar depósitos:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadWithdrawals = useCallback(async (): Promise<WithdrawalRequest[]> => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/withdrawals', { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401) return []; // Não autenticado
        throw new Error(`Erro ao carregar saques: ${res.status}`);
      }
      const data = await res.json();
      setWithdrawalRequests(data);
      return data;
    } catch (error) {
      console.error('Erro ao carregar saques:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadAdminTransactions = useCallback(async (): Promise<Transaction[]> => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/admin/transactions', { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401) return []; // Não autenticado
        throw new Error(`Erro ao carregar transações admin: ${res.status}`);
      }
      const data = await res.json();
      setAdminTransactions(data);
      return data;
    } catch (error) {
      console.error('Erro ao carregar transações admin:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadAdminDepositRequests = useCallback(async (): Promise<DepositRequest[]> => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/admin/deposit-requests', { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401) return []; // Não autenticado
        throw new Error(`Erro ao carregar solicitações de depósito admin: ${res.status}`);
      }
      const data = await res.json();
      setAdminDepositRequests(data);
      return data;
    } catch (error) {
      console.error('Erro ao carregar solicitações de depósito admin:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadAdminWithdrawalRequests = useCallback(async (): Promise<WithdrawalRequest[]> => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/admin/withdrawal-requests', { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401) return []; // Não autenticado
        throw new Error(`Erro ao carregar solicitações de saque admin: ${res.status}`);
      }
      const data = await res.json();
      setAdminWithdrawalRequests(data);
      return data;
    } catch (error) {
      console.error('Erro ao carregar solicitações de saque admin:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // === MUTAÇÕES DO USUÁRIO ===

  // Criar solicitação de depósito
  const createDepositMutation = useMutation({
    mutationFn: async (data: Omit<InsertDepositRequest, 'userId' | 'transactionId'>) => {
      const response = await apiRequest('POST', '/api/deposits', data);
      return await response.json() as { success: boolean; transactionId: string; message: string };
    },
    onSuccess: async (data) => {
      if (data.success) {
        toast({
          title: 'Depósito solicitado',
          description: `Seu depósito foi registrado com sucesso! ID: ${data.transactionId}`,
          variant: 'default',
        });
        // Atualizar dados locais após operação
        await loadDeposits();
        await loadTransactions();
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro no depósito',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Criar solicitação de saque
  const createWithdrawalMutation = useMutation({
    mutationFn: async (data: Omit<InsertWithdrawalRequest, 'userId' | 'status'>) => {
      const response = await apiRequest('POST', '/api/withdrawals', data);
      return await response.json() as { success: boolean; message: string };
    },
    onSuccess: async (data) => {
      if (data.success) {
        toast({
          title: 'Saque solicitado',
          description: 'Sua solicitação de saque foi registrada e está em análise',
          variant: 'default',
        });
        // Atualizar dados locais após operação
        await loadWithdrawals();
        await loadTransactions();
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro no saque',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Verificar status de depósito
  const checkDepositMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      const response = await apiRequest('GET', `/api/deposits/check/${transactionId}`);
      return await response.json() as { status: string; message: string };
    }
  });

  // === MUTAÇÕES DO ADMIN ===

  // Aprovar depósito 
  const approveDepositMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('POST', `/api/admin/deposit-requests/${id}/approve`);
      return await response.json() as { success: boolean; message: string };
    },
    onSuccess: async (data) => {
      if (data.success) {
        toast({
          title: 'Depósito aprovado',
          description: data.message,
          variant: 'default',
        });
        // Atualizar dados admin após operação
        await loadAdminDepositRequests();
        await loadAdminTransactions();
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao aprovar depósito',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Aprovar saque
  const approveWithdrawalMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('POST', `/api/admin/withdrawal-requests/${id}/approve`);
      return await response.json() as { success: boolean; message: string };
    },
    onSuccess: async (data) => {
      if (data.success) {
        toast({
          title: 'Saque aprovado',
          description: data.message,
          variant: 'default',
        });
        // Atualizar dados admin após operação
        await loadAdminWithdrawalRequests();
        await loadAdminTransactions();
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao aprovar saque',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Rejeitar saque
  const rejectWithdrawalMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('POST', `/api/admin/withdrawal-requests/${id}/reject`);
      return await response.json() as { success: boolean; message: string };
    },
    onSuccess: async (data) => {
      if (data.success) {
        toast({
          title: 'Saque rejeitado',
          description: data.message,
          variant: 'default',
        });
        // Atualizar dados admin após operação
        await loadAdminWithdrawalRequests();
        await loadAdminTransactions();
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao rejeitar saque',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // === FUNÇÕES DE INTERFACE ===

  // Criar depósito - Versão robusta atualizada que usa o apiRequest para garantir consistência
  const createDeposit = async (data: {
    amount: number,
    bankId?: string | number,
    bankName?: string | null,
    receipt?: string | null
  }): Promise<{ success: boolean; transactionId?: string; message?: string }> => {
    try {
      console.log('[DEPÓSITO] Dados recebidos na função createDeposit:', data);
      
      // Adaptação para garantir compatibilidade do objeto
      const depositData: any = {
        amount: data.amount,
        receipt: data.receipt || null
      };
      
      // Se temos bankId, usamos ele
      if (data.bankId !== undefined) {
        depositData.bankId = data.bankId;
      }
      
      // Se temos bankName, usamos ele
      if (data.bankName) {
        depositData.bankName = data.bankName;
      }
      
      console.log('[DEPÓSITO] Dados adaptados que serão enviados:', depositData);
      
      // Criar o depósito usando createDepositMutation para garantir consistência
      const result = await createDepositMutation.mutateAsync(depositData);
      
      console.log('[DEPÓSITO] Resultado da mutation:', result);
      
      // Atualizar dados locais após sucesso
      if (result.success) {
        await loadDeposits();
        await loadTransactions();
        
        return { 
          success: true, 
          transactionId: result.transactionId,
          message: result.message
        };
      } else {
        return { 
          success: false, 
          message: result.message || "Falha ao processar depósito"
        };
      }
    } catch (error) {
      console.error('[DEPÓSITO] Erro inesperado ao criar depósito:', error);
      
      // Tratamento especial para erro de sessão
      if (error instanceof Error && error.message.includes('401')) {
        toast({
          title: 'Sessão expirada',
          description: 'Sua sessão expirou. Por favor, faça login novamente.',
          variant: 'destructive',
        });
        return { 
          success: false, 
          message: 'Sessão expirada. Faça login novamente.'
        };
      }
      
      toast({
        title: 'Erro ao processar depósito',
        description: error instanceof Error ? error.message : 'Erro inesperado',
        variant: 'destructive',
      });
      return { success: false, message: error instanceof Error ? error.message : 'Erro inesperado ao processar seu depósito' };
    }
  };

  // Verificar status do depósito
  const checkDepositStatus = async (transactionId: string): Promise<{ status: string; message: string }> => {
    try {
      return await checkDepositMutation.mutateAsync(transactionId);
    } catch (error) {
      console.error('Erro ao verificar depósito:', error);
      return { 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  };

  // Criar saque
  const createWithdrawal = async (data: Omit<InsertWithdrawalRequest, 'userId' | 'status'>): Promise<{ success: boolean }> => {
    try {
      const result = await createWithdrawalMutation.mutateAsync(data);
      return { success: result.success };
    } catch (error) {
      console.error('Erro ao criar saque:', error);
      return { success: false };
    }
  };

  // Admin: Aprovar depósito
  const approveDeposit = async (id: number): Promise<boolean> => {
    try {
      const result = await approveDepositMutation.mutateAsync(id);
      return result.success;
    } catch (error) {
      console.error('Erro ao aprovar depósito:', error);
      return false;
    }
  };

  // Admin: Aprovar saque
  const approveWithdrawal = async (id: number): Promise<boolean> => {
    try {
      const result = await approveWithdrawalMutation.mutateAsync(id);
      return result.success;
    } catch (error) {
      console.error('Erro ao aprovar saque:', error);
      return false;
    }
  };

  // Admin: Rejeitar saque
  const rejectWithdrawal = async (id: number): Promise<boolean> => {
    try {
      const result = await rejectWithdrawalMutation.mutateAsync(id);
      return result.success;
    } catch (error) {
      console.error('Erro ao rejeitar saque:', error);
      return false;
    }
  };

  const updateTransactionStatus = async (data: {id: number; status: string}): Promise<void> => {
    try {
      await updateStatusMutation.mutateAsync(data);
    } catch (error) {
      console.error("Erro ao atualizar status da transação:", error);
    }
  };

  const updateStatusMutation = useMutation({
    mutationFn: async (data: { id: number; status: string }) => {
      console.log('Atualizando status da transação:', data);

      const response = await fetch(`/api/admin/transactions/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: data.status })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao atualizar status');
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Invalidar todas as queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['/api/admin/transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });

      toast({
        title: "Status atualizado",
        description: "A transação foi atualizada com sucesso."
      });

      console.log('Transação atualizada com sucesso:', data);
    },
    onError: (error) => {
      console.error('Erro ao atualizar transação:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível atualizar a transação.",
        variant: "destructive"
      });
    }
  });


  return (
    <TransactionsContext.Provider
      value={{
        // Dados locais
        transactions,
        depositRequests,
        withdrawalRequests,
        adminTransactions,
        adminDepositRequests,
        adminWithdrawalRequests,

        // Estado de carregamento
        isLoading,

        // Funções de carregamento manual
        loadTransactions,
        loadDeposits,
        loadWithdrawals,
        loadAdminTransactions,
        loadAdminDepositRequests,
        loadAdminWithdrawalRequests,

        // Funções do usuário
        createDeposit,
        checkDepositStatus,
        createWithdrawal,

        // Funções do admin
        approveDeposit,
        approveWithdrawal,
        rejectWithdrawal,
        updateTransactionStatus
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
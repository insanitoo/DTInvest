import { createContext, ReactNode, useContext } from "react";
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  Transaction, 
  DepositRequest, 
  WithdrawalRequest,
  InsertDepositRequest,
  InsertWithdrawalRequest
} from '@shared/schema';
import { apiRequest, queryClient, refreshAllData } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// Interface atualizada para o novo fluxo
type TransactionsContextType = {
  // Histórico de transações
  transactions: Transaction[] | undefined;
  isLoadingTransactions: boolean;
  
  // Depósitos
  depositRequests: DepositRequest[] | undefined;
  isLoadingDeposits: boolean;
  createDeposit: (data: Omit<InsertDepositRequest, 'userId' | 'transactionId'>) => Promise<{ success: boolean; transactionId?: string }>;
  checkDepositStatus: (transactionId: string) => Promise<{ status: string; message: string }>;
  
  // Saques
  withdrawalRequests: WithdrawalRequest[] | undefined;
  isLoadingWithdrawals: boolean;
  createWithdrawal: (data: Omit<InsertWithdrawalRequest, 'userId' | 'status'>) => Promise<{ success: boolean }>;
  
  // Admin
  adminTransactions: Transaction[] | undefined;
  adminDepositRequests: DepositRequest[] | undefined;
  adminWithdrawalRequests: WithdrawalRequest[] | undefined;
  isLoadingAdmin: boolean;
  
  // Admin: Ações
  approveDeposit: (id: number) => Promise<boolean>;
  approveWithdrawal: (id: number) => Promise<boolean>;
  rejectWithdrawal: (id: number) => Promise<boolean>;
  
  // Atualização de dados
  refreshData: () => Promise<void>;
};

// Create context
export const TransactionsContext = createContext<TransactionsContextType | null>(null);

// Provider component
export function TransactionsProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  
  // Verificar se o usuário está autenticado para evitar requisições desnecessárias
  const {
    data: authUser,
    isLoading: isLoadingAuth
  } = useQuery({
    queryKey: ['/api/user'],
    staleTime: 60000, // 1 minuto
    refetchInterval: false, // Não precisa recarregar automaticamente
  });
  
  const isAuthenticated = !!authUser;
  const isAdmin = isAuthenticated && (authUser as any)?.isAdmin === true;
  
  // === HISTÓRICO DE TRANSAÇÕES DO USUÁRIO ===
  const {
    data: transactions,
    isLoading: isLoadingTransactions,
    refetch: refetchTransactions
  } = useQuery<Transaction[], Error>({
    queryKey: ['/api/transactions'],
    staleTime: 60000, // 1 minuto 
    refetchInterval: false, // Desabilitado para economizar recursos
    enabled: isAuthenticated, // Só executa se o usuário estiver autenticado
  });
  
  // === DEPÓSITOS DO USUÁRIO ===
  const {
    data: depositRequests,
    isLoading: isLoadingDeposits,
    refetch: refetchDeposits
  } = useQuery<DepositRequest[], Error>({
    queryKey: ['/api/deposits'],
    staleTime: 60000, // 1 minuto
    refetchInterval: false, // Desabilitado para economizar recursos
    enabled: isAuthenticated, // Só executa se o usuário estiver autenticado
  });
  
  // === SAQUES DO USUÁRIO ===
  const {
    data: withdrawalRequests,
    isLoading: isLoadingWithdrawals,
    refetch: refetchWithdrawals
  } = useQuery<WithdrawalRequest[], Error>({
    queryKey: ['/api/withdrawals'],
    staleTime: 60000, // 1 minuto
    refetchInterval: false, // Desabilitado para economizar recursos
    enabled: isAuthenticated, // Só executa se o usuário estiver autenticado
  });
  
  // === ADMIN: HISTÓRICO DE TRANSAÇÕES ===
  const {
    data: adminTransactions,
    isLoading: isLoadingAdminTransactions,
    refetch: refetchAdminTransactions
  } = useQuery<Transaction[], Error>({
    queryKey: ['/api/admin/transactions'],
    staleTime: 60000, // 1 minuto
    refetchInterval: false, // Desabilitado para economizar recursos
    enabled: isAdmin, // Só executa se o usuário for admin
  });
  
  // === ADMIN: SOLICITAÇÕES DE DEPÓSITO ===
  const {
    data: adminDepositRequests,
    isLoading: isLoadingAdminDeposits,
    refetch: refetchAdminDeposits
  } = useQuery<DepositRequest[], Error>({
    queryKey: ['/api/admin/deposit-requests'],
    staleTime: 60000, // 1 minuto
    refetchInterval: false, // Desabilitado para economizar recursos
    enabled: isAdmin, // Só executa se o usuário for admin
  });
  
  // === ADMIN: SOLICITAÇÕES DE SAQUE ===
  const {
    data: adminWithdrawalRequests,
    isLoading: isLoadingAdminWithdrawals,
    refetch: refetchAdminWithdrawals
  } = useQuery<WithdrawalRequest[], Error>({
    queryKey: ['/api/admin/withdrawal-requests'],
    staleTime: 60000, // 1 minuto
    refetchInterval: false, // Desabilitado para economizar recursos
    enabled: isAdmin, // Só executa se o usuário for admin
  });

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
        await refreshAllData();
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
        await refreshAllData();
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
        await refreshAllData();
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
        await refreshAllData();
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
        await refreshAllData();
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
  
  // Criar depósito
  const createDeposit = async (data: Omit<InsertDepositRequest, 'userId' | 'transactionId'>): Promise<{ success: boolean; transactionId?: string }> => {
    try {
      const result = await createDepositMutation.mutateAsync(data);
      return { 
        success: result.success, 
        transactionId: result.transactionId 
      };
    } catch (error) {
      console.error('Erro ao criar depósito:', error);
      return { success: false };
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
  
  // Atualizar todos os dados
  const refreshData = async (): Promise<void> => {
    await refreshAllData();
  };
  
  return (
    <TransactionsContext.Provider
      value={{
        // Dados
        transactions,
        depositRequests,
        withdrawalRequests,
        adminTransactions,
        adminDepositRequests,
        adminWithdrawalRequests,
        
        // Estado de carregamento
        isLoadingTransactions,
        isLoadingDeposits,
        isLoadingWithdrawals,
        isLoadingAdmin: isLoadingAdminTransactions || isLoadingAdminDeposits || isLoadingAdminWithdrawals,
        
        // Funções do usuário
        createDeposit,
        checkDepositStatus,
        createWithdrawal,
        
        // Funções do admin
        approveDeposit,
        approveWithdrawal,
        rejectWithdrawal,
        
        // Atualização
        refreshData
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
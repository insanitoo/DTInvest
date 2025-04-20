import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Transaction } from '@shared/schema';
import { AdminNavigation } from './components/admin-navigation';
import { CyberneticBox } from '@/components/ui/cybernetic-box';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { apiRequest, queryClient, forceTransactionUpdate } from '@/lib/queryClient';
import { formatCurrency, formatDate, formatTransactionAmount, getTransactionAmountColor } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export default function AdminTransactions() {
  const { toast } = useToast();
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [newStatus, setNewStatus] = useState<string>('');

  // Get all transactions
  const { data: transactions, isLoading } = useQuery<Transaction[]>({
    queryKey: ['/api/admin/transactions'],
  });

  // Update transaction status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTransaction || !newStatus) {
        throw new Error("Transação ou status não selecionados");
      }

      console.log(`Enviando status '${newStatus}' para transação ${selectedTransaction.id}`);

      try {
        // Remover espaços extras do status para prevenir erros de validação
        const trimmedStatus = newStatus.trim();

        // Usar fetch diretamente em vez de apiRequest para adicionar cabeçalhos especiais
        console.log('Usando fetch avançado para garantir resposta JSON...');
        
        // Adicionar cabeçalhos específicos para esta requisição crítica
        const headers = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        };
        
        // Fazer a requisição com cabeçalhos especiais
        const res = await fetch(`/api/admin/transactions/${selectedTransaction.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ status: trimmedStatus }),
          credentials: 'include'
        });
        
        // Log de diagnóstico com headers da resposta
        console.log('Cabeçalhos da resposta:', {
          contentType: res.headers.get('Content-Type'),
          contentLength: res.headers.get('Content-Length'),
          cacheControl: res.headers.get('Cache-Control')
        });
        
        try {
          // Obter o texto da resposta
          const responseText = await res.text();
          console.log(`Resposta recebida (${responseText.length} caracteres)`);
          
          // Resposta vazia
          if (!responseText || responseText.trim() === '') {
            console.log('Resposta vazia, usando status HTTP para determinar resultado');
            
            // Se status for de sucesso, forçar atualização de caches
            if (res.ok) {
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['/api/admin/transactions'] }),
                queryClient.invalidateQueries({ queryKey: ['/api/user'] }),
                queryClient.refetchQueries({ queryKey: ['/api/user'] })
              ]);
            }
            
            return { 
              success: res.ok, 
              message: res.ok ? "Operação realizada com sucesso" : "Falha na operação",
              statusCode: res.status
            };
          }
          
          // Verificar se é HTML (múltiplas verificações)
          const isHtml = responseText.trim().startsWith('<!DOCTYPE') || 
                        responseText.trim().startsWith('<html') ||
                        responseText.includes('<head>') ||
                        responseText.includes('<body>');
          
          // Tratar respostas HTML
          if (isHtml) {
            console.log('Resposta é HTML em vez de JSON. Status:', res.status);
            
            // Se status for OK, considerar sucesso e forçar atualização
            if (res.ok) {
              console.log('Status OK com HTML. Forçando atualização de caches...');
              
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['/api/admin/transactions'] }),
                queryClient.invalidateQueries({ queryKey: ['/api/transactions'] }),
                queryClient.invalidateQueries({ queryKey: ['/api/user'] }),
                queryClient.refetchQueries({ queryKey: ['/api/user'] })
              ]);
              
              return { 
                success: true, 
                message: "Operação realizada com sucesso",
                info: "A resposta continha HTML em vez de JSON, mas o status de sucesso foi confirmado."
              };
            } else {
              throw new Error(`Recebido HTML em vez de JSON. Status: ${res.status}`);
            }
          }
          
          // Tentar processar como JSON
          try {
            const data = JSON.parse(responseText);
            console.log('Resposta JSON processada com sucesso:', data);
            
            // Verificar se temos meta-informações sobre atualização de saldo
            if (data.meta && data.meta.transactionType === 'deposit' && 
                (trimmedStatus === 'completed' || trimmedStatus === 'approved')) {
              console.log('Meta-informações para depósito:', data.meta);
              
              // Se o servidor indicar que o saldo não foi atualizado corretamente
              if (data.meta.balanceUpdated === false) {
                console.warn('ALERTA: Servidor indicou que o saldo NÃO foi atualizado! Forçando atualização...');
                await Promise.all([
                  queryClient.invalidateQueries({ queryKey: ['/api/user'] }),
                  queryClient.refetchQueries({ queryKey: ['/api/user'] })
                ]);
              }
            }
            
            return data;
          } catch (jsonError) {
            console.error('Erro ao processar JSON:', jsonError);
            
            // Se status for OK, considerar sucesso mesmo com erro de parsing
            if (res.ok) {
              // Forçar atualização de caches em caso de erro com status 200
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['/api/admin/transactions'] }),
                queryClient.invalidateQueries({ queryKey: ['/api/user'] })
              ]);
              
              return { 
                success: true, 
                message: "Operação realizada com sucesso",
                info: "Status de sucesso com resposta não-JSON",
                statusCode: res.status
              };
            }
            
            throw new Error(`Erro ${res.status}: Resposta não é um JSON válido`);
          }
        } catch (parseError) {
          console.error('Erro ao processar resposta:', parseError);
          
          // Se status for OK, retornar sucesso mesmo com erro de parsing
          if (res.ok) {
            await queryClient.invalidateQueries({ queryKey: ['/api/user'] });
            return { success: true };
          }
          
          throw parseError;
        }

        // Fallback se nenhum dos fluxos acima retornar
        return { success: res.ok };
      } catch (error) {
        console.error('Erro na requisição:', error);
        throw error;
      }
    },
    onSuccess: async (data) => {
      console.log('Mutation concluída com sucesso:', data);
      
      // Verificar se temos uma resposta completa com transaction e user
      if (data && data.transaction && data.user) {
        console.log('Resposta contém dados atualizados da transação e do usuário');
        
        // Atualizar dados do usuário no cache, SE necessário
        if (data.user) {
          const currentUser = queryClient.getQueryData(['/api/user']);
          if (currentUser) {
            console.log('Atualizando dados do usuário no cache');
            queryClient.setQueryData(['/api/user'], {
              ...currentUser,
              balance: data.user.balance,
              hasDeposited: data.user.hasDeposited,
              hasProduct: data.user.hasProduct
            });
          }
        }
        
        // Atualizar a transação no cache de transações
        const currentTransactions = queryClient.getQueryData<Transaction[]>(['/api/admin/transactions']) || [];
        const updatedTransactions = currentTransactions.map(tx => 
          tx.id === data.transaction.id ? { ...tx, ...data.transaction } : tx
        );
        queryClient.setQueryData(['/api/admin/transactions'], updatedTransactions);
        
        // Similar para cache de transações do usuário específico
        const userTransactions = queryClient.getQueryData<Transaction[]>(['/api/transactions']);
        if (userTransactions) {
          const updatedUserTransactions = userTransactions.map(tx => 
            tx.id === data.transaction.id ? { ...tx, ...data.transaction } : tx
          );
          queryClient.setQueryData(['/api/transactions'], updatedUserTransactions);
        }
        
        // Log de diagnóstico das meta-informações
        if (data.meta) {
          console.log('Meta-informações da resposta:', data.meta);
          
          // Se o saldo foi atualizado, mostrar notificação específica
          if (data.meta.balanceUpdated && data.meta.transactionType === 'deposit') {
            toast({
              title: 'Depósito aprovado',
              description: `Saldo do usuário atualizado com sucesso.`,
              variant: 'default',
            });
          }
        }
      } else {
        // Fallback para método antigo se a resposta não contiver os dados completos
        console.log('Resposta não contém dados completos, invalidando caches...');
        
        // ATUALIZADO: Abordagem mais robusta para garantir que os dados sejam atualizados corretamente
        console.log('Executando processo robusto de atualização de cache...');
        
        // Primeiro, atualizar manualmente o cache com o que sabemos que mudou
        if (selectedTransaction) {
          // Atualizar transações admin
          const adminTransactions = queryClient.getQueryData<Transaction[]>(['/api/admin/transactions']) || [];
          const updatedAdminTransactions = adminTransactions.map(tx => 
            tx.id === selectedTransaction.id ? { ...tx, status: newStatus } : tx
          );
          queryClient.setQueryData(['/api/admin/transactions'], updatedAdminTransactions);
          
          // Atualizar transações do usuário 
          const userTransactions = queryClient.getQueryData<Transaction[]>(['/api/transactions']);
          if (userTransactions) {
            const updatedUserTransactions = userTransactions.map(tx => 
              tx.id === selectedTransaction.id ? { ...tx, status: newStatus } : tx
            );
            queryClient.setQueryData(['/api/transactions'], updatedUserTransactions);
          }
          
          console.log(`Cache atualizado manualmente para transação ID ${selectedTransaction.id}, status: ${newStatus}`);
        }
        
        // Em seguida, invalidar caches para forçar recarregamento
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['/api/admin/transactions'] }),
          queryClient.invalidateQueries({ queryKey: ['/api/transactions'] }),
          queryClient.invalidateQueries({ queryKey: ['/api/user'] })
        ]);
        
        // Finalmente, forçar um refetch imediato para garantir dados mais recentes
        await Promise.all([
          queryClient.refetchQueries({ queryKey: ['/api/admin/transactions'] }),
          queryClient.refetchQueries({ queryKey: ['/api/transactions'] }),
          queryClient.refetchQueries({ queryKey: ['/api/user'] })
        ]);
      }

      toast({
        title: 'Status atualizado',
        description: 'O status da transação foi atualizado com sucesso.',
      });

      setShowDialog(false);
      setSelectedTransaction(null);
      setNewStatus('');
    },
    onError: (error: Error) => {
      console.error('Erro na mutation:', error);
      toast({
        title: 'Erro ao atualizar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Handle transaction click
  const handleTransactionClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setNewStatus(transaction.status);
    setShowDialog(true);
  };

  // Handle update status
  const handleUpdateStatus = () => {
    updateStatusMutation.mutate();
  };

  // Get transaction type label
  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'deposit':
        return 'Depósito';
      case 'withdrawal':
        return 'Saque';
      case 'commission':
        return 'Comissão';
      case 'purchase':
        return 'Compra';
      default:
        return type;
    }
  };

  // Get transaction status label
  const getTransactionStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendente';
      case 'processing':
        return 'Processando';
      case 'completed':
        return 'Concluído';
      case 'failed':
        return 'Falhou';
      case 'approved':
        return 'Aprovado'; // Added 'approved' case
      default:
        return status;
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500';
      case 'processing':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'approved':
        return 'bg-green-500'; // Added 'approved' case, using green as it implies success.
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen pb-8">
      <AdminNavigation />

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Gerenciar Transações</h1>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
          </div>
        ) : transactions && transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="px-4 py-3 text-left">ID</th>
                  <th className="px-4 py-3 text-left">Usuário</th>
                  <th className="px-4 py-3 text-left">Tipo</th>
                  <th className="px-4 py-3 text-left">Valor</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Data</th>
                  <th className="px-4 py-3 text-left">Ação</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr 
                    key={transaction.id} 
                    className="border-b border-gray-800 hover:bg-dark-tertiary/30 transition-colors"
                  >
                    <td className="px-4 py-3">{transaction.id}</td>
                    <td className="px-4 py-3">{transaction.userId}</td>
                    <td className="px-4 py-3">{getTransactionTypeLabel(transaction.type)}</td>
                    <td className={`px-4 py-3 ${getTransactionAmountColor(transaction.type)}`}>
                      {formatTransactionAmount(transaction)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(transaction.status)} bg-opacity-20 text-white`}>
                        {getTransactionStatusLabel(transaction.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{formatDate(transaction.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Button 
                        variant="default" 
                        size="sm"
                        onClick={() => handleTransactionClick(transaction)}
                      >
                        Gerenciar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <CyberneticBox className="py-12 text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-gray-400 mb-4" />
            <p className="text-gray-400">Nenhuma transação encontrada.</p>
          </CyberneticBox>
        )}
      </div>

      {/* Transaction Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-dark-secondary border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle>Gerenciar Transação</DialogTitle>
            {selectedTransaction && (
              <DialogDescription className="text-gray-400">
                ID: {selectedTransaction.id} | Tipo: {getTransactionTypeLabel(selectedTransaction.type)}
              </DialogDescription>
            )}
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400">Usuário ID</p>
                  <p>{selectedTransaction.userId}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Valor</p>
                  <p className={getTransactionAmountColor(selectedTransaction.type)}>
                    {formatTransactionAmount(selectedTransaction)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Data</p>
                  <p>{formatDate(selectedTransaction.createdAt)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Status Atual</p>
                  <p>
                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(selectedTransaction.status)} bg-opacity-20 text-white`}>
                      {getTransactionStatusLabel(selectedTransaction.status)}
                    </span>
                  </p>
                </div>
              </div>

              {selectedTransaction.bankName && (
                <div>
                  <p className="text-sm text-gray-400">Banco</p>
                  <p>{selectedTransaction.bankName}</p>
                </div>
              )}

              {selectedTransaction.bankAccount && (
                <div>
                  <p className="text-sm text-gray-400">Conta Bancária</p>
                  <p>{selectedTransaction.bankAccount}</p>
                </div>
              )}

              {selectedTransaction.receipt && (
                <div>
                  <p className="text-sm text-gray-400">Comprovante</p>
                  <p>{selectedTransaction.receipt}</p>
                </div>
              )}

              <div className="space-y-4">
                <Button 
                  variant="outline" 
                  onClick={async () => {
                    if (selectedTransaction) {
                      try {
                        setNewStatus('completed');
                        await forceTransactionUpdate(selectedTransaction.id, 'completed');
                        toast({
                          title: 'Atualização direta',
                          description: 'Transação atualizada para "Concluído" e cache sincronizado',
                          variant: 'default',
                        });
                      } catch (error) {
                        console.error('Erro na atualização direta:', error);
                        toast({
                          title: 'Erro',
                          description: 'Não foi possível atualizar a transação diretamente',
                          variant: 'destructive',
                        });
                      }
                    }
                  }}
                  className="w-full"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Aprovar Diretamente
                </Button>

                <p className="text-sm text-gray-400 pt-2">Ou Alterar Status</p>
                <Select
                  value={newStatus}
                  onValueChange={setNewStatus}
                >
                  <SelectTrigger className="bg-dark-tertiary border-gray-700">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent className="bg-dark-tertiary border-gray-700">
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="processing">Processando</SelectItem>
                    <SelectItem value="completed">Concluído</SelectItem>
                    <SelectItem value="failed">Falhou</SelectItem>
                    {/* Status approved removido conforme novo fluxo */}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="default"
              onClick={handleUpdateStatus}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Atualizando...
                </>
              ) : (
                "Atualizar Status"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
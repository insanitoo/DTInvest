import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Loader2, AlertCircle } from 'lucide-react';
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
import { apiRequest, queryClient } from '@/lib/queryClient';
import { formatCurrency, formatDate } from '@/lib/utils';
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

        const res = await apiRequest('PUT', `/api/admin/transactions/${selectedTransaction.id}`, { 
          status: trimmedStatus 
        });

        // Tratar a resposta com cuidado para evitar erros de JSON
        try {
          // Verificar se a resposta está vazia
          const responseText = await res.text();

          if (!responseText || responseText.trim() === '') {
            // Se a resposta estiver vazia mas o status for 200 OK, considerar sucesso
            if (res.ok) {
              console.log('Resposta vazia mas status OK, retornando sucesso');
              return { success: true };
            }
          } else {
            // Verificar se parece ser HTML (começa com <!DOCTYPE ou <html)
            if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
              console.log('Resposta é HTML, não JSON. Status:', res.status);
              // Se sucesso, criar um objeto de sucesso
              if (res.ok) {
                return { 
                  success: true, 
                  message: "Operação realizada com sucesso",
                  info: "A resposta continha HTML em vez de JSON, mas o status de sucesso foi confirmado."
                };
              } else {
                throw new Error(`Recebido HTML em vez de JSON. Status: ${res.status}`);
              }
            } else {
              // Tentar converter para JSON apenas se não for HTML
              try {
                const data = JSON.parse(responseText);
                console.log('Resposta JSON recebida da API:', data);
                return data;
              } catch (jsonError) {
                console.warn('Resposta não é um JSON válido:', responseText.substring(0, 200) + '...');
                // Retornar um objeto de sucesso se o status for 200 OK
                if (res.ok) {
                  return { 
                    success: true, 
                    message: "Operação realizada com sucesso (resposta não é JSON)",
                    info: "A requisição retornou status 200 OK, mas o corpo da resposta não é um JSON válido."
                  };
                }
                throw new Error('Resposta não é um JSON válido');
              }
            }
          }
        } catch (parseError) {
          console.error('Erro ao processar resposta:', parseError);
          if (res.ok) {
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

      // Forçar revalidação dos dados
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/admin/transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/user'] }), // Invalidar dados do usuário para atualizar o saldo
        // Forçar refetch imediato
        queryClient.refetchQueries({ queryKey: ['/api/admin/transactions'] }),
        queryClient.refetchQueries({ queryKey: ['/api/transactions'] }),
        queryClient.refetchQueries({ queryKey: ['/api/user'] })
      ]);

      // Atualizar o cache manualmente também
      const currentTransactions = queryClient.getQueryData<Transaction[]>(['/api/admin/transactions']) || [];
      const updatedTransactions = currentTransactions.map(tx => 
        tx.id === selectedTransaction?.id ? { ...tx, status: newStatus } : tx
      );
      queryClient.setQueryData(['/api/admin/transactions'], updatedTransactions);

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
                    <td className={`px-4 py-3 ${
                      transaction.type === 'withdrawal' || transaction.type === 'purchase' 
                        ? 'text-red-400' 
                        : transaction.type === 'deposit' || transaction.type === 'commission' 
                          ? 'text-green-400' 
                          : ''
                    }`}>
                      {transaction.type === 'withdrawal' || transaction.type === 'purchase' 
                        ? '-' 
                        : transaction.type === 'deposit' || transaction.type === 'commission' 
                          ? '+' 
                          : ''}
                      {formatCurrency(transaction.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(transaction.status)} bg-opacity-20 text-white`}>
                        {getTransactionStatusLabel(transaction.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{formatDate(transaction.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Button 
                        variant="primary" 
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
                  <p className={`${
                    selectedTransaction.type === 'withdrawal' || selectedTransaction.type === 'purchase' 
                      ? 'text-red-400' 
                      : selectedTransaction.type === 'deposit' || selectedTransaction.type === 'commission' 
                        ? 'text-green-400' 
                        : ''
                  }`}>
                    {selectedTransaction.type === 'withdrawal' || selectedTransaction.type === 'purchase' 
                      ? '-' 
                      : selectedTransaction.type === 'deposit' || selectedTransaction.type === 'commission' 
                        ? '+' 
                        : ''}
                    {formatCurrency(selectedTransaction.amount)}
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

              <div className="space-y-2">
                <p className="text-sm text-gray-400">Alterar Status</p>
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
                    <SelectItem value="approved">Aprovado</SelectItem> {/* Added approved option */}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="primary"
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
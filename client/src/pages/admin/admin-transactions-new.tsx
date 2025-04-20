import { useState } from 'react';
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
import { formatCurrency, formatDate, formatTransactionAmount, getTransactionAmountColor } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useTransactions } from '@/hooks/use-transactions';

export default function AdminTransactions() {
  const { toast } = useToast();
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [newStatus, setNewStatus] = useState<string>('');

  // Usar o hook de transações
  const { 
    transactions, 
    isLoading, 
    updateTransactionStatus, 
    refetchTransactions 
  } = useTransactions(true); // true = modo admin

  // Manipular clique na transação para abrir diálogo
  const handleTransactionClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setNewStatus(transaction.status);
    setShowDialog(true);
  };

  // Atualizar status usando o hook simplificado
  const handleUpdateStatus = async () => {
    if (!selectedTransaction || !newStatus) {
      toast({
        title: 'Erro',
        description: 'Selecione uma transação e um status',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      const success = await updateTransactionStatus(selectedTransaction.id, newStatus);
      
      if (success) {
        toast({
          title: 'Status atualizado',
          description: `Transação #${selectedTransaction.id} atualizada para "${newStatus}"`,
          variant: 'default',
        });
        setShowDialog(false);
        await refetchTransactions();
      } else {
        toast({
          title: 'Erro',
          description: 'Falha ao atualizar status da transação',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast({
        title: 'Erro',
        description: 'Algo deu errado ao atualizar a transação',
        variant: 'destructive',
      });
    }
  };

  // Método para aprovar diretamente uma transação
  const handleDirectApprove = async () => {
    if (!selectedTransaction) return;
    
    try {
      const success = await updateTransactionStatus(selectedTransaction.id, 'completed');
      
      if (success) {
        toast({
          title: 'Transação aprovada',
          description: 'Transação aprovada com sucesso e saldo atualizado',
          variant: 'default',
        });
        setShowDialog(false);
        await refetchTransactions();
      } else {
        toast({
          title: 'Erro',
          description: 'Falha ao aprovar transação',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Erro ao aprovar transação:', error);
      toast({
        title: 'Erro',
        description: 'Algo deu errado ao aprovar a transação',
        variant: 'destructive',
      });
    }
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
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen pb-8">
      <AdminNavigation />

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <h1 className="text-2xl font-bold mb-6 text-white">Gerenciar Transações</h1>

        {isLoading ? (
          <CyberneticBox className="py-12 text-center">
            <Loader2 className="mx-auto h-10 w-10 text-gray-400 animate-spin mb-4" />
            <p className="text-gray-400">Carregando transações...</p>
          </CyberneticBox>
        ) : transactions && transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-dark-tertiary text-left">
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Usuário</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Ações</th>
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
                  onClick={handleDirectApprove}
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
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="default"
              onClick={handleUpdateStatus}
            >
              Atualizar Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
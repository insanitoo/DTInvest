import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { formatCurrency, formatDate } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export default function AdminTransactions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [newStatus, setNewStatus] = useState<string>('');

  // Usar query com refetch automático
  const { data: transactions, isLoading, refetch } = useQuery<Transaction[]>({
    queryKey: ['/api/admin/transactions'],
    refetchInterval: 5000, // Recarregar a cada 5 segundos
    staleTime: 0 // Considerar dados sempre desatualizados
  });

  // Carregar transações ao montar componente
  useEffect(() => {
    refetch();
  }, [refetch]);

  const updateStatusMutation = useMutation({
    mutationFn: async (data: { id: number; status: string }) => {
      const response = await fetch(`/api/admin/transactions/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: data.status })
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar status');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/transactions'] });
      toast({
        title: "Status atualizado",
        description: "A transação foi atualizada com sucesso."
      });
      setShowDialog(false);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a transação.",
        variant: "destructive"
      });
    }
  });

  const handleUpdateStatus = () => {
    if (selectedTransaction && newStatus) {
      updateStatusMutation.mutate({
        id: selectedTransaction.id,
        status: newStatus
      });
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
          <div className="grid gap-4">
            {transactions.map((transaction) => (
              <CyberneticBox
                key={transaction.id}
                className="p-4 cursor-pointer hover:bg-dark-tertiary transition-colors"
                onClick={() => {
                  setSelectedTransaction(transaction);
                  setNewStatus(transaction.status || 'pending');
                  setShowDialog(true);
                }}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold">
                      {transaction.type === 'deposit' ? 'Depósito' : 
                       transaction.type === 'withdrawal' ? 'Saque' : 'Compra'}
                    </p>
                    <p className="text-sm text-gray-400">
                      {formatDate(new Date(transaction.createdAt))}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${
                      transaction.type === 'deposit' ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {transaction.type === 'deposit' ? '+' : '-'}
                      {formatCurrency(transaction.amount)}
                    </p>
                    <p className={`text-sm ${
                      transaction.status === 'completed' ? 'text-green-500' :
                      transaction.status === 'failed' ? 'text-red-500' :
                      'text-yellow-500'
                    }`}>
                      {transaction.status === 'completed' ? 'Concluído' :
                       transaction.status === 'failed' ? 'Falhou' :
                       transaction.status === 'processing' ? 'Processando' :
                       'Pendente'}
                    </p>
                  </div>
                </div>
              </CyberneticBox>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-400 py-12">
            Nenhuma transação encontrada.
          </p>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atualizar Status da Transação</DialogTitle>
            <DialogDescription>
              Escolha o novo status para esta transação.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Select
              value={newStatus}
              onValueChange={setNewStatus}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="processing">Processando</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
                <SelectItem value="failed">Falhou</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpdateStatus}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Atualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
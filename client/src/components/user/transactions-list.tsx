import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Transaction } from '@shared/schema';
import { CyberneticBox } from '@/components/ui/cybernetic-box';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useTransactions } from '@/hooks/use-transactions';
import { TransactionFilters, TransactionFilterType, TransactionFilterStatus } from './transaction-filters';

interface TransactionsListProps {
  limit?: number;
  showFilters?: boolean;
  title?: string;
}

export function TransactionsList({ limit, showFilters = true, title = "Histórico de Transações" }: TransactionsListProps) {
  const { transactions, isLoading, loadTransactions } = useTransactions();
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [filters, setFilters] = useState<{
    type: TransactionFilterType;
    status: TransactionFilterStatus;
  }>({
    type: 'all',
    status: 'all'
  });

  // Carregar transações na montagem
  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Aplicar filtros quando as transações mudarem ou os filtros
  useEffect(() => {
    if (!transactions) {
      setFilteredTransactions([]);
      return;
    }

    let filtered = [...transactions];

    // Aplicar filtro por tipo
    if (filters.type !== 'all') {
      filtered = filtered.filter(t => t.type === filters.type);
    }

    // Aplicar filtro por status
    if (filters.status !== 'all') {
      filtered = filtered.filter(t => t.status === filters.status);
    }

    // Aplicar limite, se especificado
    if (limit && filtered.length > limit) {
      filtered = filtered.slice(0, limit);
    }

    setFilteredTransactions(filtered);
  }, [transactions, filters, limit]);

  // Manipular mudanças nos filtros
  const handleFilterChange = (type: TransactionFilterType, status: TransactionFilterStatus) => {
    setFilters({ type, status });
  };

  // Função para obter o ícone com base no status
  const getTransactionStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return 'check';
      case 'pending': return 'clock';
      case 'processing': return 'spinner';
      case 'failed': return 'times';
      default: return 'question';
    }
  };

  // Função para obter a cor com base no status e tipo
  const getTransactionStatusColor = (status: string, type: string) => {
    if (status === 'failed') return 'text-red-500';
    if (status === 'pending') return 'text-yellow-500';
    if (status === 'processing') return 'text-blue-500';
    
    // Concluído
    if (type === 'deposit' || type === 'commission') return 'text-green-500';
    if (type === 'withdrawal' || type === 'purchase') return 'text-red-500';
    
    return 'text-white';
  };

  // Função para gerar o rótulo do tipo
  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'deposit': return 'Depósito';
      case 'withdrawal': return 'Saque';
      case 'purchase': return 'Compra';
      case 'commission': return 'Comissão';
      default: return type;
    }
  };

  // Formatar valor da transação com o sinal correto
  const formatTransactionAmount = (transaction: Transaction) => {
    const sign = transaction.type === 'deposit' || transaction.type === 'commission' ? '+' : '-';
    return `${sign} ${formatCurrency(transaction.amount)}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold">{title}</h3>
        {showFilters && (
          <TransactionFilters 
            onFilterChange={handleFilterChange}
            activeFilters={filters}
          />
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : filteredTransactions && filteredTransactions.length > 0 ? (
        <div className="space-y-3">
          {filteredTransactions.map((transaction) => (
            <CyberneticBox key={transaction.id} className="p-4">
              <div className="flex justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className={`w-8 h-8 rounded-full ${
                      transaction.status === 'completed' ? 'bg-green-500' :
                      transaction.status === 'pending' ? 'bg-yellow-500' :
                      transaction.status === 'processing' ? 'bg-blue-500' :
                      'bg-red-500'
                    } flex items-center justify-center`}>
                    <i className={`fas fa-${getTransactionStatusIcon(transaction.status)} text-white text-xs`}></i>
                  </div>
                  <span className={`text-sm font-medium ${getTransactionStatusColor(transaction.status, transaction.type)}`}>
                    {getTransactionTypeLabel(transaction.type)}
                  </span>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${
                    transaction.type === 'deposit' || transaction.type === 'commission' ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {formatTransactionAmount(transaction)}
                  </p>
                  <p className="text-xs text-gray-400">{formatDate(transaction.createdAt)}</p>
                </div>
              </div>
              <div>
                <div className="w-full mt-1">
                  <p className="text-sm text-gray-400">
                    {transaction.status === 'completed' ? 'Concluído' :
                     transaction.status === 'pending' ? 'Pendente' :
                     transaction.status === 'processing' ? 'Em processamento' :
                     'Falhou'}
                    {transaction.transactionId && ` · ID: ${transaction.transactionId}`}
                    {transaction.bankName && ` · ${transaction.bankName}`}
                  </p>
                </div>
              </div>
            </CyberneticBox>
          ))}
        </div>
      ) : (
        <CyberneticBox className="py-6">
          <p className="text-center text-gray-400">
            {filters.type !== 'all' || filters.status !== 'all' 
              ? 'Nenhuma transação encontrada com os filtros selecionados.' 
              : 'Você ainda não possui transações.'}
          </p>
        </CyberneticBox>
      )}
    </div>
  );
}
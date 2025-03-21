import { useState } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { BottomNavigation } from '@/components/layout/bottom-navigation';
import { BalanceCard } from '@/components/home/balance-card';
import { CyberneticBox } from '@/components/ui/cybernetic-box';
import { WithdrawalModal } from '@/components/modals/withdrawal-modal';
import { DepositModal } from '@/components/modals/deposit-modal';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ArrowDown, ArrowUp, ChevronRight, Loader2 } from 'lucide-react';
import { Transaction } from '@shared/schema';

export default function HomePage() {
  const { user } = useAuth();
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);

  // Fetch recent transactions
  const { data: transactions, isLoading: isLoadingTransactions } = useQuery<Transaction[]>({
    queryKey: ['/api/transactions'],
  });

  const recentTransactions = transactions ? transactions.slice(0, 3) : [];

  return (
    <>
      <div className="pb-20">
        {/* Header */}
        <header className="p-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">S&P Global</h1>
          <div className="rounded-full bg-white w-10 h-10 flex items-center justify-center">
            <span className="text-dark-secondary text-sm font-bold">S&P</span>
          </div>
        </header>

        {/* Welcome Message */}
        <div className="px-4 mb-6">
          <CyberneticBox>
            <h2 className="text-lg font-medium mb-2">
              Bem-vindo, {user?.phoneNumber ? user.phoneNumber : 'Usuário'}
            </h2>
            <p className="text-gray-400 text-sm">
              Acesse sua conta e realize operações com facilidade.
            </p>
          </CyberneticBox>
        </div>

        {/* Balance Card */}
        <BalanceCard />

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4 mx-4 mb-8">
          <Button 
            variant="primary" 
            className="rounded-lg py-6 flex items-center justify-center space-x-2 cyber-element"
            onClick={() => setShowDepositModal(true)}
          >
            <ArrowDown className="h-5 w-5 mr-2" />
            <span>Recarregar</span>
          </Button>
          <Button 
            variant="secondary" 
            className="rounded-lg py-6 flex items-center justify-center space-x-2 cyber-element"
            onClick={() => setShowWithdrawalModal(true)}
          >
            <ArrowUp className="h-5 w-5 mr-2" />
            <span>Retirar</span>
          </Button>
        </div>

        {/* Recent Transactions */}
        <div className="px-4 mb-6">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-medium">Transações Recentes</h2>
            <Link href="/user?tab=transactions">
              <a className="text-sm text-primary flex items-center">
                Ver todas
                <ChevronRight className="h-4 w-4 ml-1" />
              </a>
            </Link>
          </div>

          {isLoadingTransactions ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : recentTransactions && recentTransactions.length > 0 ? (
            <div className="space-y-3">
              {recentTransactions.map((transaction) => (
                <CyberneticBox key={transaction.id}>
                  <div className="flex justify-between mb-1">
                    <p className="text-sm font-medium">
                      {transaction.type === 'deposit' ? 'Depósito' :
                       transaction.type === 'withdrawal' ? 'Saque' :
                       transaction.type === 'commission' ? 'Comissão' :
                       'Compra'}
                    </p>
                    <span className="text-sm text-gray-400">
                      {formatDate(transaction.createdAt)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-400">
                      {transaction.status === 'completed' ? 'Concluído' :
                       transaction.status === 'pending' ? 'Pendente' :
                       transaction.status === 'processing' ? 'Processando' :
                       'Falhou'}
                    </p>
                    <p className={`font-semibold ${
                      transaction.type === 'withdrawal' ? 'text-red-400' : 
                      transaction.type === 'deposit' || transaction.type === 'commission' ? 'text-green-400' : 
                      'text-yellow-400'
                    }`}>
                      {transaction.type === 'withdrawal' ? '-' : 
                       transaction.type === 'deposit' || transaction.type === 'commission' ? '+' : 
                       ''}
                      {formatCurrency(transaction.amount)}
                    </p>
                  </div>
                </CyberneticBox>
              ))}
            </div>
          ) : (
            <CyberneticBox className="py-6">
              <p className="text-center text-gray-400">
                Você ainda não possui transações.
              </p>
            </CyberneticBox>
          )}
        </div>

        {/* Products Preview */}
        <div className="px-4 mb-6">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-medium">Nossos Produtos</h2>
            <Link href="/products">
              <a className="text-sm text-primary flex items-center">
                Ver todos
                <ChevronRight className="h-4 w-4 ml-1" />
              </a>
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <CyberneticBox>
              <div className="flex flex-col items-center text-center">
                <div className="bg-dark-tertiary w-12 h-12 rounded-full flex items-center justify-center mb-2">
                  <span className="text-primary text-xl font-bold">S1</span>
                </div>
                <h3 className="font-medium">Starter Pack</h3>
                <p className="text-sm text-gray-400">KZ 5,000.00</p>
              </div>
            </CyberneticBox>
            <CyberneticBox>
              <div className="flex flex-col items-center text-center">
                <div className="bg-dark-tertiary w-12 h-12 rounded-full flex items-center justify-center mb-2">
                  <span className="text-primary text-xl font-bold">P1</span>
                </div>
                <h3 className="font-medium">Premium Pack</h3>
                <p className="text-sm text-gray-400">KZ 15,000.00</p>
              </div>
            </CyberneticBox>
          </div>
        </div>
      </div>

      {/* Modals */}
      <WithdrawalModal 
        isOpen={showWithdrawalModal} 
        onClose={() => setShowWithdrawalModal(false)} 
      />
      <DepositModal 
        isOpen={showDepositModal} 
        onClose={() => setShowDepositModal(false)} 
      />

      {/* Bottom Navigation */}
      <BottomNavigation />
    </>
  );
}

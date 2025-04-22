import React from "react";
import { useAuth } from "@/hooks/use-auth-new";
import { formatCurrency } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Transaction, User } from "@shared/schema";

export function BalanceCard({ 
  onDepositClick, 
  onWithdrawClick 
}: { 
  onDepositClick: () => void, 
  onWithdrawClick: () => void 
}) {
  // Buscar dados do usuário diretamente para sempre ter o saldo atualizado
  const { data: currentUser, isLoading: isUserLoading } = useQuery<User>({
    queryKey: ['/api/user'],
  });
  
  // Buscar transações para calcular o rendimento diário
  const { data: transactions, isLoading: isTransactionsLoading } = useQuery<Transaction[]>({
    queryKey: ['/api/transactions'],
  });
  
  // Calcular rendimento diário
  const dailyReturn = React.useMemo(() => {
    if (!transactions) return 0;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return transactions
      .filter(tx => {
        const txDate = new Date(tx.createdAt);
        txDate.setHours(0, 0, 0, 0);
        return txDate.getTime() === today.getTime() && 
               (tx.type === 'income' || tx.type === 'commission');
      })
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [transactions]);

  return (
    <div className="px-4 mb-2">
      <div className="border-l-2 border-r-2 border-t-2 border-primary border-opacity-30 rounded-lg p-3 pb-4 relative">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-sm text-gray-400 mb-1">Saldo da conta</h2>
            {isUserLoading ? (
              <div className="flex items-center h-10">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <h3 className="text-3xl font-bold">
                {currentUser ? formatCurrency(currentUser.balance) : 'KZ 0.00'}
              </h3>
            )}
          </div>
          
          <div className="text-right">
            <h2 className="text-sm text-gray-400 mb-1">Rendimento diário</h2>
            {isTransactionsLoading ? (
              <div className="flex items-center justify-end h-10">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <h3 className="text-3xl font-bold text-primary">
                {formatCurrency(dailyReturn)}
              </h3>
            )}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 w-2 h-2 border-l-2 border-b-2 border-primary border-opacity-30 -mb-2 -ml-2"></div>
        <div className="absolute bottom-0 right-0 w-2 h-2 border-r-2 border-b-2 border-primary border-opacity-30 -mb-2 -mr-2"></div>
      </div>
      
      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-4 px-4 mb-4 mt-6">
        <Button 
          variant="default" 
          className="rounded-lg py-6 flex items-center justify-center space-x-2 cyber-element bg-primary text-white"
          onClick={onDepositClick}
        >
          <span>Recarregar</span>
        </Button>
        <Button 
          variant="secondary" 
          className="rounded-lg py-6 flex items-center justify-center space-x-2 cyber-element"
          onClick={onWithdrawClick}
        >
          <span>Retirar</span>
        </Button>
      </div>
    </div>
  );
}

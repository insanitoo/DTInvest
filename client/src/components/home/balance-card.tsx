import { useAuth } from '@/hooks/use-auth';
import { GradientCard } from '../ui/gradient-card';
import { formatCurrency } from '@/lib/utils';

export function BalanceCard() {
  const { user } = useAuth();
  
  if (!user) {
    return null;
  }
  
  return (
    <GradientCard className="mx-4 mb-6 cyber-element">
      <div className="flex justify-between">
        <div>
          <p className="text-sm opacity-80">Saldo da conta</p>
          <h3 className="text-2xl font-bold">{formatCurrency(user.balance)}</h3>
        </div>
        <div className="text-right">
          <p className="text-sm opacity-80">Rendimento diário</p>
          <h3 className="text-2xl font-bold">{formatCurrency(user.dailyIncome)}</h3>
        </div>
      </div>
    </GradientCard>
  );
}

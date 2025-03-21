import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { formatCurrency, calculateNetWithdrawal, isWithinAngolaBusinessHours, isWeekday } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface WithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WithdrawalModal({ isOpen, onClose }: WithdrawalModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [amount, setAmount] = useState<number | ''>('');
  
  const netAmount = typeof amount === 'number' ? calculateNetWithdrawal(amount) : 0;
  
  const canWithdraw = 
    user?.hasProduct && 
    user?.hasDeposited &&
    isWithinAngolaBusinessHours() &&
    isWeekday();
  
  const withdrawalMutation = useMutation({
    mutationFn: async () => {
      if (!amount || amount < 2000) {
        throw new Error('Valor mínimo para saque é KZ 2000');
      }
      
      const res = await apiRequest('POST', '/api/withdrawals', { amount });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      
      toast({
        title: 'Solicitação enviada',
        description: 'Sua solicitação de saque foi enviada com sucesso!',
      });
      
      setAmount('');
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro na solicitação',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-dark-secondary border-gray-800 text-white max-w-md">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <DialogTitle className="text-xl font-bold">Retirar</DialogTitle>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-gray-400"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="mb-6">
          <div className="bg-dark-tertiary rounded-lg p-3 mb-3">
            <p className="text-sm text-gray-400">Saldo disponível</p>
            <p className="text-xl font-semibold">{user ? formatCurrency(user.balance) : 'KZ 0.00'}</p>
          </div>
          
          <div className="border-l-4 border-yellow-500 bg-dark-tertiary bg-opacity-50 p-3 rounded-r-lg">
            <h4 className="text-yellow-500 font-medium mb-1">Regras de saque</h4>
            <ul className="text-sm text-gray-300 list-disc pl-4 space-y-1">
              <li>Valor mínimo: KZ 2000</li>
              <li>Disponível apenas das 10h às 15h</li>
              <li>Apenas de segunda à sexta</li>
              <li>Taxa de 20% será aplicada</li>
              <li>Necessário ter comprado um produto</li>
            </ul>
          </div>
        </div>
        
        {!canWithdraw && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Saque indisponível</AlertTitle>
            <AlertDescription>
              {!user?.hasProduct ? "É necessário comprar um produto antes de fazer saques." : 
               !user?.hasDeposited ? "É necessário fazer um depósito antes de fazer saques." :
               !isWithinAngolaBusinessHours() ? "Saques disponíveis apenas das 10h às 15h (horário de Angola)." : 
               !isWeekday() ? "Saques disponíveis apenas de segunda a sexta." : 
               "Não é possível realizar saques no momento."}
            </AlertDescription>
          </Alert>
        )}
        
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-1">Valor a retirar</label>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
            className="bg-dark-tertiary text-white border-gray-700"
            placeholder="KZ 0.00"
            min={2000}
            step={100}
            disabled={!canWithdraw || withdrawalMutation.isPending}
          />
          <p className="text-sm text-gray-400 mt-1">
            Após taxa de 20%: <span>{formatCurrency(netAmount)}</span>
          </p>
        </div>
        
        <Button
          variant="primary"
          className="w-full"
          onClick={() => withdrawalMutation.mutate()}
          disabled={
            !canWithdraw || 
            withdrawalMutation.isPending || 
            !amount || 
            amount < 2000 || 
            (user && amount > user.balance)
          }
        >
          {withdrawalMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Processando...
            </>
          ) : (
            "Solicitar retirada"
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

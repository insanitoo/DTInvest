import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CopyIcon, Check, Loader2 } from 'lucide-react';
import { formatCurrency, copyToClipboard } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth-new';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DepositModal({ isOpen, onClose }: DepositModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [amount, setAmount] = useState<number | ''>('');
  const [copied, setCopied] = useState(false);
  
  const bankAccounts = [
    {
      bank: "BAI",
      number: "9876543210",
      owner: "S&P Global Payments"
    },
    {
      bank: "BFA",
      number: "1234567890",
      owner: "S&P Global Payments"
    }
  ];

  const depositMutation = useMutation({
    mutationFn: async () => {
      if (!amount || amount < 1000) {
        throw new Error('Valor mínimo para depósito é KZ 1000');
      }
      
      const res = await apiRequest('POST', '/api/deposits', { amount });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      
      toast({
        title: 'Depósito registrado',
        description: 'Seu depósito foi registrado e será processado em breve.',
      });
      
      setAmount('');
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao registrar depósito',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleCopy = async (text: string) => {
    await copyToClipboard(text);
    setCopied(true);
    
    toast({
      title: 'Copiado',
      description: 'Informação copiada para a área de transferência.',
    });
    
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-dark-secondary border-gray-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Depositar</DialogTitle>
          <DialogDescription className="text-gray-400">
            Transfira o valor para uma das contas abaixo e registre seu depósito.
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-dark-tertiary rounded-lg p-4 mb-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Contas Bancárias</h3>
          <div className="space-y-3">
            {bankAccounts.map((account) => (
              <div key={account.bank} className="bg-dark-secondary p-3 rounded-md">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">{account.bank}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-gray-400"
                    onClick={() => handleCopy(account.number)}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <CopyIcon className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-sm text-gray-400">Número: <span className="text-gray-300">{account.number}</span></p>
                <p className="text-sm text-gray-400">Titular: <span className="text-gray-300">{account.owner}</span></p>
              </div>
            ))}
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-1">Valor a depositar</label>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
            className="bg-dark-tertiary text-white border-gray-700"
            placeholder="KZ 0.00"
            min={1000}
            step={100}
            disabled={depositMutation.isPending}
          />
          <p className="text-xs text-gray-400 mt-1">Valor mínimo: KZ 1000</p>
        </div>
        
        <Button
          variant="primary"
          className="w-full"
          onClick={() => depositMutation.mutate()}
          disabled={
            depositMutation.isPending || 
            !amount || 
            amount < 1000
          }
        >
          {depositMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Processando...
            </>
          ) : (
            "Registrar Depósito"
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

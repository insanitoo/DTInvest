import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Upload, Loader2 } from 'lucide-react';
import { Bank } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DepositModal({ isOpen, onClose }: DepositModalProps) {
  const { toast } = useToast();
  const [amount, setAmount] = useState<number | ''>('');
  const [selectedBankId, setSelectedBankId] = useState<number | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  
  const { data: banks, isLoading: isBanksLoading } = useQuery<Bank[]>({
    queryKey: ['/api/banks'],
    enabled: isOpen,
  });
  
  // Select first bank by default when banks are loaded
  useEffect(() => {
    if (banks && banks.length > 0 && !selectedBankId) {
      setSelectedBankId(banks[0].id);
    }
  }, [banks, selectedBankId]);
  
  const depositMutation = useMutation({
    mutationFn: async () => {
      if (!amount || amount <= 0) {
        throw new Error('Valor deve ser maior que zero');
      }
      
      if (!selectedBankId) {
        throw new Error('Selecione um banco');
      }
      
      const res = await apiRequest('POST', '/api/deposits', { 
        amount, 
        bankId: selectedBankId,
        receipt
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      
      toast({
        title: 'Solicitação enviada',
        description: 'Sua solicitação de depósito foi enviada com sucesso!',
      });
      
      setAmount('');
      setSelectedBankId(null);
      setReceipt(null);
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
  
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // In a real app, we would upload the file to a server and get a URL
      // For this example, we'll just store the file name
      setReceipt(file.name);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-dark-secondary border-gray-800 text-white max-w-md">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <DialogTitle className="text-xl font-bold">Recarregar</DialogTitle>
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
        
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-1">Valor a depositar</label>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
            className="bg-dark-tertiary text-white border-gray-700"
            placeholder="KZ 0.00"
            min={1}
            step={100}
            disabled={depositMutation.isPending}
          />
        </div>
        
        <div className="mb-4">
          <h4 className="block text-sm text-gray-400 mb-2">Selecione o banco</h4>
          
          {isBanksLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : banks && banks.length > 0 ? (
            <div className="space-y-2">
              {banks.map((bank) => (
                <div
                  key={bank.id}
                  className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                    selectedBankId === bank.id
                      ? 'border-brand-purple'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                  onClick={() => setSelectedBankId(bank.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{bank.name}</p>
                      <p className="text-sm text-gray-400">Proprietário: {bank.ownerName}</p>
                      <p className="text-sm text-gray-400">IBAN: {bank.accountNumber}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border ${
                      selectedBankId === bank.id
                        ? 'border-brand-purple flex items-center justify-center'
                        : 'border-gray-500'
                    }`}>
                      {selectedBankId === bank.id && (
                        <div className="w-3 h-3 rounded-full bg-brand-purple"></div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-4">
              Não há bancos disponíveis
            </div>
          )}
        </div>
        
        <div className="text-center mb-4">
          <p className="text-sm text-gray-400">
            Após fazer a transferência, envie o comprovante abaixo
          </p>
        </div>
        
        <div className="mb-4">
          <label className="cursor-pointer">
            <div className="border-2 border-dashed border-gray-700 rounded-lg p-6 flex flex-col items-center">
              <Upload className="h-8 w-8 text-gray-500 mb-2" />
              <p className="text-sm text-center text-gray-400">
                Clique para fazer upload do comprovante ou arraste e solte o arquivo aqui
              </p>
              <p className="text-xs text-center text-gray-500 mt-1">
                Formatos: JPG, PNG ou PDF (max 5MB)
              </p>
              
              {receipt && (
                <div className="mt-2 text-sm text-brand-purple">
                  Arquivo selecionado: {receipt}
                </div>
              )}
            </div>
            <Input
              type="file"
              className="hidden"
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={handleFileUpload}
              disabled={depositMutation.isPending}
            />
          </label>
        </div>
        
        <Button
          variant="primary"
          className="w-full"
          onClick={() => depositMutation.mutate()}
          disabled={
            depositMutation.isPending || 
            !amount || 
            amount <= 0 || 
            !selectedBankId
          }
        >
          {depositMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Processando...
            </>
          ) : (
            "Enviar comprovante"
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

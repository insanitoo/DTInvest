import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CopyIcon, Check, Loader2, Upload, FileCheck } from 'lucide-react';
import { formatCurrency, copyToClipboard } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth-new';
import { useTransactions } from '@/hooks/use-transactions';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DepositModal({ isOpen, onClose }: DepositModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { createDeposit } = useTransactions();
  
  // Estados do formulário
  const [amount, setAmount] = useState<number | ''>('');
  const [bankName, setBankName] = useState<string>('');
  const [receipt, setReceipt] = useState<string>(''); // Base64 do comprovante
  const [copied, setCopied] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [loadingDeposit, setLoadingDeposit] = useState(false);
  const [depositId, setDepositId] = useState<string | null>(null);
  
  // Lista de bancos disponíveis para transferência
  const bankAccounts = [
    {
      id: "BAI",
      bank: "BAI",
      number: "9876543210",
      owner: "S&P Global Payments"
    },
    {
      id: "BFA",
      bank: "BFA",
      number: "1234567890",
      owner: "S&P Global Payments"
    }
  ];

  // Manipulador de upload de comprovante
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    
    // Converter arquivo para Base64
    const reader = new FileReader();
    reader.onloadend = () => {
      setReceipt(reader.result as string);
      setIsUploading(false);
    };
    reader.onerror = () => {
      toast({
        title: 'Erro ao carregar arquivo',
        description: 'Não foi possível processar o comprovante.',
        variant: 'destructive'
      });
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  // Criação do depósito
  const handleDeposit = async () => {
    if (!amount || amount < 1000) {
      toast({
        title: 'Valor inválido',
        description: 'O valor mínimo para depósito é KZ 1.000',
        variant: 'destructive'
      });
      return;
    }
    
    if (!bankName) {
      toast({
        title: 'Banco não selecionado',
        description: 'Selecione o banco para o qual você fez a transferência',
        variant: 'destructive'
      });
      return;
    }
    
    if (!receipt) {
      toast({
        title: 'Comprovante ausente',
        description: 'É necessário enviar um comprovante da transferência',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      setLoadingDeposit(true);
      
      const result = await createDeposit({
        amount: Number(amount),
        bankName,
        receipt
      });
      
      if (result.success && result.transactionId) {
        setDepositId(result.transactionId);
        
        // Limpar formulário
        setAmount('');
        setBankName('');
        setReceipt('');
      } else {
        toast({
          title: 'Erro no depósito',
          description: 'Não foi possível processar seu depósito. Tente novamente.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Erro no depósito',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      });
    } finally {
      setLoadingDeposit(false);
    }
  };

  // Reset do modal ao fechar
  const handleClose = () => {
    setAmount('');
    setBankName('');
    setReceipt('');
    setDepositId(null);
    onClose();
  };

  // Função para copiar texto
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
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-dark-secondary border-gray-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Depositar</DialogTitle>
          <DialogDescription className="text-gray-400">
            Transfira o valor para uma das contas abaixo e registre seu depósito.
          </DialogDescription>
        </DialogHeader>
        
        {/* Tela de sucesso após o depósito ser registrado */}
        {depositId ? (
          <div className="flex flex-col items-center text-center p-4">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
              <Check className="h-8 w-8 text-green-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Depósito Registrado!</h3>
            <p className="text-gray-400 mb-4">
              Seu depósito foi registrado com sucesso e será processado em breve.
            </p>
            <div className="bg-dark-tertiary w-full p-3 rounded-md mb-4">
              <p className="text-sm text-gray-400 mb-1">ID da Transação:</p>
              <div className="flex items-center justify-between">
                <code className="text-green-400 font-mono bg-dark-primary px-2 py-1 rounded text-sm">
                  {depositId}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-gray-400"
                  onClick={() => handleCopy(depositId)}
                >
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <CopyIcon className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button
              variant="default"
              className="w-full bg-primary hover:bg-primary/90"
              onClick={handleClose}
            >
              Fechar
            </Button>
          </div>
        ) : (
          <>
            {/* Contas Bancárias */}
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
            
            {/* Formulário de Depósito */}
            <div className="space-y-4">
              {/* Valor */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Valor a depositar</label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="bg-dark-tertiary text-white border-gray-700"
                  placeholder="KZ 0.00"
                  min={1000}
                  step={100}
                  disabled={loadingDeposit}
                />
                <p className="text-xs text-gray-400 mt-1">Valor mínimo: KZ 1000</p>
              </div>
              
              {/* Banco */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Banco utilizado</label>
                <Select disabled={loadingDeposit} value={bankName} onValueChange={setBankName}>
                  <SelectTrigger className="bg-dark-tertiary text-white border-gray-700">
                    <SelectValue placeholder="Selecione o banco" />
                  </SelectTrigger>
                  <SelectContent className="bg-dark-tertiary text-white border-gray-700">
                    {bankAccounts.map(account => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.bank}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Upload do comprovante */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Comprovante de transferência</label>
                
                {receipt ? (
                  <div className="bg-dark-tertiary p-3 rounded-md border border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <FileCheck className="h-4 w-4 text-green-500 mr-2" />
                        <span className="text-sm text-gray-300">Comprovante enviado</span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 px-2 py-1 text-xs"
                        onClick={() => setReceipt('')}
                      >
                        Trocar
                      </Button>
                    </div>
                    <div className="h-24 bg-dark-secondary rounded-md flex items-center justify-center overflow-hidden">
                      <img 
                        src={receipt} 
                        alt="Comprovante" 
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <label 
                      htmlFor="receipt-upload" 
                      className="w-full h-16 border border-dashed border-gray-700 rounded-md flex flex-col items-center justify-center cursor-pointer hover:bg-dark-tertiary transition-colors duration-200"
                    >
                      {isUploading ? (
                        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                      ) : (
                        <>
                          <Upload className="h-5 w-5 text-gray-400 mb-1" />
                          <span className="text-xs text-gray-400">Clique para enviar o comprovante</span>
                        </>
                      )}
                    </label>
                    <input 
                      id="receipt-upload" 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileUpload}
                      className="sr-only"
                      disabled={isUploading || loadingDeposit}
                    />
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  Apenas imagens, tamanho máximo 5MB
                </p>
              </div>
              
              {/* Botão de submissão */}
              <Button
                variant="default"
                className="w-full bg-primary hover:bg-primary/90 mt-2"
                onClick={handleDeposit}
                disabled={
                  loadingDeposit || 
                  isUploading || 
                  !amount || 
                  amount < 1000 ||
                  !bankName ||
                  !receipt
                }
              >
                {loadingDeposit ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processando...
                  </>
                ) : (
                  "Registrar Depósito"
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
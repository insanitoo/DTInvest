import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CopyIcon, Check, Loader2, MessageCircle } from 'lucide-react';
import { formatCurrency, copyToClipboard } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth-new';
import { useTransactions } from '@/hooks/use-transactions';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { BankAccountDetail } from '@shared/schema';

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
  const [copied, setCopied] = useState(false);
  const [loadingDeposit, setLoadingDeposit] = useState(false);
  const [depositId, setDepositId] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  
  // Carregar contas bancárias do banco de dados
  const { data: bankAccountDetails, isLoading: isLoadingBankAccounts } = useQuery<BankAccountDetail[]>({
    queryKey: ['/api/bank-accounts'],
  });

  // Criação do depósito
  const handleDeposit = async () => {
    if (!amount || amount < 25000) {
      toast({
        title: 'Valor inválido',
        description: 'O valor mínimo para depósito é KZ 25.000',
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
    
    try {
      setLoadingDeposit(true);
      
      const result = await createDeposit({
        amount: Number(amount),
        bankId: bankName, // Usar o nome do banco como ID temporariamente
        receipt: null // Comprovante não é mais carregado no sistema
      });
      
      if (result.success && result.transactionId) {
        setDepositId(result.transactionId);
        
        // Limpar formulário
        setAmount('');
        setBankName('');
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
      <DialogContent className="bg-dark-secondary border-gray-800 text-white max-w-md overflow-auto max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Depositar</DialogTitle>
          <DialogDescription className="text-gray-400">
            Transfira o valor para uma das contas abaixo e registre seu depósito.
          </DialogDescription>
        </DialogHeader>

        {/* Tela de sucesso após o depósito ser registrado */}
        {depositId ? (
          <div className="py-4">
            <div className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
              <Check className="h-8 w-8 text-green-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-center">Depósito Registrado!</h3>
            <p className="text-gray-400 mb-4 text-center">
              Seu depósito foi registrado com sucesso e está aguardando confirmação.
            </p>
            <div className="bg-dark-tertiary p-3 rounded-md w-full mb-4">
              <p className="text-sm text-gray-400 mb-1">ID da Transação:</p>
              <div className="flex items-center justify-between">
                <code className="text-green-400 font-mono bg-dark-primary px-2 py-1 rounded text-sm truncate max-w-[80%]">
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
            
            <div className="bg-blue-900/30 border border-blue-800 rounded-md p-3 w-full mb-4">
              <div className="flex items-start">
                <MessageCircle className="h-5 w-5 text-blue-400 mr-2 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-200">
                  <span className="font-medium">Próximo passo:</span> Entre em contato com o gerente para enviar o comprovante de transferência e o ID da transação.
                </p>
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
          <div className="py-2">
            {/* Contas Bancárias */}
            <div className="bg-dark-tertiary rounded-lg p-3 mb-3">
              <h3 className="text-sm font-medium text-gray-300 mb-2">Contas Bancárias</h3>
              <div className="space-y-2">
                {isLoadingBankAccounts ? (
                  <div className="text-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-400">Carregando contas bancárias...</p>
                  </div>
                ) : bankAccountDetails && bankAccountDetails.length > 0 ? (
                  bankAccountDetails.map((account) => (
                    <div key={account.id} className="bg-dark-secondary p-2 rounded-md">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">
                          {account.bank?.name || 'Banco'}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-gray-400"
                          onClick={() => {
                            handleCopy(account.iban);
                            setCopiedText(account.iban);
                          }}
                        >
                          {copied && copiedText === account.iban ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <CopyIcon className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-gray-400">IBAN: <span className="text-gray-300">{account.iban}</span></p>
                      <p className="text-xs text-gray-400">Titular: <span className="text-gray-300">{account.accountHolder}</span></p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-2">
                    <p className="text-sm text-gray-400">Nenhuma conta bancária disponível no momento.</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Formulário de Depósito */}
            <div className="space-y-3">
              {/* Valor */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Valor a depositar</label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="bg-dark-tertiary text-white border-gray-700"
                  placeholder="KZ 0.00"
                  min={25000}
                  step={1000}
                  disabled={loadingDeposit}
                />
                <p className="text-xs text-gray-400 mt-1">Valor mínimo: KZ 25.000</p>
              </div>
              
              {/* Banco */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Banco utilizado</label>
                <Select disabled={loadingDeposit || isLoadingBankAccounts} value={bankName} onValueChange={setBankName}>
                  <SelectTrigger className="bg-dark-tertiary text-white border-gray-700">
                    <SelectValue placeholder="Selecione o banco" />
                  </SelectTrigger>
                  <SelectContent className="bg-dark-tertiary text-white border-gray-700">
                    {bankAccountDetails?.map(account => (
                      <SelectItem key={account.id.toString()} value={account.bank?.name || ''}>
                        {account.bank?.name || 'Banco'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="bg-amber-900/30 border border-amber-800 rounded-md p-3 mt-1">
                <div className="flex items-start">
                  <MessageCircle className="h-4 w-4 text-amber-400 mr-2 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-200">
                    Após registrar, você receberá um ID de transação. Envie o comprovante junto com o ID para o gerente.
                  </p>
                </div>
              </div>
              
              <Button
                variant="default"
                className="w-full bg-primary hover:bg-primary/90 mt-2"
                onClick={handleDeposit}
                disabled={
                  loadingDeposit || 
                  !amount || 
                  amount < 25000 ||
                  !bankName
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
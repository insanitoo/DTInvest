import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { X, AlertTriangle, Loader2, Check, CreditCard, Clock } from 'lucide-react';
import { formatCurrency, calculateNetWithdrawal, isWithinAngolaBusinessHours, isWeekday } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth-new';
import { useTransactions } from '@/hooks/use-transactions';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface WithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Constantes para o modal de saque
const MIN_WITHDRAWAL = 1400;
const MAX_WITHDRAWAL = 50000;

export function WithdrawalModal({ isOpen, onClose }: WithdrawalModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { createWithdrawal } = useTransactions();
  
  // Estados do formulário
  const [amount, setAmount] = useState<number | ''>('');
  const [bankName, setBankName] = useState<string>('');
  const [bankAccount, setBankAccount] = useState<string>('');
  const [ownerName, setOwnerName] = useState<string>('');
  const [loadingWithdrawal, setLoadingWithdrawal] = useState(false);
  const [withdrawalSuccess, setWithdrawalSuccess] = useState(false);
  
  // Calcular valor líquido (após taxa de 20% sobre rejeição, se aplicável)
  const netAmount = typeof amount === 'number' ? calculateNetWithdrawal(amount) : 0;
  
  // Verificar se o usuário pode fazer saques (produto ativo, depósito prévio, horário Angola)
  const canWithdraw = 
    user?.hasProduct && 
    user?.hasDeposited &&
    isWithinAngolaBusinessHours() &&
    isWeekday();

  // Bancos disponíveis para saque
  const banks = [
    { id: "BAI", name: "BAI" },
    { id: "BFA", name: "BFA" },
    { id: "BIC", name: "BIC" },
    { id: "BPC", name: "BPC" },
    { id: "OUTRO", name: "Outro banco" }
  ];

  // Reset do modal ao fechar
  const handleClose = () => {
    setAmount('');
    setBankName('');
    setBankAccount('');
    setOwnerName('');
    setWithdrawalSuccess(false);
    onClose();
  };

  // Solicitar saque
  const handleWithdrawal = async () => {
    // Validações
    if (!amount || amount < MIN_WITHDRAWAL) {
      toast({
        title: 'Valor inválido',
        description: `O valor mínimo para saque é KZ ${MIN_WITHDRAWAL.toLocaleString('pt-AO')}`,
        variant: 'destructive'
      });
      return;
    }

    if (amount > MAX_WITHDRAWAL) {
      toast({
        title: 'Valor inválido',
        description: `O valor máximo para saque é KZ ${MAX_WITHDRAWAL.toLocaleString('pt-AO')}`,
        variant: 'destructive'
      });
      return;
    }

    if (user && amount > user.balance) {
      toast({
        title: 'Saldo insuficiente',
        description: 'Você não possui saldo suficiente para este saque',
        variant: 'destructive'
      });
      return;
    }

    if (!bankName) {
      toast({
        title: 'Banco não selecionado',
        description: 'Selecione o banco para o qual deseja receber',
        variant: 'destructive'
      });
      return;
    }

    if (!bankAccount || bankAccount.trim().length < 5) {
      toast({
        title: 'Número de conta inválido',
        description: 'Insira um número de conta bancária válido',
        variant: 'destructive'
      });
      return;
    }

    if (!ownerName || ownerName.trim().length < 3) {
      toast({
        title: 'Nome do titular inválido',
        description: 'Insira o nome do titular da conta bancária',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoadingWithdrawal(true);

      const result = await createWithdrawal({
        amount: Number(amount),
        bankName,
        bankAccount,
        ownerName
      });

      if (result.success) {
        setWithdrawalSuccess(true);
        
        // Limpar formulário
        setAmount('');
        setBankName('');
        setBankAccount('');
        setOwnerName('');
      } else {
        toast({
          title: 'Erro no saque',
          description: 'Não foi possível processar sua solicitação de saque. Tente novamente.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Erro no saque',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      });
    } finally {
      setLoadingWithdrawal(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-dark-secondary border-gray-800 text-white max-w-md">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <DialogTitle className="text-xl font-bold">Retirar</DialogTitle>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-gray-400"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription className="text-gray-400">
            Solicite um saque para sua conta bancária.
          </DialogDescription>
        </DialogHeader>

        {/* Tela de sucesso após o saque ser solicitado */}
        {withdrawalSuccess ? (
          <div className="flex flex-col items-center text-center p-4">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
              <Check className="h-8 w-8 text-emerald-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Solicitação Enviada!</h3>
            <p className="text-gray-400 mb-4">
              Sua solicitação de saque foi enviada com sucesso e será analisada pela nossa equipe.
            </p>
            <div className="bg-dark-tertiary p-4 rounded-lg w-full mb-4">
              <div className="flex justify-between items-center text-sm mb-2">
                <span className="text-gray-400">Status:</span>
                <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">Em análise</span>
              </div>
              <div className="flex justify-between items-center text-sm mb-2">
                <span className="text-gray-400">Valor solicitado:</span>
                <span className="text-white">{formatCurrency(typeof amount === 'number' ? amount : 0)}</span>
              </div>
              <div className="flex items-center text-xs text-gray-500 mt-2">
                <Clock className="h-3 w-3 mr-1" />
                <span>Prazo de até 24h úteis para aprovação</span>
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
            <div className="mb-6">
              <div className="bg-dark-tertiary rounded-lg p-3 mb-3">
                <p className="text-sm text-gray-400">Saldo disponível</p>
                <p className="text-xl font-semibold">{user ? formatCurrency(user.balance) : 'KZ 0.00'}</p>
              </div>
              
              <div className="border-l-4 border-yellow-500 bg-dark-tertiary bg-opacity-50 p-3 rounded-r-lg">
                <h4 className="text-yellow-500 font-medium mb-1">Regras de saque</h4>
                <ul className="text-sm text-gray-300 list-disc pl-4 space-y-1">
                  <li>Valor mínimo: KZ {MIN_WITHDRAWAL.toLocaleString('pt-AO')}</li>
                  <li>Valor máximo: KZ {MAX_WITHDRAWAL.toLocaleString('pt-AO')}</li>
                  <li>Disponível apenas das 10h às 15h (Angola)</li>
                  <li>Apenas de segunda à sexta</li>
                  <li>Taxa de 20% em caso de rejeição</li>
                  <li>Necessário ter produto ativo e depósito prévio</li>
                </ul>
              </div>
            </div>
            
            {/* Alerta quando não é possível sacar */}
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
            
            {/* Formulário de saque */}
            <div className="space-y-4">
              {/* Valor */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Valor a retirar</label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="bg-dark-tertiary text-white border-gray-700"
                  placeholder="KZ 0.00"
                  min={MIN_WITHDRAWAL}
                  max={MAX_WITHDRAWAL}
                  step={100}
                  disabled={!canWithdraw || loadingWithdrawal}
                />
                <p className="text-sm text-gray-400 mt-1">
                  Em caso de rejeição, taxa de 20%: <span className="text-white">{formatCurrency(netAmount)}</span>
                </p>
              </div>
              
              {/* Dados bancários */}
              <div className="bg-dark-tertiary p-3 rounded-md border border-gray-700">
                <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center">
                  <CreditCard className="h-4 w-4 mr-2 text-primary" />
                  Dados para transferência
                </h3>
                
                {/* Banco */}
                <div className="mb-3">
                  <label className="block text-xs text-gray-400 mb-1">Banco</label>
                  <Select 
                    disabled={!canWithdraw || loadingWithdrawal} 
                    value={bankName} 
                    onValueChange={setBankName}
                  >
                    <SelectTrigger className="bg-dark-secondary text-white border-gray-700">
                      <SelectValue placeholder="Selecione o banco" />
                    </SelectTrigger>
                    <SelectContent className="bg-dark-tertiary text-white border-gray-700">
                      {banks.map(bank => (
                        <SelectItem key={bank.id} value={bank.id}>
                          {bank.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Número da conta */}
                <div className="mb-3">
                  <label className="block text-xs text-gray-400 mb-1">Número da conta</label>
                  <Input
                    type="text"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    className="bg-dark-secondary text-white border-gray-700"
                    placeholder="Ex: 1234567890"
                    disabled={!canWithdraw || loadingWithdrawal}
                  />
                </div>
                
                {/* Titular da conta */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Titular da conta</label>
                  <Input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="bg-dark-secondary text-white border-gray-700"
                    placeholder="Nome completo do titular"
                    disabled={!canWithdraw || loadingWithdrawal}
                  />
                </div>
              </div>
              
              {/* Botão de submissão */}
              <Button
                variant="default"
                className="w-full bg-primary hover:bg-primary/90 mt-2"
                onClick={handleWithdrawal}
                disabled={
                  !canWithdraw || 
                  loadingWithdrawal || 
                  !amount || 
                  amount < MIN_WITHDRAWAL || 
                  amount > MAX_WITHDRAWAL ||
                  !bankName ||
                  !bankAccount ||
                  !ownerName ||
                  (user && amount > user.balance)
                }
              >
                {loadingWithdrawal ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processando...
                  </>
                ) : (
                  "Solicitar retirada"
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
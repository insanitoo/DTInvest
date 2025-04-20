import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { X, AlertTriangle, Loader2, Check, InfoIcon, CreditCard } from 'lucide-react';
import { formatCurrency, isWithinAngolaBusinessHours, isWeekday } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth-new';
import { useTransactions } from '@/hooks/use-transactions';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link } from 'wouter';

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
  const [loadingWithdrawal, setLoadingWithdrawal] = useState(false);
  const [withdrawalSuccess, setWithdrawalSuccess] = useState(false);
  const [hasBankInfo, setHasBankInfo] = useState(false);
  
  // Verificar se o usuário tem informações bancárias
  useEffect(() => {
    // Na implementação real, você teria uma chamada de API para verificar isso
    // Por ora, vamos fingir que temos essa informação do usuário
    setHasBankInfo(user?.hasBankInfo || false);
  }, [user]);
  
  // Verificar se o usuário pode fazer saques (produto ativo, depósito prévio, horário Angola)
  const canWithdraw = 
    user?.hasProduct && 
    user?.hasDeposited &&
    isWithinAngolaBusinessHours() &&
    isWeekday() &&
    hasBankInfo;

  // Reset do modal ao fechar
  const handleClose = () => {
    setAmount('');
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

    if (!hasBankInfo) {
      toast({
        title: 'Dados bancários não configurados',
        description: 'Configure seus dados bancários na página Minha Conta > Banco',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoadingWithdrawal(true);

      const result = await createWithdrawal({
        amount: Number(amount)
        // As informações bancárias já estão salvas no perfil do usuário
      });

      if (result.success) {
        setWithdrawalSuccess(true);
        setAmount('');
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
      <DialogContent className="bg-dark-secondary border-gray-800 text-white max-w-md max-h-[90vh] overflow-hidden flex flex-col">
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
        
        <ScrollArea className="flex-1 pr-4">
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
                    {!hasBankInfo ? (
                      <div className="flex flex-col">
                        <span>Você precisa configurar seus dados bancários antes de solicitar um saque.</span>
                        <Link href="/user/banco">
                          <a className="text-primary underline text-sm mt-1 inline-flex items-center">
                            <CreditCard className="h-3 w-3 mr-1" /> Configurar dados bancários
                          </a>
                        </Link>
                      </div>
                    ) : !user?.hasProduct ? "É necessário comprar um produto antes de fazer saques." : 
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
                </div>
                
                {/* Mensagem sobre dados bancários */}
                {hasBankInfo && (
                  <div className="bg-blue-900/30 border border-blue-800 rounded-md p-3">
                    <div className="flex items-start">
                      <InfoIcon className="h-5 w-5 text-blue-400 mr-2 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-blue-200 mb-1">
                          O saque será enviado para a conta bancária configurada no seu perfil.
                        </p>
                        <Link href="/user/banco">
                          <a className="text-primary text-sm underline flex items-center w-fit">
                            <CreditCard className="h-3 w-3 mr-1" /> 
                            Ver/Editar dados bancários
                          </a>
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Alerta sobre taxa de reposição */}
                <div className="bg-amber-900/30 border border-amber-800 rounded-md p-3">
                  <div className="flex items-start">
                    <AlertTriangle className="h-5 w-5 text-amber-400 mr-2 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-amber-200">
                      <span className="font-medium">Atenção:</span> Verifique seus dados bancários. Saques falhos devido a informações incorretas sofrem uma taxa de reposição de 20%.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </ScrollArea>
        
        {!withdrawalSuccess && (
          <DialogFooter className="pt-4 flex-shrink-0">
            <Button
              variant="default"
              className="w-full bg-primary hover:bg-primary/90"
              onClick={handleWithdrawal}
              disabled={
                !canWithdraw || 
                loadingWithdrawal || 
                !amount || 
                amount < MIN_WITHDRAWAL || 
                amount > MAX_WITHDRAWAL ||
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
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { X, AlertTriangle, Loader2, Check, InfoIcon, Clock } from 'lucide-react';
import { formatCurrency, isWithinAngolaBusinessHours, isWeekday } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth-new';
import { useTransactions } from '@/hooks/use-transactions';
import { useToast } from '@/hooks/use-toast';
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
  
  // Define se usuário tem informações bancárias (simplificado)
  // Na implementação real, isso viria de uma chamada API separada
  const hasBankInfo = user?.hasDeposited || false;  // Simplificando para teste
  
  // Verificar se o usuário pode fazer saques
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

    try {
      setLoadingWithdrawal(true);

      // Para simplificar o teste, estamos incluindo dados bancários padrão
      // Na implementação real, essas informações viriam do perfil do usuário
      const result = await createWithdrawal({
        amount: Number(amount),
        bankName: "Banco de Teste",
        bankAccount: "12345678901",
        ownerName: "Usuário de Teste"
      });

      if (result.success) {
        setWithdrawalSuccess(true);
        setAmount('');
      } else {
        toast({
          title: 'Erro no saque',
          description: 'Não foi possível processar sua solicitação de saque.',
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
      <DialogContent className="bg-dark-secondary border-gray-800 text-white max-w-md overflow-auto max-h-[80vh]">
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
          <div className="py-4">
            <div className="mx-auto w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
              <Check className="h-8 w-8 text-emerald-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-center">Solicitação Enviada!</h3>
            <p className="text-gray-400 mb-4 text-center">
              Sua solicitação de saque foi enviada com sucesso.
            </p>
            <div className="bg-dark-tertiary p-3 rounded-md w-full mb-4">
              <div className="flex justify-between items-center text-sm mb-2">
                <span className="text-gray-400">Status:</span>
                <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">Em análise</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Valor:</span>
                <span className="text-white">{formatCurrency(typeof amount === 'number' ? amount : 0)}</span>
              </div>
            </div>
            <div className="space-y-3">
              <Button
                variant="default"
                className="w-full bg-primary hover:bg-primary/90"
                onClick={handleClose}
              >
                Fechar
              </Button>
              
              <Button
                variant="outline"
                className="w-full flex items-center justify-center"
                onClick={() => {
                  handleClose();
                  window.location.href = "/historico-saques";
                }}
              >
                <Clock className="mr-2 h-4 w-4" />
                Ver histórico de saques
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-2">
            <div className="bg-dark-tertiary rounded-lg p-3 mb-3">
              <p className="text-sm text-gray-400">Saldo disponível</p>
              <p className="text-xl font-semibold">{user ? formatCurrency(user.balance) : 'KZ 0.00'}</p>
            </div>
            
            <div className="space-y-3 mb-3">
              <div className="text-sm text-gray-300">
                <h4 className="text-yellow-500 font-medium mb-1">Regras de saque</h4>
                <ul className="text-sm list-disc pl-4 space-y-1">
                  <li>Valor mínimo: KZ {MIN_WITHDRAWAL.toLocaleString('pt-AO')}</li>
                  <li>Valor máximo: KZ {MAX_WITHDRAWAL.toLocaleString('pt-AO')}</li>
                  <li>Disponível 10h-15h (Angola), dias úteis</li>
                </ul>
              </div>
            </div>
            
            {/* Alerta quando não é possível sacar */}
            {!canWithdraw && (
              <Alert variant="destructive" className="mb-3 py-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Saque indisponível</AlertTitle>
                <AlertDescription>
                  {!hasBankInfo ? (
                    <>
                      <span>Configure seus dados bancários antes.</span>
                      <div className="mt-1">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-primary bg-primary/10 border-primary/20"
                          onClick={() => {
                            onClose();
                            window.location.href = "/user";
                          }}
                        >
                          Configurar Dados
                        </Button>
                      </div>
                    </>
                  ) : !user?.hasProduct ? "Compre um produto primeiro." : 
                  !user?.hasDeposited ? "Faça um depósito primeiro." :
                  !isWithinAngolaBusinessHours() ? "Apenas das 10h às 15h." : 
                  !isWeekday() ? "Apenas dias úteis." : 
                  "Indisponível no momento."}
                </AlertDescription>
              </Alert>
            )}
            
            {/* Formulário de saque */}
            <div className="mb-3">
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
            
            {/* Alerta sobre taxa de reposição */}
            <Alert className="bg-amber-900/30 border-amber-800 mb-4 py-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <AlertTitle className="text-amber-400">Atenção</AlertTitle>
              <AlertDescription className="text-amber-200 text-sm">
                Verifique seus dados bancários. Saques falhos devido a informações incorretas sofrem taxa de 20%.
              </AlertDescription>
            </Alert>
            
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
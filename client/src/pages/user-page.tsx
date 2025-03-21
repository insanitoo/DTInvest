import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { BottomNavigation } from '@/components/layout/bottom-navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { bankFormSchema, type BankFormValues } from '@/lib/validations/bank'; // Assuming this is correctly defined elsewhere
import { formatCurrency, formatDate, getTransactionStatusColor, getTransactionStatusIcon } from '@/lib/utils';
import { LevelCard } from '@/components/team/level-card';
import { Transaction } from '@shared/schema';
import { Loader2, LogOut } from 'lucide-react';
import { CyberneticBox } from '@/components/ui/cybernetic-box';
import { Form, FormField, FormItem, FormLabel, FormMessage, FormControl } from '@/components/ui/form';


export default function UserPage() {
  const [location, setLocation] = useLocation();
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  const { data: referralStats } = useQuery({
    queryKey: ['/api/user/referrals'],
  });

  // Get tab from URL query parameter
  useEffect(() => {
    const params = new URLSearchParams(location.split('?')[1]);
    const tab = params.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
  }, [location]);

  // Transactions query
  const { data: transactions, isLoading: isLoadingTransactions } = useQuery<Transaction[]>({
    queryKey: ['/api/transactions'],
  });

  // Bank form
  const form = useForm<BankFormValues>({
    resolver: zodResolver(bankFormSchema),
    defaultValues: {
      bank: user?.bankInfo?.bank || '',
      ownerName: user?.bankInfo?.ownerName || '',
      accountNumber: user?.bankInfo?.accountNumber || '',
    },
  });

  useEffect(() => {
    if (user?.bankInfo) {
      form.reset({
        bank: user.bankInfo.bank || '',
        ownerName: user.bankInfo.ownerName || '',
        accountNumber: user.bankInfo.accountNumber || '',
      });
    }
  }, [user, form]);

  // Save bank information mutation (reconstructed from original)
  const saveBankMutation = useMutation({
    mutationFn: async (data: BankFormValues) => {
      const res = await apiRequest('POST', '/api/user/bank', data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      toast({
        title: 'Informações bancárias salvas',
        description: 'Suas informações bancárias foram salvas com sucesso!',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: BankFormValues) => {
    saveBankMutation.mutate(data);
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <div className="pb-20">
      <header className="p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Perfil</h1>
        <div className="rounded-full bg-white w-10 h-10 flex items-center justify-center">
          <span className="text-dark-secondary text-sm font-bold">S&P</span>
        </div>
      </header>

      <div className="mx-4 space-y-4">
        {referralStats && (
          <>
            <LevelCard
              level={1}
              commission={referralStats.level1.commission}
              members={referralStats.level1.count}
              commissionPercentage={25}
              referrals={referralStats.level1.referrals}
            />

            <LevelCard
              level={2}
              commission={referralStats.level2.commission}
              members={referralStats.level2.count}
              commissionPercentage={5}
              referrals={referralStats.level2.referrals}
            />

            <LevelCard
              level={3}
              commission={referralStats.level3.commission}
              members={referralStats.level3.count}
              commissionPercentage={2}
              referrals={referralStats.level3.referrals}
            />
          </>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="bank"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm text-gray-400">Banco</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={saveBankMutation.isPending}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-dark-tertiary border-gray-700">
                        <SelectValue placeholder="Selecione um banco" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-dark-secondary text-white border-gray-700">
                      <SelectItem value="BAI">BAI</SelectItem>
                      <SelectItem value="BFA">BFA</SelectItem>
                      <SelectItem value="BIC">BIC</SelectItem>
                      <SelectItem value="BPC">BPC</SelectItem>
                      <SelectItem value="BMA">BMA</SelectItem>
                      <SelectItem value="KEVE">KEVE</SelectItem>
                      <SelectItem value="SOL">SOL</SelectItem>
                      <SelectItem value="OUTRO">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-red-500 text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ownerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm text-gray-400">Nome do Titular</FormLabel>
                  <FormControl>
                    <Input
                      className="bg-dark-tertiary border-gray-700"
                      placeholder="Nome completo do titular da conta"
                      disabled={saveBankMutation.isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-red-500 text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="accountNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm text-gray-400">Número da Conta</FormLabel>
                  <FormControl>
                    <Input
                      className="bg-dark-tertiary border-gray-700"
                      placeholder="Número da conta bancária"
                      disabled={saveBankMutation.isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-red-500 text-xs" />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={saveBankMutation.isPending}
            >
              {saveBankMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                "Salvar Informações"
              )}
            </Button>
          </form>
        </Form>

        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Informações do Usuário</h3>
          <CyberneticBox>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-400">Número de Telefone</p>
                <p className="text-base">{user?.phoneNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Código de Convite</p>
                <p className="text-base">{user?.referralCode}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Total de Comissões</p>
                <p className="text-base">
                  {user ? formatCurrency(
                    (user.level1Commission || 0) +
                    (user.level2Commission || 0) +
                    (user.level3Commission || 0)
                  ) : 'KZ 0.00'}
                </p>
              </div>
            </div>
          </CyberneticBox>
        </div>


        <Button
          variant="destructive"
          className="w-full"
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
        >
          {logoutMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saindo...
            </>
          ) : (
            "Sair"
          )}
        </Button>
        {/* Transactions Section (from original code, adapted) */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Transações Recentes</h3>

          {isLoadingTransactions ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : transactions && transactions.length > 0 ? (
            <div className="space-y-3">
              {transactions.slice(0, 5).map((transaction) => (
                <CyberneticBox key={transaction.id}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full ${
                        transaction.status === 'completed' ? 'bg-green-500' :
                        transaction.status === 'pending' ? 'bg-yellow-500' :
                        transaction.status === 'processing' ? 'bg-blue-500' :
                        'bg-red-500'
                      } flex items-center justify-center`}>
                        <i className={`fas fa-${getTransactionStatusIcon(transaction.status)} text-white text-xs`}></i>
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {transaction.type === 'deposit' ? 'Depósito' :
                           transaction.type === 'withdrawal' ? 'Saque' :
                           transaction.type === 'commission' ? 'Comissão' : 'Compra'}
                        </p>
                        <span className={`text-sm ${getTransactionStatusColor(transaction.status)}`}>
                          {transaction.status === 'completed' ? 'Concluído' :
                           transaction.status === 'pending' ? 'Pendente' :
                           transaction.status === 'processing' ? 'Processando' : 'Falhou'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(transaction.amount)}</p>
                      <span className="text-sm text-gray-400">{formatDate(transaction.createdAt)}</span>
                    </div>
                  </div>
                </CyberneticBox>
                    <p className="text-gray-400 text-sm truncate max-w-[150px]">
                      {transaction.type === 'deposit' ? 'Depósito' :
                        transaction.type === 'withdrawal' ? 'Saque' :
                          transaction.type === 'commission' ? 'Comissão' :
                            'Compra'}
                      {transaction.bankAccount ? ` - ${transaction.bankAccount}` : ''}
                    </p>
                    <p className={`font-semibold ${
                      transaction.type === 'withdrawal' ? 'text-red-400' :
                        transaction.type === 'deposit' || transaction.type === 'commission' ? 'text-green-400' :
                          'text-yellow-400'
                    }`}>
                      {transaction.type === 'withdrawal' ? '-' :
                        transaction.type === 'deposit' || transaction.type === 'commission' ? '+' :
                          ''}
                      {formatCurrency(transaction.amount)}
                    </p>
                  </div>
                </CyberneticBox>
              ))}

              {transactions.length > 5 && (
                <Button
                  variant="default"
                  className="w-full bg-dark-tertiary hover:bg-dark-tertiary/80"
                  onClick={() => setActiveTab('transactionsAll')}
                >
                  Ver mais transações
                </Button>
              )}
            </div>
          ) : (
            <CyberneticBox className="py-6">
              <p className="text-center text-gray-400">
                Você ainda não possui transações.
              </p>
            </CyberneticBox>
          )}
        </div>

      </div>

      <BottomNavigation />
    </div>
  );
}

// Função formatDate já importada de @/lib/utils

// getTransactionStatusIcon já importado de @/lib/utils
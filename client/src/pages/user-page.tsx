import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, LogOut, ChevronRight } from 'lucide-react';
import { Transaction, BankInfo } from '@shared/schema';
import { useAuth } from '@/hooks/use-auth-new';
import { BottomNavigation } from '@/components/layout/bottom-navigation';
import { BalanceCard } from '@/components/home/balance-card';
import { Button } from '@/components/ui/button';
import { CyberneticBox } from '@/components/ui/cybernetic-box';
import { WithdrawalModal } from '@/components/modals/withdrawal-modal';
import { DepositModal } from '@/components/modals/deposit-modal';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, formatDate, getTransactionStatusColor, getTransactionStatusIcon } from '@/lib/utils';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

const bankFormSchema = z.object({
  bank: z.string().min(1, "Nome do banco é obrigatório"),
  ownerName: z.string().min(1, "Nome do titular é obrigatório"),
  accountNumber: z.string().min(1, "Número da conta é obrigatório"),
});

type BankFormValues = z.infer<typeof bankFormSchema>;

export default function UserPage() {
  const [location, setLocation] = useLocation();
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  // Get tab from URL query parameter
  useEffect(() => {
    const params = new URLSearchParams(location.split('?')[1]);
    const tab = params.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
  }, [location]);

  // Transactions query - Agora com staleTime reduzido para forçar revalidação mais frequente
  const { data: transactions, isLoading: isLoadingTransactions } = useQuery<Transaction[]>({
    queryKey: ['/api/transactions'],
    staleTime: 10 * 1000, // Considerar dados obsoletos após 10 segundos
    refetchInterval: 30 * 1000, // Revalidar a cada 30 segundos
    refetchOnWindowFocus: true, // Revalidar quando o usuário voltar para a janela
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

  // Update form values when user data changes
  useEffect(() => {
    if (user?.bankInfo) {
      form.reset({
        bank: user.bankInfo.bank || '',
        ownerName: user.bankInfo.ownerName || '',
        accountNumber: user.bankInfo.accountNumber || '',
      });
    }
  }, [user, form]);

  // Save bank information mutation
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

  // Handle logout
  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <>
      <div className="pb-20">
        {/* Header */}
        <header className="p-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Usuário</h1>
          <div className="rounded-full bg-white w-10 h-10 flex items-center justify-center">
            <span className="text-dark-secondary text-sm font-bold">DTI</span>
          </div>
        </header>

        {/* User Info */}
        <div className="mx-4 mb-6">
          <CyberneticBox>
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center">
                <LogOut className="h-6 w-6 text-gray-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{user?.phoneNumber}</h3>
                <p className="text-sm text-gray-400">
                  Membro desde: {user?.createdAt ? new Date(user.createdAt).getFullYear() : ''}
                </p>
              </div>
            </div>
          </CyberneticBox>
        </div>

        {/* Balance Card */}
        <BalanceCard 
          onDepositClick={() => setShowDepositModal(true)}
          onWithdrawClick={() => setShowWithdrawalModal(true)}
        />

        {/* Tabs */}
        <div className="mx-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-3 mb-6 bg-dark-tertiary">
              <TabsTrigger value="profile">Perfil</TabsTrigger>
              <TabsTrigger value="transactions">Transações</TabsTrigger>
              <TabsTrigger value="bank">Banco</TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile">
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

              {/* Logout Button */}
              <Button 
                variant="default" 
                className="w-full bg-dark-tertiary hover:bg-dark-tertiary/80 mb-4"
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
            </TabsContent>

            {/* Transactions Tab */}
            <TabsContent value="transactions">
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
                        <div className="flex justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <div className={`w-8 h-8 rounded-full ${
                                transaction.status === 'completed' ? 'bg-green-500' :
                                transaction.status === 'pending' ? 'bg-yellow-500' :
                                transaction.status === 'processing' ? 'bg-blue-500' :
                                'bg-red-500'
                              } flex items-center justify-center`}>
                              <i className={`fas fa-${getTransactionStatusIcon(transaction.status)} text-white text-xs`}></i>
                            </div>
                            <span className={`text-sm font-medium ${getTransactionStatusColor(transaction.status)}`}>
                              {transaction.status === 'completed' ? 'Concluído' :
                               transaction.status === 'pending' ? 'Pendente' :
                               transaction.status === 'processing' ? 'Processando' :
                               'Falhou'}
                            </span>
                          </div>
                          <span className="text-sm text-gray-400">{formatDate(transaction.createdAt)}</span>
                        </div>
                        <div className="flex justify-between items-center">
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
            </TabsContent>

            {/* All Transactions Tab */}
            <TabsContent value="transactionsAll">
              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-semibold">Todas as Transações</h3>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setActiveTab('transactions')}
                  >
                    Voltar
                  </Button>
                </div>

                {isLoadingTransactions ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : transactions && transactions.length > 0 ? (
                  <div className="space-y-3">
                    {transactions.map((transaction) => (
                      <CyberneticBox key={transaction.id}>
                        <div className="flex justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <div className={`w-8 h-8 rounded-full ${
                                transaction.status === 'completed' ? 'bg-green-500' :
                                transaction.status === 'pending' ? 'bg-yellow-500' :
                                transaction.status === 'processing' ? 'bg-blue-500' :
                                'bg-red-500'
                              } flex items-center justify-center`}>
                              <i className={`fas fa-${getTransactionStatusIcon(transaction.status)} text-white text-xs`}></i>
                            </div>
                            <span className={`text-sm font-medium ${getTransactionStatusColor(transaction.status)}`}>
                              {transaction.status === 'completed' ? 'Concluído' :
                               transaction.status === 'pending' ? 'Pendente' :
                               transaction.status === 'processing' ? 'Processando' :
                               'Falhou'}
                            </span>
                          </div>
                          <span className="text-sm text-gray-400">{formatDate(transaction.createdAt)}</span>
                        </div>
                        <div className="flex justify-between items-center">
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
                  </div>
                ) : (
                  <CyberneticBox className="py-6">
                    <p className="text-center text-gray-400">
                      Você ainda não possui transações.
                    </p>
                  </CyberneticBox>
                )}
              </div>
            </TabsContent>

            {/* Bank Information Tab */}
            <TabsContent value="bank">
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Informações Bancárias</h3>
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
              </div>

              <div className="mt-6 bg-dark-secondary border-l-4 border-yellow-500 p-4 rounded-r-md">
                <h4 className="font-medium mb-2 text-yellow-400">Importante:</h4>
                <p className="text-sm text-gray-300">
                  Suas informações bancárias serão usadas para processamento de saques. 
                  Certifique-se de fornecer dados corretos para evitar problemas no processamento.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Modals */}
      <WithdrawalModal 
        isOpen={showWithdrawalModal} 
        onClose={() => setShowWithdrawalModal(false)} 
      />
      <DepositModal 
        isOpen={showDepositModal} 
        onClose={() => setShowDepositModal(false)} 
      />

      {/* Bottom Navigation */}
      <BottomNavigation />
    </>
  );
}
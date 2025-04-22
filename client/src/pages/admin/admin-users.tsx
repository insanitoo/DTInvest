import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Loader2, AlertCircle, Lock, Unlock, Search } from 'lucide-react';
import { User, ReferralInfo } from '@shared/schema';
import { AdminNavigation } from './components/admin-navigation';
import { CyberneticBox } from '@/components/ui/cybernetic-box';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { formatCurrency, formatDate, formatPhoneNumber } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export default function AdminUsers() {
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Get all users
  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['/api/admin/users'],
  });
  
  // Filtered users based on search query
  const filteredUsers = useMemo(() => {
    if (!users || !searchQuery.trim()) return users;
    
    const query = searchQuery.toLowerCase().trim();
    return users.filter(user => 
      // Procurar por número de telefone
      user.phoneNumber.toLowerCase().includes(query) ||
      // Procurar por ID
      user.id.toString().includes(query) ||
      // Procurar por código de referral
      (user.referralCode?.toLowerCase().includes(query) || false) ||
      // Procurar por quem indicou
      (user.referredBy?.toLowerCase().includes(query) || false)
    );
  }, [users, searchQuery]);
  
  // Block/unblock user mutation
  const blockUserMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser) return;
      
      const res = await apiRequest('PUT', `/api/admin/users/${selectedUser.id}/block`, { 
        isBlocked: !selectedUser.isBlocked 
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      
      toast({
        title: selectedUser?.isBlocked ? 'Usuário desbloqueado' : 'Usuário bloqueado',
        description: selectedUser?.isBlocked 
          ? 'O usuário foi desbloqueado com sucesso.' 
          : 'O usuário foi bloqueado com sucesso.',
      });
      
      setShowDialog(false);
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Consulta para obter detalhes de um usuário específico, incluindo referrals
  const userDetailsQuery = useQuery<User>({
    queryKey: ['/api/admin/users/details', selectedUser?.id],
    queryFn: async () => {
      if (!selectedUser) throw new Error("Usuário não selecionado");
      const res = await apiRequest('GET', `/api/admin/users/${selectedUser.id}`);
      return await res.json();
    },
    enabled: !!selectedUser && showDialog, // Só executa quando um usuário for selecionado e o diálogo aberto
  });
  
  // Handle user click
  const handleUserClick = (user: User) => {
    setSelectedUser(user);
    setShowDialog(true);
  };
  
  // Handle block/unblock
  const handleBlockToggle = () => {
    blockUserMutation.mutate();
  };

  return (
    <div className="min-h-screen pb-8">
      <AdminNavigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold">Gerenciar Usuários</h1>
          
          <div className="relative w-full md:w-96">
            <Input
              placeholder="Buscar por Telefone, ID ou Código"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-dark-tertiary text-white pr-10"
            />
            <Search className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
          </div>
        ) : filteredUsers && filteredUsers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="px-4 py-3 text-left">ID</th>
                  <th className="px-4 py-3 text-left">Telefone</th>
                  <th className="px-4 py-3 text-left">Saldo</th>
                  <th className="px-4 py-3 text-left">Referrals</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Criado em</th>
                  <th className="px-4 py-3 text-left">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr 
                    key={user.id} 
                    className="border-b border-gray-800 hover:bg-dark-tertiary/30 transition-colors"
                  >
                    <td className="px-4 py-3">{user.id}</td>
                    <td className="px-4 py-3">{formatPhoneNumber(user.phoneNumber)}</td>
                    <td className="px-4 py-3">{formatCurrency(user.balance)}</td>
                    <td className="px-4 py-3">
                      {(user.level1Referrals || 0) + (user.level2Referrals || 0) + (user.level3Referrals || 0)}
                    </td>
                    <td className="px-4 py-3">
                      {user.isBlocked ? (
                        <span className="px-2 py-1 rounded-full text-xs bg-red-500 bg-opacity-20 text-white">
                          Bloqueado
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs bg-green-500 bg-opacity-20 text-white">
                          Ativo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{formatDate(user.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Button 
                        variant="primary" 
                        size="sm"
                        onClick={() => handleUserClick(user)}
                      >
                        Detalhes
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <CyberneticBox className="py-12 text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-gray-400 mb-4" />
            <p className="text-gray-400">Nenhum usuário encontrado.</p>
          </CyberneticBox>
        )}
      </div>
      
      {/* User Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-dark-secondary border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle>Detalhes do Usuário</DialogTitle>
            {selectedUser && (
              <DialogDescription className="text-gray-400">
                ID: {selectedUser.id} | Telefone: {formatPhoneNumber(selectedUser.phoneNumber)}
              </DialogDescription>
            )}
          </DialogHeader>
          
          {userDetailsQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : userDetailsQuery.error ? (
            <div className="text-center py-8">
              <AlertCircle className="mx-auto h-8 w-8 text-red-400 mb-2" />
              <p className="text-red-400">Erro ao carregar detalhes do usuário</p>
            </div>
          ) : userDetailsQuery.data ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400">Código de Convite</p>
                  <p>{userDetailsQuery.data.referralCode}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Referido por</p>
                  <p>{userDetailsQuery.data.referredBy || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Saldo</p>
                  <p>{formatCurrency(userDetailsQuery.data.balance)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Renda Diária</p>
                  <p>{formatCurrency(userDetailsQuery.data.dailyIncome || 0)}</p>
                </div>
              </div>
              
              <div className="border-t border-gray-700 pt-4">
                <h3 className="font-medium mb-2">Referrals e Comissões</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-400">Nível 1</p>
                    <p>{userDetailsQuery.data.referrals?.counts?.level1 || 0} referrals</p>
                    <p className="text-sm text-gray-400 mt-1">Comissão</p>
                    <p>{formatCurrency(userDetailsQuery.data.level1Commission || 0)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Nível 2</p>
                    <p>{userDetailsQuery.data.referrals?.counts?.level2 || 0} referrals</p>
                    <p className="text-sm text-gray-400 mt-1">Comissão</p>
                    <p>{formatCurrency(userDetailsQuery.data.level2Commission || 0)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Nível 3</p>
                    <p>{userDetailsQuery.data.referrals?.counts?.level3 || 0} referrals</p>
                    <p className="text-sm text-gray-400 mt-1">Comissão</p>
                    <p>{formatCurrency(userDetailsQuery.data.level3Commission || 0)}</p>
                  </div>
                </div>
                
                {userDetailsQuery.data.referrals && userDetailsQuery.data.referrals.level1 && userDetailsQuery.data.referrals.level1.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium mb-2">Lista de Referrals Nível 1</h4>
                    <div className="bg-dark-tertiary/30 rounded-md p-2 max-h-32 overflow-y-auto">
                      {userDetailsQuery.data.referrals.level1.map(ref => (
                        <div key={ref.id} className="text-sm py-1 border-b border-gray-800">
                          <span className="font-medium">ID {ref.id}</span> - {formatPhoneNumber(ref.phoneNumber)}
                          {ref.hasProduct && (
                            <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs bg-green-500 bg-opacity-20 text-white">
                              Produto
                            </span>
                          )}
                          <span className="ml-2 text-gray-400">
                            Saldo: {formatCurrency(ref.balance)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {userDetailsQuery.data.referrals && userDetailsQuery.data.referrals.level2 && userDetailsQuery.data.referrals.level2.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium mb-2">Lista de Referrals Nível 2</h4>
                    <div className="bg-dark-tertiary/30 rounded-md p-2 max-h-32 overflow-y-auto">
                      {userDetailsQuery.data.referrals.level2.map(ref => (
                        <div key={ref.id} className="text-sm py-1 border-b border-gray-800">
                          <span className="font-medium">ID {ref.id}</span> - {formatPhoneNumber(ref.phoneNumber)}
                          {ref.hasProduct && (
                            <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs bg-green-500 bg-opacity-20 text-white">
                              Produto
                            </span>
                          )}
                          <span className="ml-2 text-gray-400">
                            Saldo: {formatCurrency(ref.balance)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {userDetailsQuery.data.referrals && userDetailsQuery.data.referrals.level3 && userDetailsQuery.data.referrals.level3.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium mb-2">Lista de Referrals Nível 3</h4>
                    <div className="bg-dark-tertiary/30 rounded-md p-2 max-h-32 overflow-y-auto">
                      {userDetailsQuery.data.referrals.level3.map(ref => (
                        <div key={ref.id} className="text-sm py-1 border-b border-gray-800">
                          <span className="font-medium">ID {ref.id}</span> - {formatPhoneNumber(ref.phoneNumber)}
                          {ref.hasProduct && (
                            <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs bg-green-500 bg-opacity-20 text-white">
                              Produto
                            </span>
                          )}
                          <span className="ml-2 text-gray-400">
                            Saldo: {formatCurrency(ref.balance)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {selectedUser && (
                <div className="border-t border-gray-700 pt-4">
                  <h3 className="font-medium mb-2">Status</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-400">Status da Conta</p>
                      <p className={selectedUser.isBlocked ? 'text-red-400' : 'text-green-400'}>
                        {selectedUser.isBlocked ? 'Bloqueada' : 'Ativa'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Último Acesso</p>
                      <p>{selectedUser.lastOnline ? formatDate(selectedUser.lastOnline) : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Tem Produto?</p>
                      <p>{selectedUser.hasProduct ? 'Sim' : 'Não'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Fez Depósito?</p>
                      <p>{selectedUser.hasDeposited ? 'Sim' : 'Não'}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {selectedUser && selectedUser.bankInfo && Object.keys(selectedUser.bankInfo).length > 0 && (
                <div className="border-t border-gray-700 pt-4">
                  <h3 className="font-medium mb-2">Informações Bancárias</h3>
                  <div>
                    <p className="text-sm text-gray-400">Banco</p>
                    <p>{selectedUser.bankInfo.bank || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Proprietário</p>
                    <p>{selectedUser.bankInfo.ownerName || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Número da Conta</p>
                    <p>{selectedUser.bankInfo.accountNumber || 'N/A'}</p>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant={selectedUser?.isBlocked ? 'primary' : 'destructive'}
              onClick={handleBlockToggle}
              disabled={blockUserMutation.isPending}
            >
              {blockUserMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Processando...
                </>
              ) : selectedUser?.isBlocked ? (
                <>
                  <Unlock className="h-4 w-4 mr-2" />
                  Desbloquear Usuário
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Bloquear Usuário
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

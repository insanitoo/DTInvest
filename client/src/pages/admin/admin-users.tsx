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
    return users.filter(user => {
      // Verificar se os campos existem antes de usar
      const phoneMatch = user.phoneNumber ? user.phoneNumber.toLowerCase().includes(query) : false;
      const idMatch = user.id ? user.id.toString().includes(query) : false;
      const referralCodeMatch = user.referralCode ? user.referralCode.toLowerCase().includes(query) : false;
      const referredByMatch = user.referredBy ? user.referredBy.toLowerCase().includes(query) : false;
      
      return phoneMatch || idMatch || referralCodeMatch || referredByMatch;
    });
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
          
          <div className="flex w-full md:w-96 gap-2">
            <Input
              placeholder="Buscar por ID, telefone, ou código"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-dark-tertiary border-gray-700"
            />
            <Button variant="outline" size="icon">
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : !filteredUsers || filteredUsers.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400">
              {searchQuery ? 'Nenhum usuário encontrado para esta busca.' : 'Nenhum usuário cadastrado.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUsers.map((user) => (
              <CyberneticBox 
                key={user.id} 
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => handleUserClick(user)}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold">{formatPhoneNumber(user.phoneNumber)}</h3>
                    <p className="text-sm text-gray-400">ID: {user.id}</p>
                  </div>
                  {user.isBlocked && (
                    <div className="px-2 py-1 bg-red-900/30 border border-red-800 rounded text-red-400 text-xs font-medium">
                      Bloqueado
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <p className="text-gray-400">Saldo</p>
                    <p>{formatCurrency(user.balance || 0)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Referidos</p>
                    <p>{user.totalReferrals || 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Depósito</p>
                    <p>{user.hasDeposited ? 'Sim' : 'Não'}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Produto</p>
                    <p>{user.hasProduct ? 'Sim' : 'Não'}</p>
                  </div>
                </div>
              </CyberneticBox>
            ))}
          </div>
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
                  <p className="text-sm text-gray-400">Total de Referidos</p>
                  <p>{userDetailsQuery.data.totalReferrals || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Saldo Disponível</p>
                  <p>{formatCurrency(userDetailsQuery.data.balance || 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Total de Comissões</p>
                  <p>{formatCurrency(userDetailsQuery.data.totalCommission || 0)}</p>
                </div>
              </div>
              
              <div className="border-t border-gray-700 pt-4">
                <h3 className="font-medium mb-2">Referidos</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-400">Nível 1 (25%)</p>
                    <p>{userDetailsQuery.data.level1ReferralCount || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Nível 2 (5%)</p>
                    <p>{userDetailsQuery.data.level2ReferralCount || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Nível 3 (3%)</p>
                    <p>{userDetailsQuery.data.level3ReferralCount || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Cadastro</p>
                    <p>{formatDate(userDetailsQuery.data.createdAt)}</p>
                  </div>
                </div>
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
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-400">Sem dados disponíveis</p>
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
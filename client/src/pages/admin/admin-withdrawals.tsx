import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  Loader2, 
  AlertCircle, 
  Check, 
  X,
  Search,
  Clock,
  Banknote
} from 'lucide-react';
import { AdminNavigation } from './components/admin-navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CyberneticBox } from '@/components/ui/cybernetic-box';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { formatCurrency, formatDate, formatPhoneNumber } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface WithdrawalRequest {
  id: number;
  userId: number;
  amount: number;
  bankName: string | null;
  bankAccount: string | null;
  ownerName: string;
  status: 'requested' | 'approved' | 'rejected';
  createdAt: string;
  processedAt: string | null;
  processedBy: number | null;
}

export default function AdminWithdrawals() {
  const { toast } = useToast();
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalRequest | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Get all withdrawal requests
  const { data: withdrawals, isLoading } = useQuery<WithdrawalRequest[]>({
    queryKey: ['/api/admin/withdrawal-requests'],
  });
  
  // Filtered withdrawals based on search query
  const filteredWithdrawals = withdrawals ? withdrawals.filter(withdrawal => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase().trim();
    
    return (
      (withdrawal.bankName?.toLowerCase()?.includes(query) || false) ||
      (withdrawal.bankAccount?.toLowerCase()?.includes(query) || false) ||
      withdrawal.ownerName.toLowerCase().includes(query) ||
      withdrawal.userId.toString().includes(query) ||
      withdrawal.id.toString().includes(query)
    );
  }) : [];
  
  // Approve withdrawal mutation
  const approveWithdrawalMutation = useMutation({
    mutationFn: async () => {
      if (!selectedWithdrawal) return;
      
      const res = await apiRequest('PUT', `/api/admin/withdrawal/${selectedWithdrawal.id}/approve`, {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/withdrawal-requests'] });
      
      toast({
        title: 'Saque aprovado',
        description: 'O saque foi aprovado com sucesso',
      });
      
      setShowDialog(false);
      setSelectedWithdrawal(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Reject withdrawal mutation
  const rejectWithdrawalMutation = useMutation({
    mutationFn: async () => {
      if (!selectedWithdrawal) return;
      
      const res = await apiRequest('PUT', `/api/admin/withdrawal/${selectedWithdrawal.id}/reject`, {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/withdrawal-requests'] });
      
      toast({
        title: 'Saque rejeitado',
        description: 'O saque foi rejeitado com sucesso',
      });
      
      setShowDialog(false);
      setSelectedWithdrawal(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Handle withdrawal click
  const handleWithdrawalClick = (withdrawal: WithdrawalRequest) => {
    setSelectedWithdrawal(withdrawal);
    setShowDialog(true);
  };
  
  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'requested':
        return <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">Em análise</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/50">Aprovado</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/50">Rejeitado</Badge>;
      default:
        return <Badge variant="outline">Desconhecido</Badge>;
    }
  };
  
  return (
    <div className="min-h-screen pb-8">
      <AdminNavigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold">Solicitações de Saque</h1>
          
          <div className="flex w-full md:w-96 gap-2">
            <div className="relative flex-1">
              <Input
                placeholder="Buscar por Banco, Conta ou Usuário"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-dark-tertiary text-white pr-10"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    // Refresca a busca
                    queryClient.invalidateQueries({ queryKey: ['/api/admin/withdrawal-requests'] });
                  }
                }}
              />
              <Search className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
            <Button 
              variant="default" 
              className="bg-primary hover:bg-primary/90"
              onClick={() => {
                // Reimplementa a busca (refresh)
                if (searchQuery.trim()) {
                  queryClient.invalidateQueries({ queryKey: ['/api/admin/withdrawal-requests'] });
                }
              }}
            >
              Buscar
            </Button>
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
          </div>
        ) : filteredWithdrawals.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredWithdrawals.map((withdrawal) => (
              <Card 
                key={withdrawal.id} 
                className="bg-dark-tertiary border-gray-800 hover:border-gray-700 transition-colors cursor-pointer"
                onClick={() => handleWithdrawalClick(withdrawal)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <CardTitle className="text-lg flex items-center">
                        <span className="mr-2">#{withdrawal.id}</span>
                        {withdrawal.status === 'requested' && (
                          <Clock className="h-4 w-4 text-yellow-400 mr-1" />
                        )}
                        {formatCurrency(withdrawal.amount)}
                      </CardTitle>
                      <CardDescription>
                        {'ID do usuário: ' + withdrawal.userId}
                      </CardDescription>
                    </div>
                    {getStatusBadge(withdrawal.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Banco:</span>
                      <span className="font-medium">{withdrawal.bankName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Proprietário:</span>
                      <span className="font-medium">{withdrawal.ownerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Conta:</span>
                      <span className="font-medium">{withdrawal.bankAccount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Data:</span>
                      <span className="font-medium">{formatDate(withdrawal.createdAt)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <CyberneticBox className="py-12 text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-gray-400 mb-4" />
            <p className="text-gray-400">Nenhuma solicitação de saque encontrada.</p>
          </CyberneticBox>
        )}
      </div>
      
      {/* Withdrawal Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-dark-secondary border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle>Detalhes do Saque</DialogTitle>
            {selectedWithdrawal && (
              <DialogDescription className="text-gray-400">
                ID: {selectedWithdrawal.id} | Valor: {formatCurrency(selectedWithdrawal.amount)}
              </DialogDescription>
            )}
          </DialogHeader>
          
          {selectedWithdrawal && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400">ID do Usuário</p>
                  <p>{selectedWithdrawal.userId}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Valor</p>
                  <p className="font-semibold text-lg">{formatCurrency(selectedWithdrawal.amount)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Status</p>
                  <p>{getStatusBadge(selectedWithdrawal.status)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Data</p>
                  <p>{formatDate(selectedWithdrawal.createdAt)}</p>
                </div>
              </div>
              
              <div className="border-t border-gray-700 pt-4">
                <h3 className="font-medium mb-2">Informações Bancárias</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-400">Banco</p>
                    <p>{selectedWithdrawal.bankName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Proprietário</p>
                    <p>{selectedWithdrawal.ownerName}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-gray-400">Número da Conta</p>
                    <p>{selectedWithdrawal.bankAccount}</p>
                  </div>
                </div>
              </div>
              
              <div className="border-t border-gray-700 pt-4">
                <h3 className="font-medium mb-2">Processamento</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-400">Processado em</p>
                    <p>{selectedWithdrawal.processedAt ? formatDate(selectedWithdrawal.processedAt) : 'Pendente'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">ID do Processador</p>
                    <p>{selectedWithdrawal.processedBy || 'Pendente'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="flex justify-end space-x-2">
            {selectedWithdrawal && selectedWithdrawal.status === 'requested' && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => rejectWithdrawalMutation.mutate()}
                  disabled={rejectWithdrawalMutation.isPending || approveWithdrawalMutation.isPending}
                >
                  {rejectWithdrawalMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <X className="h-4 w-4 mr-2" />
                      Rejeitar Saque
                    </>
                  )}
                </Button>
                <Button
                  variant="default"
                  className="bg-primary hover:bg-primary/90"
                  onClick={() => approveWithdrawalMutation.mutate()}
                  disabled={rejectWithdrawalMutation.isPending || approveWithdrawalMutation.isPending}
                >
                  {approveWithdrawalMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Aprovar Saque
                    </>
                  )}
                </Button>
              </>
            )}
            {selectedWithdrawal && selectedWithdrawal.status !== 'requested' && (
              <Button
                variant="outline"
                onClick={() => setShowDialog(false)}
              >
                Fechar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
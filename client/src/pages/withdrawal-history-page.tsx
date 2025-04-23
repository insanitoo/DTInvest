import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navbar } from '../components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Clock, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';

// Tipo dos itens de saque
interface WithdrawalRequest {
  id: number;
  userId: number;
  amount: number;
  bankName: string;
  bankAccount: string;
  status: 'requested' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export default function WithdrawalHistoryPage() {
  const [, setLocation] = useLocation();
  
  // Carregar histórico de saques do usuário
  const { data: withdrawals, isLoading, error } = useQuery<WithdrawalRequest[]>({
    queryKey: ['/api/withdrawals'],
    retry: 1,
  });
  
  // Formata data para exibição
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-AO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };
  
  // Retorna o ícone apropriado para o status
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'requested':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };
  
  // Retorna o texto e a cor do badge de status
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'requested':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">Em análise</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">Aprovado</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">Rejeitado</Badge>;
      default:
        return <Badge variant="outline">Desconhecido</Badge>;
    }
  };
  
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />
      
      <main className="flex-1 container py-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tight">Histórico de Saques</h1>
          <Button 
            onClick={() => setLocation('/')}
            variant="outline"
          >
            Voltar
          </Button>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center text-center p-6">
                <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                <h3 className="text-lg font-semibold">Erro ao carregar histórico</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Não foi possível carregar seu histórico de saques. Tente novamente mais tarde.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : withdrawals && withdrawals.length > 0 ? (
          <div className="grid gap-4">
            {withdrawals.map(withdrawal => (
              <Card key={withdrawal.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">
                        Saque - {formatCurrency(withdrawal.amount)}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {formatDate(withdrawal.createdAt)}
                      </CardDescription>
                    </div>
                    {getStatusBadge(withdrawal.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Banco:</span>
                      <span className="font-medium">{withdrawal.bankName}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Conta:</span>
                      <span className="font-medium">{withdrawal.bankAccount}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Status:</span>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(withdrawal.status)}
                        <span>
                          {withdrawal.status === 'requested' && 'Em análise'}
                          {withdrawal.status === 'approved' && 'Aprovado'}
                          {withdrawal.status === 'rejected' && 'Rejeitado'}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center text-center p-6">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">Nenhum saque encontrado</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Você ainda não realizou nenhuma solicitação de saque.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
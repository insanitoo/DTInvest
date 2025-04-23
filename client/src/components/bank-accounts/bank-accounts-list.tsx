import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BankAccountDetail } from '@shared/schema';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Building2, ChevronsRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function BankAccountsList() {
  const { data: bankAccounts, isLoading, error } = useQuery<BankAccountDetail[]>({
    queryKey: ['/api/bank-accounts'],
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-3/4" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-300 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-700">Erro ao carregar contas bancárias</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600">
            Ocorreu um erro ao carregar informações das contas bancárias. Por favor, tente novamente mais tarde.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!bankAccounts || bankAccounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Contas Bancárias</CardTitle>
          <CardDescription>Nenhuma conta bancária disponível no momento.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold tracking-tight">Contas Bancárias para Depósito</h2>
      <p className="text-muted-foreground">
        Utilize as seguintes contas bancárias para realizar seus depósitos. 
        Após a transferência, envie o comprovante para prosseguir com seu depósito.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {bankAccounts.map((account) => (
          <Card key={account.id} className="h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center space-x-2">
                {account.bank?.logo ? (
                  <img 
                    src={account.bank.logo} 
                    alt={account.bank.name} 
                    className="h-6 w-auto"
                  />
                ) : (
                  <Building2 className="h-6 w-6 text-primary" />
                )}
                <CardTitle>{account.bank?.name || 'Banco'}</CardTitle>
              </div>
              <CardDescription>Detalhes da conta para transferência</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Titular da Conta</Label>
                  <div className="font-medium mt-1">{account.accountHolder}</div>
                </div>
                
                <div>
                  <Label className="text-sm font-medium">IBAN</Label>
                  <div className="font-medium mt-1 flex items-center">
                    <span className="font-mono">{account.iban}</span>
                    <button 
                      className="ml-2 text-primary hover:text-primary/90 transition-colors"
                      onClick={() => {
                        navigator.clipboard.writeText(account.iban);
                      }}
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { AdminNavigation } from './components/admin-navigation';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest, queryClient } from '@/lib/queryClient';

export default function DebugTransactions() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [transactionId, setTransactionId] = useState('');
  const [response, setResponse] = useState('');

  async function handleCreditTransaction() {
    setIsLoading(true);
    try {
      // Validar ID da transação
      if (!transactionId || transactionId.trim() === '') {
        throw new Error('ID da transação não pode estar vazio');
      }

      // Creditar o valor diretamente na conta
      const requestData = { status: 'completed' };

      console.log('Creditando valor da transação:', {
        transactionId,
        requestData
      });

      const res = await apiRequest('PUT', `/api/admin/transactions/${transactionId}`, requestData);

      try {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          console.log('Resposta da API:', data);
          setResponse(JSON.stringify(data, null, 2));
        } else {
          const text = await res.text();
          console.error('Resposta não-JSON recebida:', text);
          throw new Error('Resposta inválida do servidor');
        }

      // Forçar atualização do cache
      queryClient.invalidateQueries({ queryKey: ['/api/admin/transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });

      toast({
        title: 'Valor creditado',
        description: 'O valor foi creditado na conta do usuário',
        variant: 'default',
      });
    } catch (error) {
      console.error('Erro ao creditar valor:', error);
      setResponse(JSON.stringify({ error: String(error) }, null, 2));

      toast({
        title: 'Erro ao creditar',
        description: String(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen pb-8">
      <AdminNavigation />

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Depuração de Transações</h1>

        <div className="bg-dark-secondary p-6 rounded-lg border border-gray-800">
          <h2 className="text-xl font-bold mb-4">Creditar Valor</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">ID da Transação</label>
              <Input
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="Digite o ID da transação (ex: DEPM9SB...)"
                type="text"
              />
            </div>

            <Button
              onClick={handleCreditTransaction}
              disabled={isLoading}
              variant="default"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creditando...
                </>
              ) : (
                "Creditar Valor"
              )}
            </Button>

            {response && (
              <div>
                <label className="block text-sm font-medium mb-1">Resposta</label>
                <Textarea
                  readOnly
                  value={response}
                  className="h-64 font-mono text-sm"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
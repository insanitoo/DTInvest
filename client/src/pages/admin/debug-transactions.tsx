import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { AdminNavigation } from './components/admin-navigation';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest, queryClient } from '@/lib/queryClient';

export default function DebugTransactions() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [transactionId, setTransactionId] = useState('');
  const [status, setStatus] = useState('pending');
  const [response, setResponse] = useState('');
  const [diagnosticStatus, setDiagnosticStatus] = useState('');
  const [diagnosticResponse, setDiagnosticResponse] = useState('');

  async function handleValidateStatus() {
    setIsLoading(true);
    try {
      const res = await apiRequest('POST', '/api/test/validate-status', { status: diagnosticStatus });
      const data = await res.json();
      setDiagnosticResponse(JSON.stringify(data, null, 2));
      
      toast({
        title: 'Teste concluído',
        description: data.success ? 'Status válido!' : 'Status inválido',
        variant: data.success ? 'default' : 'destructive',
      });
    } catch (error) {
      console.error('Erro ao testar status:', error);
      setDiagnosticResponse(JSON.stringify({ error: String(error) }, null, 2));
      
      toast({
        title: 'Erro no teste',
        description: String(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdateTransaction() {
    setIsLoading(true);
    try {
      // Validar ID da transação
      if (!transactionId || isNaN(Number(transactionId))) {
        throw new Error('ID da transação inválido');
      }

      // Log para debug
      console.log('Enviando atualização:', {
        transactionId,
        status,
        body: JSON.stringify({ status })
      });

      const res = await apiRequest('PUT', `/api/admin/transactions/${transactionId}`, { status });
      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
      
      // Forçar atualização do cache
      try {
        console.log('Forçando atualização do cache...');
        
        // Invalidar cache das transações do admin e do usuário
        queryClient.invalidateQueries({ queryKey: ['/api/admin/transactions'] });
        queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
        
        // Também atualizar manualmente os caches existentes
        const adminTransactions = queryClient.getQueryData<any[]>(['/api/admin/transactions']);
        if (adminTransactions) {
          const updatedAdminTransactions = adminTransactions.map(tx => 
            tx.id === Number(transactionId) ? { ...tx, status } : tx
          );
          queryClient.setQueryData(['/api/admin/transactions'], updatedAdminTransactions);
          console.log('Cache de admin atualizado:', updatedAdminTransactions);
        }
        
        const userTransactions = queryClient.getQueryData<any[]>(['/api/transactions']);
        if (userTransactions) {
          const updatedUserTransactions = userTransactions.map(tx => 
            tx.id === Number(transactionId) ? { ...tx, status } : tx
          );
          queryClient.setQueryData(['/api/transactions'], updatedUserTransactions);
          console.log('Cache do usuário atualizado:', updatedUserTransactions);
        }
      } catch (cacheError) {
        console.error('Erro ao atualizar cache:', cacheError);
      }
      
      toast({
        title: 'Atualização realizada',
        description: 'Status atualizado e cache forçado a atualizar',
        variant: 'default',
      });
    } catch (error) {
      console.error('Erro ao atualizar transação:', error);
      setResponse(JSON.stringify({ error: String(error) }, null, 2));
      
      toast({
        title: 'Erro na atualização',
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-dark-secondary p-6 rounded-lg border border-gray-800">
            <h2 className="text-xl font-bold mb-4">Testar Validação de Status</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Status para validar</label>
                <Input
                  value={diagnosticStatus}
                  onChange={(e) => setDiagnosticStatus(e.target.value)}
                  placeholder="Digite um status (ex: pending, completed, etc)"
                />
              </div>
              
              <Button
                onClick={handleValidateStatus}
                disabled={isLoading}
                variant="default"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Testando...
                  </>
                ) : (
                  "Testar Status"
                )}
              </Button>
              
              {diagnosticResponse && (
                <div>
                  <label className="block text-sm font-medium mb-1">Resposta</label>
                  <Textarea
                    readOnly
                    value={diagnosticResponse}
                    className="h-64 font-mono text-sm"
                  />
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-dark-secondary p-6 rounded-lg border border-gray-800">
            <h2 className="text-xl font-bold mb-4">Atualizar Transação</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">ID da Transação</label>
                <Input
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="Digite o ID numérico"
                  type="number"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <Select
                  value={status}
                  onValueChange={setStatus}
                >
                  <SelectTrigger className="bg-dark-tertiary border-gray-700">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent className="bg-dark-tertiary border-gray-700">
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="processing">Processando</SelectItem>
                    <SelectItem value="completed">Concluído</SelectItem>
                    <SelectItem value="failed">Falhou</SelectItem>
                    <SelectItem value="approved">Aprovado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Button
                onClick={handleUpdateTransaction}
                disabled={isLoading}
                variant="default"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Atualizando...
                  </>
                ) : (
                  "Atualizar Transação"
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
    </div>
  );
}
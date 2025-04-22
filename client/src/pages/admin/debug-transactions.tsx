
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, AlertCircle, AlertTriangle } from 'lucide-react';
import { AdminNavigation } from './components/admin-navigation';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Badge } from '@/components/ui/badge';
import { 
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function DebugTransactions() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [emergencyLoading, setEmergencyLoading] = useState(false);
  const [transactionId, setTransactionId] = useState('');
  const [emergencyTransactionId, setEmergencyTransactionId] = useState('');
  const [response, setResponse] = useState('');
  const [emergencyResponse, setEmergencyResponse] = useState('');

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

      const contentType = res.headers.get('content-type');
      const responseText = await res.text();

      if (!res.ok) {
        throw new Error(`Erro na requisição: ${res.status} - ${responseText}`);
      }

      try {
        const data = contentType?.includes('application/json') 
          ? JSON.parse(responseText)
          : { message: responseText };
        
        console.log('Resposta da API:', data);
        setResponse(JSON.stringify(data, null, 2));
      } catch (error) {
        throw new Error(`Erro ao processar resposta: ${responseText}`);
      }

      // Forçar atualização do cache
      queryClient.invalidateQueries({ queryKey: ['/api/admin/transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });

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
  
  // FUNÇÃO DE EMERGÊNCIA PARA CREDITAR
  async function handleEmergencyCredit() {
    setEmergencyLoading(true);
    try {
      // Validar ID da transação
      if (!emergencyTransactionId || emergencyTransactionId.trim() === '') {
        throw new Error('ID da transação não pode estar vazio');
      }

      // Creditar usando a rota de emergência
      console.log('EMERGÊNCIA: Creditando valor da transação:', {
        transactionId: emergencyTransactionId
      });

      const res = await apiRequest('POST', `/api/admin/creditar-deposito`, { 
        transactionId: emergencyTransactionId 
      });

      const responseData = await res.json();
      
      if (!res.ok) {
        throw new Error(`Erro na requisição: ${res.status} - ${JSON.stringify(responseData)}`);
      }
      
      console.log('Resposta da API de emergência:', responseData);
      setEmergencyResponse(JSON.stringify(responseData, null, 2));

      // Forçar atualização do cache
      queryClient.invalidateQueries({ queryKey: ['/api/admin/transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/deposits'] });

      toast({
        title: 'EMERGÊNCIA - Valor creditado',
        description: `Valor de KZ ${responseData.data?.transaction?.amount || '?'} creditado para ${responseData.data?.user?.phoneNumber || 'usuário'}`,
        variant: 'default',
      });
    } catch (error) {
      console.error('Erro no crédito de emergência:', error);
      setEmergencyResponse(JSON.stringify({ error: String(error) }, null, 2));

      toast({
        title: 'Erro no crédito de emergência',
        description: String(error),
        variant: 'destructive',
      });
    } finally {
      setEmergencyLoading(false);
    }
  }

  return (
    <div className="min-h-screen pb-8">
      <AdminNavigation />

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Depuração de Transações</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* MÉTODO NORMAL */}
          <Card>
            <CardHeader>
              <CardTitle>Método Normal</CardTitle>
              <CardDescription>
                Atualiza o status de uma transação existente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creditando via Método Normal...
                  </>
                ) : (
                  "Creditar (Método Normal)"
                )}
              </Button>

              {response && (
                <div>
                  <label className="block text-sm font-medium mb-1">Resposta</label>
                  <Textarea
                    readOnly
                    value={response}
                    className="h-40 font-mono text-sm"
                  />
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* MÉTODO DE EMERGÊNCIA */}
          <Card className="border-red-600 dark:border-red-600">
            <CardHeader className="bg-red-950/30">
              <div className="flex justify-between items-center">
                <CardTitle className="text-red-400">MODO DE EMERGÊNCIA</CardTitle>
                <Badge variant="destructive">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Crítico
                </Badge>
              </div>
              <CardDescription>
                Bypass direto para aprovação de depósitos com problemas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Cuidado!</AlertTitle>
                <AlertDescription>
                  Este método força o crédito de depósito independente do status atual.
                  Use apenas quando o método normal falhar.
                </AlertDescription>
              </Alert>
              
              <div>
                <label className="block text-sm font-medium mb-1">ID da Transação</label>
                <Input
                  value={emergencyTransactionId}
                  onChange={(e) => setEmergencyTransactionId(e.target.value)}
                  placeholder="Digite o ID da transação (ex: DEPM9SB...)"
                  type="text"
                  className="border-red-800 focus:ring-red-600"
                />
              </div>

              <Button
                onClick={handleEmergencyCredit}
                disabled={emergencyLoading}
                variant="destructive"
                className="w-full"
              >
                {emergencyLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processando Crédito de Emergência...
                  </>
                ) : (
                  "CREDITAR (EMERGÊNCIA)"
                )}
              </Button>

              {emergencyResponse && (
                <div>
                  <label className="block text-sm font-medium mb-1">Resposta (Emergência)</label>
                  <Textarea
                    readOnly
                    value={emergencyResponse}
                    className="h-40 font-mono text-sm"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

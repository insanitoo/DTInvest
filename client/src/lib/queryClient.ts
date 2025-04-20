import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    try {
      const text = (await res.text()) || res.statusText;
      throw new Error(`${res.status}: ${text}`);
    } catch (e) {
      // Se não conseguirmos ler o texto, apenas use o status
      throw new Error(`${res.status}: ${res.statusText}`);
    }
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: HeadersInit = data 
    ? { "Content-Type": "application/json" } 
    : {};
  
  // Add cache control headers to prevent caching issues with authentication
  if (url === '/api/login' || url === '/api/register' || url === '/api/logout' || url === '/api/user') {
    Object.assign(headers, {
      'Cache-Control': 'no-cache, no-store',
      'Pragma': 'no-cache'
    });
  }
  
  // Tratamento especial para atualização de transações
  if (url.startsWith('/api/admin/transactions/') && method === 'PUT') {
    // Garantir formatação correta para o schema de validação
    if (data && typeof data === 'object' && 'status' in data) {
      const status = (data as any).status;
      
      // Verificar se é um status válido 
      const validStatuses = ['pending', 'processing', 'completed', 'failed', 'approved'];
      if (!validStatuses.includes(status)) {
        throw new Error(`Status inválido: '${status}'. Use um dos valores: ${validStatuses.join(', ')}`);
      }
      
      // Sobrescrever data para garantir que é apenas { status: "valor" }
      // Isso evita que outros campos causem erros de validação
      data = { status };
      console.log('Requisição sanitizada para atualização de transação:', data);
      
      // Adicionar headers especiais para essa requisição específica
      Object.assign(headers, {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache'
      });
    }
  }
  
  // Tratamento seguro para JSON
  let body: string | undefined;
  if (data) {
    try {
      body = JSON.stringify(data);
      console.log(`Enviando requisição ${method} para ${url}, corpo:`, body);
    } catch (jsonError) {
      console.error('Erro ao converter dados para JSON:', jsonError);
      throw new Error(`Erro ao formatar dados da requisição: ${jsonError}`);
    }
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey[0] as string;
    const headers: HeadersInit = {};
    
    // Add cache control headers to prevent caching issues with authentication requests
    if (url === '/api/user') {
      Object.assign(headers, {
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache'
      });
    }
    
    const res = await fetch(url, {
      credentials: "include",
      headers,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      console.log(`Auth check failed for ${url} with 401, returning null as expected`);
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

// Utilitário para forçar atualização de transações
export async function forceTransactionUpdate(transactionId: number, newStatus: string) {
  console.log(`ForceUpdate: Atualizando transação ${transactionId} para status ${newStatus}`);
  
  // 1. Atualizar transação na cache do administrador
  const adminTransactions = queryClient.getQueryData<any[]>(['/api/admin/transactions']);
  if (adminTransactions) {
    const updatedAdminTransactions = adminTransactions.map(tx => 
      tx.id === transactionId ? { ...tx, status: newStatus } : tx
    );
    queryClient.setQueryData(['/api/admin/transactions'], updatedAdminTransactions);
    console.log('ForceUpdate: Cache de transações admin atualizado');
  }
  
  // 2. Atualizar transação na cache do usuário
  const userTransactions = queryClient.getQueryData<any[]>(['/api/transactions']);
  if (userTransactions) {
    const updatedUserTransactions = userTransactions.map(tx => 
      tx.id === transactionId ? { ...tx, status: newStatus } : tx
    );
    queryClient.setQueryData(['/api/transactions'], updatedUserTransactions);
    console.log('ForceUpdate: Cache de transações do usuário atualizado');
  }
  
  // 3. Invalidar e recarregar todos os dados
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['/api/admin/transactions'] }),
    queryClient.invalidateQueries({ queryKey: ['/api/transactions'] }),
    queryClient.invalidateQueries({ queryKey: ['/api/user'] })
  ]);
  
  console.log('ForceUpdate: Todas as queries invalidadas');
  
  // 4. Forçar refetch imediato
  await Promise.all([
    queryClient.refetchQueries({ queryKey: ['/api/admin/transactions'] }),
    queryClient.refetchQueries({ queryKey: ['/api/transactions'] }),
    queryClient.refetchQueries({ queryKey: ['/api/user'] })
  ]);
  
  console.log('ForceUpdate: Refetch completo');
  return true;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: 10000, // Revalidar a cada 10 segundos
      refetchOnWindowFocus: true, // Revalidar quando o usuário voltar à janela
      staleTime: 3000, // Considerar dados obsoletos após 3 segundos
      retry: 1, // Uma tentativa adicional em caso de falha
      gcTime: 5 * 60 * 1000 // 5 minutos de cache (era cacheTime no React Query v4)
    },
    mutations: {
      retry: 1, // Uma tentativa adicional em caso de falha
    },
  },
});

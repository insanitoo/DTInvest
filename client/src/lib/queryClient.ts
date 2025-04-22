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
  
  // Para APIs especiais, adicionar headers
  if (url.startsWith('/api/admin/deposit-requests/') || 
      url.startsWith('/api/admin/withdrawal-requests/') ||
      url.startsWith('/api/admin/transactions/') ||  // ADICIONADO: transactions também precisa desse header
      url.startsWith('/api/deposits') ||
      url.startsWith('/api/withdrawals')) {
    
    // Adicionar headers especiais para essas requisições específicas
    Object.assign(headers, {
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'Cache-Control': 'no-cache, no-store',
      'Pragma': 'no-cache'
    });
    
    console.log(`Requisição para ${url}`, method, data);
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

// Utilitário para forçar atualização de todos os dados
export async function refreshAllData() {
  console.log('Atualizando todos os dados após operação...');
  
  // Invalidar e recarregar todos os dados
  await Promise.all([
    // Dados gerais
    queryClient.invalidateQueries({ queryKey: ['/api/transactions'] }),
    queryClient.invalidateQueries({ queryKey: ['/api/user'] }),
    
    // Solicitações de depósito e saque
    queryClient.invalidateQueries({ queryKey: ['/api/deposits'] }),
    queryClient.invalidateQueries({ queryKey: ['/api/withdrawals'] }),
    
    // Admin: transações e solicitações
    queryClient.invalidateQueries({ queryKey: ['/api/admin/transactions'] }),
    queryClient.invalidateQueries({ queryKey: ['/api/admin/deposit-requests'] }),
    queryClient.invalidateQueries({ queryKey: ['/api/admin/withdrawal-requests'] })
  ]);
  
  console.log('Cache invalidada, recarregando dados...');
  
  // Forçar refetch imediato
  await Promise.all([
    // Dados gerais
    queryClient.refetchQueries({ queryKey: ['/api/transactions'] }),
    queryClient.refetchQueries({ queryKey: ['/api/user'] }),
    
    // Solicitações de depósito e saque
    queryClient.refetchQueries({ queryKey: ['/api/deposits'] }),
    queryClient.refetchQueries({ queryKey: ['/api/withdrawals'] }),
    
    // Admin: transações e solicitações
    queryClient.refetchQueries({ queryKey: ['/api/admin/transactions'] }),
    queryClient.refetchQueries({ queryKey: ['/api/admin/deposit-requests'] }),
    queryClient.refetchQueries({ queryKey: ['/api/admin/withdrawal-requests'] })
  ]);
  
  console.log('Todos os dados atualizados com sucesso');
  return true;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false, // Desabilitar refetch automático para economizar recursos
      refetchOnWindowFocus: false, // Desabilitar refetch ao focar na janela para economizar recursos
      staleTime: 30000, // Aumentar para 30 segundos para reduzir consultas
      retry: 0, // Não fazer novas tentativas para economizar recursos
      gcTime: 5 * 60 * 1000 // 5 minutos de cache (era cacheTime no React Query v4)
    },
    mutations: {
      retry: 0, // Não fazer novas tentativas para economizar recursos
    },
  },
});

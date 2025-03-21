import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  console.log(`Fazendo requisição ${method} para ${url}`, data);
  
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  console.log(`Resposta da requisição ${method} para ${url}:`, {
    status: res.status,
    statusText: res.statusText,
    headers: Object.fromEntries([...res.headers.entries()]),
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
    console.log(`Fazendo consulta para ${queryKey[0]}`);
    
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    console.log(`Resposta da consulta para ${queryKey[0]}:`, {
      status: res.status,
      statusText: res.statusText,
      headers: Object.fromEntries([...res.headers.entries()]),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      console.log(`Retornando null para requisição ${queryKey[0]} devido ao status 401`);
      return null;
    }

    await throwIfResNotOk(res);
    const data = await res.json();
    console.log(`Dados recebidos de ${queryKey[0]}:`, data);
    return data;
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

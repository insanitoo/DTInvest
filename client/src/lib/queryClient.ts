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
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
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

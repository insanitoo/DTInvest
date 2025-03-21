import { createContext, ReactNode, useContext, useState, useEffect } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { User, LoginData, RegistrationData } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

// Definição do tipo do contexto
type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<User, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<User, Error, RegistrationData>;
};

// Criação do contexto com um valor padrão para evitar casos null
const AuthContext = createContext<AuthContextType | null>(null);

// Chave para armazenar o usuário autenticado no localStorage
const AUTH_USER_KEY = 'sp_global_auth_user';

// Hook para usar o contexto de autenticação
function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Provider de autenticação
function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  // Estado local para armazenar o usuário atual
  const [localUser, setLocalUser] = useState<User | null>(() => {
    // Tenta recuperar o usuário do localStorage quando o componente é montado
    try {
      const saved = localStorage.getItem(AUTH_USER_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.error('Erro ao recuperar usuário do localStorage:', error);
      return null;
    }
  });
  
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<User | null, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    initialData: localUser,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      const userData = await res.json();
      
      // Forçar uma segunda chamada para /api/user para garantir que a sessão esteja ativa
      console.log("Forçando chamada para /api/user após login bem-sucedido...");
      try {
        await fetch("/api/user", { credentials: "include" });
      } catch (error) {
        console.error("Erro ao verificar sessão após login:", error);
      }
      
      return userData;
    },
    onSuccess: (user: User) => {
      console.log("Login bem-sucedido, salvando dados do usuário no cache...");
      // Salvando no localStorage
      try {
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
        console.log("Usuário salvo no localStorage");
      } catch (error) {
        console.error("Erro ao salvar usuário no localStorage:", error);
      }
      
      // Atualiza o estado local
      setLocalUser(user);
      
      // Atualiza a cache do React Query
      queryClient.setQueryData(["/api/user"], user);
      
      // Força a refetch da query para atualizar o estado global
      queryClient.invalidateQueries({queryKey: ["/api/user"]});
      
      // Redirect to home page after successful login
      setLocation("/");
      
      toast({
        title: "Login bem-sucedido",
        description: "Bem-vindo de volta!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Falha no login",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: RegistrationData) => {
      const res = await apiRequest("POST", "/api/register", credentials);
      const userData = await res.json();
      
      // Forçar uma segunda chamada para /api/user para garantir que a sessão esteja ativa
      console.log("Forçando chamada para /api/user após registro bem-sucedido...");
      try {
        await fetch("/api/user", { credentials: "include" });
      } catch (error) {
        console.error("Erro ao verificar sessão após registro:", error);
      }
      
      return userData;
    },
    onSuccess: (user: User) => {
      console.log("Registro bem-sucedido, salvando dados do usuário no cache...");
      // Salvando no localStorage
      try {
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
        console.log("Usuário salvo no localStorage após registro");
      } catch (error) {
        console.error("Erro ao salvar usuário no localStorage:", error);
      }
      
      // Atualiza o estado local
      setLocalUser(user);
      
      // Atualiza a cache do React Query
      queryClient.setQueryData(["/api/user"], user);
      
      // Força a refetch da query para atualizar o estado global
      queryClient.invalidateQueries({queryKey: ["/api/user"]});
      
      // Redirect to home page after successful registration
      setLocation("/");
      
      toast({
        title: "Registro bem-sucedido",
        description: "Sua conta foi criada!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Falha no registro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      // Removendo do localStorage
      try {
        localStorage.removeItem(AUTH_USER_KEY);
        console.log("Usuário removido do localStorage");
      } catch (error) {
        console.error("Erro ao remover usuário do localStorage:", error);
      }
      
      // Atualiza o estado local
      setLocalUser(null);
      
      // Atualiza a cache do React Query
      queryClient.setQueryData(["/api/user"], null);
      
      // Redirect to auth page after logout
      setLocation("/auth");
      
      toast({
        title: "Logout bem-sucedido",
        description: "Você foi desconectado.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Falha no logout",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Exportações nomeadas
export { AuthContext, AuthProvider, useAuth };

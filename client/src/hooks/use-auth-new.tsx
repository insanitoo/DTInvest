import { createContext, ReactNode, useContext, useState, useEffect, useCallback } from "react";
import { useMutation, UseMutationResult } from "@tanstack/react-query";
import { User, LoginData, RegistrationData } from "@shared/schema";
import { apiRequest } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

// Context type definition
type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  checkAuth: () => Promise<User | null>;
  loginMutation: UseMutationResult<User, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<User, Error, RegistrationData>;
};

// Creating context with a default value to avoid null cases
const AuthContext = createContext<AuthContextType | null>(null);

// Key for storing the authenticated user in localStorage
const AUTH_USER_KEY = 'sp_global_auth_user';

// Auth provider component - otimizado para menos consultas
function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Local state to store the current user
  const [user, setUser] = useState<User | null>(() => {
    // Try to recover user from localStorage when component mounts
    try {
      const saved = localStorage.getItem(AUTH_USER_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.error('Error recovering user from localStorage:', error);
      return null;
    }
  });

  // Função manual para verificar autenticação - otimizada para chamadas sob demanda apenas
  const checkAuth = useCallback(async (): Promise<User | null> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const res = await fetch('/api/user', { 
        credentials: 'include', // Certificar que os cookies sejam enviados
        headers: {
          'Cache-Control': 'no-cache, no-store',
          'Pragma': 'no-cache'
        }
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          // Limpar dados de usuário em caso de sessão inválida
          localStorage.removeItem(AUTH_USER_KEY);
          setUser(null);
          return null;
        }
        
        const errorText = await res.text();
        throw new Error(`Erro ao verificar autenticação: ${res.status} - ${errorText}`);
      }
      
      const userData = await res.json();
      
      // Armazenar no localStorage e state
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData));
      setUser(userData);
      
      return userData;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Verificar auth na inicialização (uma única vez)
  useEffect(() => {
    checkAuth();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData): Promise<User> => {
      try {
        setIsLoading(true);
        
        // First login call to get the session cookie
        const res = await apiRequest("POST", "/api/login", credentials);
        const userData = await res.json();

        // Atualiza o estado com o usuário
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData));
        setUser(userData);
        
        return userData;
      } finally {
        setIsLoading(false);
      }
    },
    onSuccess: (user: User) => {
      // Redirect to home page with a slight delay to ensure state is updated
      setTimeout(() => {
        setLocation("/");

        toast({
          title: "Login bem-sucedido",
          description: "Bem-vindo de volta!",
        });
      }, 100);
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
    mutationFn: async (credentials: RegistrationData): Promise<User> => {
      try {
        setIsLoading(true);
        
        // Register call to create user and establish session
        const res = await apiRequest("POST", "/api/register", credentials);
        const userData = await res.json();

        // Atualiza o estado com o usuário
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData));
        setUser(userData);
        
        return userData;
      } finally {
        setIsLoading(false);
      }
    },
    onSuccess: (user: User) => {
      // Redirect to home page with a slight delay to ensure state is updated
      setTimeout(() => {
        setLocation("/");

        toast({
          title: "Registro bem-sucedido",
          description: "Sua conta foi criada!",
        });
      }, 100);
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
      try {
        setIsLoading(true);
        await apiRequest("POST", "/api/logout");
      } finally {
        setIsLoading(false);
      }
    },
    onSuccess: () => {
      // Remove from localStorage
      localStorage.removeItem(AUTH_USER_KEY);
      
      // Update local state
      setUser(null);

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
        user,
        isLoading,
        error,
        checkAuth,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Hook para usar o contexto de autenticação
function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export { AuthContext, AuthProvider, useAuth };
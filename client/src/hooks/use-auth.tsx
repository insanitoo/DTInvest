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

// Context type definition
type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<User, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<User, Error, RegistrationData>;
};

// Creating context with a default value to avoid null cases
const AuthContext = createContext<AuthContextType | null>(null);

// Key for storing the authenticated user in localStorage
const AUTH_USER_KEY = 'sp_global_auth_user';

// Hook to use the auth context
function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Auth provider component
function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  // Local state to store the current user
  const [localUser, setLocalUser] = useState<User | null>(() => {
    // Try to recover user from localStorage when component mounts
    try {
      const saved = localStorage.getItem(AUTH_USER_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.error('Error recovering user from localStorage:', error);
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
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    onError: (error) => {
      // If we get a 401, clear the user from local storage
      if (error.message.includes('401')) {
        localStorage.removeItem(AUTH_USER_KEY);
        setLocalUser(null);
      }
    },
  });

  // Update local user when query data changes
  useEffect(() => {
    if (user) {
      try {
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
      } catch (error) {
        console.error('Error saving user to localStorage:', error);
      }
      setLocalUser(user);
    }
  }, [user]);

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      // First login call to get the session cookie
      const res = await apiRequest("POST", "/api/login", credentials);
      const userData = await res.json();
      
      // Immediately verify the session with explicit credentials option
      console.log("Forcing call to /api/user after successful login...");
      try {
        const userCheckRes = await fetch("/api/user", { 
          credentials: "include",
          headers: {
            'Cache-Control': 'no-cache, no-store',
            'Pragma': 'no-cache'
          }
        });
        
        if (!userCheckRes.ok) {
          console.error("Session verification failed with status:", userCheckRes.status);
          throw new Error("A sessão não pôde ser estabelecida. Tente novamente.");
        }
      } catch (error) {
        console.error("Error verifying session after login:", error);
        throw new Error("Erro ao verificar a sessão após o login.");
      }
      
      return userData;
    },
    onSuccess: (user: User) => {
      console.log("Login successful, saving user data to cache...");
      // Save to localStorage
      try {
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
        console.log("User saved to localStorage");
      } catch (error) {
        console.error("Error saving user to localStorage:", error);
      }
      
      // Update local state immediately
      setLocalUser(user);
      
      // Update React Query cache
      queryClient.setQueryData(["/api/user"], user);
      
      // No need to invalidate immediately since we're already setting the data
      // This causes an unnecessary refetch
      // queryClient.invalidateQueries({queryKey: ["/api/user"]});
      
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
    mutationFn: async (credentials: RegistrationData) => {
      // First register call to create the user and get session cookie
      const res = await apiRequest("POST", "/api/register", credentials);
      const userData = await res.json();
      
      // Immediately verify the session with explicit credentials option
      console.log("Forcing call to /api/user after successful registration...");
      try {
        const userCheckRes = await fetch("/api/user", { 
          credentials: "include",
          headers: {
            'Cache-Control': 'no-cache, no-store',
            'Pragma': 'no-cache'
          }
        });
        
        if (!userCheckRes.ok) {
          console.error("Session verification failed after registration with status:", userCheckRes.status);
          throw new Error("A sessão não pôde ser estabelecida após o registro. Tente fazer login.");
        }
      } catch (error) {
        console.error("Error verifying session after registration:", error);
        throw new Error("Erro ao verificar a sessão após o registro.");
      }
      
      return userData;
    },
    onSuccess: (user: User) => {
      console.log("Registration successful, saving user data to cache...");
      // Save to localStorage
      try {
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
        console.log("User saved to localStorage after registration");
      } catch (error) {
        console.error("Error saving user to localStorage:", error);
      }
      
      // Update local state immediately
      setLocalUser(user);
      
      // Update React Query cache
      queryClient.setQueryData(["/api/user"], user);
      
      // No need to invalidate immediately since we're already setting the data
      // This causes an unnecessary refetch
      // queryClient.invalidateQueries({queryKey: ["/api/user"]});
      
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
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      // Remove from localStorage
      try {
        localStorage.removeItem(AUTH_USER_KEY);
        console.log("User removed from localStorage");
      } catch (error) {
        console.error("Error removing user from localStorage:", error);
      }
      
      // Update local state
      setLocalUser(null);
      
      // Update React Query cache
      queryClient.setQueryData(["/api/user"], null);
      queryClient.invalidateQueries({queryKey: ["/api/user"]});
      
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

// Named exports
export { AuthContext, AuthProvider, useAuth };

import React, { ReactNode, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth-new";
import { Loader2, AlertCircle } from "lucide-react";
import { Route, useLocation } from "wouter";

interface AdminRouteProps {
  path: string;
  component?: () => React.JSX.Element;
  children?: ReactNode;
}

export function AdminRoute({
  path,
  component: Component,
  children,
}: AdminRouteProps) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  
  // Use this effect for redirection to avoid re-renders and race conditions
  useEffect(() => {
    if (!isLoading) {
      // Verificar se o usuário está autenticado
      if (!user) {
        console.log("Admin route: User not authenticated, redirecting to /auth");
        setTimeout(() => {
          setLocation("/auth");
        }, 50);
        return;
      }
      
      // Verificar se o usuário é admin
      if (!user.isAdmin) {
        console.log("Admin route: User is not admin, redirecting to /");
        setTimeout(() => {
          setLocation("/");
        }, 50);
        return;
      }
    }
  }, [user, isLoading, setLocation]);

  // Loading spinner component
  const LoadingSpinner = () => (
    <div className="flex items-center justify-center min-h-screen bg-[#121212]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
  
  // Unauthorized component
  const Unauthorized = () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#121212] px-4">
      <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
      <h1 className="text-2xl font-bold text-white mb-2">Acesso Negado</h1>
      <p className="text-gray-400 text-center mb-6">Você não tem permissão para acessar esta área.</p>
      <button 
        onClick={() => setLocation("/")}
        className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
      >
        Voltar à Página Inicial
      </button>
    </div>
  );

  return (
    <Route path={path}>
      {() => {
        // Show loading state while checking authentication
        if (isLoading) {
          return <LoadingSpinner />;
        }

        // Verificar se o usuário está autenticado
        if (!user) {
          return <LoadingSpinner />;
        }
        
        // Verificar se o usuário é admin
        if (!user.isAdmin) {
          return <Unauthorized />;
        }

        // User is authenticated and is admin, render the protected component or children
        if (Component) {
          return <Component />;
        }
        
        return <>{children}</>;
      }}
    </Route>
  );
}
import React, { ReactNode, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth-new";
import { Loader2 } from "lucide-react";
import { Route, useLocation } from "wouter";

interface ProtectedRouteProps {
  path: string;
  component?: () => React.JSX.Element;
  children?: ReactNode;
}

export function ProtectedRoute({
  path,
  component: Component,
  children,
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  
  // Use this effect for redirection to avoid re-renders and race conditions
  useEffect(() => {
    if (!isLoading && !user) {
      console.log("Protected route: User not authenticated, redirecting to /auth");
      // Add a small delay to ensure clean navigation
      setTimeout(() => {
        setLocation("/auth");
      }, 50);
    }
  }, [user, isLoading, setLocation]);

  // Loading spinner component
  const LoadingSpinner = () => (
    <div className="flex items-center justify-center min-h-screen bg-[#121212]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <Route path={path}>
      {() => {
        // Show loading state while checking authentication
        if (isLoading) {
          return <LoadingSpinner />;
        }

        // Don't render anything while redirect is happening
        if (!user) {
          return <LoadingSpinner />;
        }

        // User is authenticated, render the protected component or children
        if (Component) {
          return <Component />;
        }
        
        return <>{children}</>;
      }}
    </Route>
  );
}

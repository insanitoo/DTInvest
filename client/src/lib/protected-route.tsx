import React, { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth-new";
import { Loader2 } from "lucide-react";
import { Route, useLocation } from "wouter";

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
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

  return (
    <Route path={path}>
      {() => {
        // Show loading state while checking authentication
        if (isLoading) {
          return (
            <div className="flex items-center justify-center min-h-screen bg-[#121212]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          );
        }

        // Don't render anything while redirect is happening
        if (!user) {
          return (
            <div className="flex items-center justify-center min-h-screen bg-[#121212]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          );
        }

        // User is authenticated, render the protected component
        return <Component />;
      }}
    </Route>
  );
}

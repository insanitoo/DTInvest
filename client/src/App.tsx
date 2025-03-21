import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import { AuthProvider } from "./hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";
import HomePage from "@/pages/home-page";
import UserPage from "@/pages/user-page";
import AuthPage from "@/pages/auth-page";
import ServicePage from "@/pages/service-page";
import ProductsPage from "@/pages/products-page";
import TeamPage from "@/pages/team-page";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={HomePage} />
      <ProtectedRoute path="/user" component={UserPage} />
      <ProtectedRoute path="/service" component={ServicePage} />
      <ProtectedRoute path="/products" component={ProductsPage} />
      <ProtectedRoute path="/team" component={TeamPage} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

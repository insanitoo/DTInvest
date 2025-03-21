import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { ProtectedRoute } from "./lib/protected-route";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import HomePage from "@/pages/home-page";
import ProductsPage from "@/pages/products-page";
import TeamPage from "@/pages/team-page";
import UserPage from "@/pages/user-page";
import AdminDashboard from "@/pages/admin/admin-dashboard";
import AdminTransactions from "@/pages/admin/admin-transactions";
import AdminUsers from "@/pages/admin/admin-users";
import AdminProducts from "@/pages/admin/admin-products";
import AdminSettings from "@/pages/admin/admin-settings";
import { AuthProvider } from "./hooks/use-auth";

function Routes() {
  return (
    <Switch>
      {/* Public route */}
      <Route path="/auth" component={AuthPage} />
      <Route path="/riqueza" component={AuthPage} />
      
      {/* Protected routes */}
      <ProtectedRoute path="/" component={HomePage} />
      <ProtectedRoute path="/produtos" component={ProductsPage} />
      <ProtectedRoute path="/equipa" component={TeamPage} />
      <ProtectedRoute path="/usuario" component={UserPage} />
      
      {/* Admin routes with admin check inside protected route */}
      <ProtectedRoute path="/admin" component={AdminDashboard} adminOnly />
      <ProtectedRoute path="/admin/transacoes" component={AdminTransactions} adminOnly />
      <ProtectedRoute path="/admin/usuarios" component={AdminUsers} adminOnly />
      <ProtectedRoute path="/admin/produtos" component={AdminProducts} adminOnly />
      <ProtectedRoute path="/admin/configuracoes" component={AdminSettings} adminOnly />
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-dark-900 text-white relative overflow-x-hidden">
        <div className="circuit-pattern absolute inset-0 z-0"></div>
        <div className="relative z-10">
          <Routes />
        </div>
      </div>
      <Toaster />
    </AuthProvider>
  );
}

export default App;

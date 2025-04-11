
import { Route, Switch } from 'wouter';
import { Toaster } from '@/components/ui/toaster';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { ProtectedRoute } from '@/lib/protected-route';
import { AuthProvider } from '@/hooks/use-auth';

// Pages
import HomePage from '@/pages/home-page';
import AuthPage from '@/pages/auth-page';
import ProductsPage from '@/pages/products-page';
import TeamPage from '@/pages/team-page';
import ServicePage from '@/pages/service-page';
import UserPage from '@/pages/user-page';
import NotFound from '@/pages/not-found';

// Admin Pages
import AdminDashboard from '@/pages/admin/admin-dashboard';
import AdminUsers from '@/pages/admin/admin-users';
import AdminProducts from '@/pages/admin/admin-products';
import AdminTransactions from '@/pages/admin/admin-transactions';
import AdminSettings from '@/pages/admin/admin-settings';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Switch>
          <Route path="/auth" component={AuthPage} />
          
          <Route path="/" component={HomePage} />
          <Route path="/products" component={ProductsPage} />
          <Route path="/team" component={TeamPage} />
          <Route path="/servico" component={ServicePage} />
          
          <ProtectedRoute path="/user" component={UserPage} />
          
          {/* Rotas Admin */}
          <ProtectedRoute path="/admin" component={AdminDashboard} />
          <ProtectedRoute path="/admin/usuarios" component={AdminUsers} />
          <ProtectedRoute path="/admin/produtos" component={AdminProducts} />
          <ProtectedRoute path="/admin/transacoes" component={AdminTransactions} />
          <ProtectedRoute path="/admin/configuracoes" component={AdminSettings} />
          
          <Route component={NotFound} />
        </Switch>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

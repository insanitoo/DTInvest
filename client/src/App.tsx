
import { lazy, Suspense } from 'react';
import { Route, Switch } from 'wouter';
import { Toaster } from '@/components/ui/toaster';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { ProtectedRoute } from '@/lib/protected-route';
import { AdminRoute } from '@/lib/admin-route';
import { AuthProvider } from '@/hooks/use-auth-new';
import { TransactionsProvider } from '@/hooks/use-transactions';
import { Loader2 } from 'lucide-react';

// Páginas regulares - carregamento normal
import AuthPage from '@/pages/auth-page';
import HomePage from '@/pages/home-page';
import NotFound from '@/pages/not-found';

// Páginas menos usadas - lazy loaded
const ProductsPage = lazy(() => import('@/pages/products-page'));
const TeamPage = lazy(() => import('@/pages/team-page'));
const ServicePage = lazy(() => import('@/pages/service-page'));
const UserPage = lazy(() => import('@/pages/user-page'));
const BankAccountsPage = lazy(() => import('@/pages/bank-accounts-page'));
const WithdrawalHistoryPage = lazy(() => import('@/pages/withdrawal-history-page'));

// Páginas Admin - todas lazy loaded para economizar recursos
const AdminDashboard = lazy(() => import('@/pages/admin/admin-dashboard'));
const AdminUsers = lazy(() => import('@/pages/admin/admin-users'));
const AdminProducts = lazy(() => import('@/pages/admin/admin-products'));
const AdminSettings = lazy(() => import('@/pages/admin/admin-settings'));
const DebugTransactions = lazy(() => import('@/pages/admin/debug-transactions'));
const AdminTransactions = lazy(() => import('@/pages/admin/admin-transactions-new'));
const AdminWithdrawals = lazy(() => import('@/pages/admin/admin-withdrawals'));

// Componente de loading para páginas lazy
const LazyLoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TransactionsProvider>
          <Switch>
            <Route path="/auth" component={AuthPage} />
            <ProtectedRoute path="/">
              <HomePage />
            </ProtectedRoute>
            
            {/* Rotas lazy-loaded */}
            <ProtectedRoute path="/products">
              <Suspense fallback={<LazyLoadingSpinner />}>
                <ProductsPage />
              </Suspense>
            </ProtectedRoute>
            
            <ProtectedRoute path="/team">
              <Suspense fallback={<LazyLoadingSpinner />}>
                <TeamPage />
              </Suspense>
            </ProtectedRoute>
            
            <ProtectedRoute path="/service">
              <Suspense fallback={<LazyLoadingSpinner />}>
                <ServicePage />
              </Suspense>
            </ProtectedRoute>
            
            <ProtectedRoute path="/user">
              <Suspense fallback={<LazyLoadingSpinner />}>
                <UserPage />
              </Suspense>
            </ProtectedRoute>
            
            <ProtectedRoute path="/contas-bancarias">
              <Suspense fallback={<LazyLoadingSpinner />}>
                <BankAccountsPage />
              </Suspense>
            </ProtectedRoute>
            
            <ProtectedRoute path="/historico-saques">
              <Suspense fallback={<LazyLoadingSpinner />}>
                <WithdrawalHistoryPage />
              </Suspense>
            </ProtectedRoute>
            
            {/* Rotas Admin - Adicionado proteção específica para admin */}
            <AdminRoute path="/admin">
              <Suspense fallback={<LazyLoadingSpinner />}>
                <AdminDashboard />
              </Suspense>
            </AdminRoute>
            
            <AdminRoute path="/admin/usuarios">
              <Suspense fallback={<LazyLoadingSpinner />}>
                <AdminUsers />
              </Suspense>
            </AdminRoute>
            
            <AdminRoute path="/admin/produtos">
              <Suspense fallback={<LazyLoadingSpinner />}>
                <AdminProducts />
              </Suspense>
            </AdminRoute>
            
            <AdminRoute path="/admin/transacoes">
              <Suspense fallback={<LazyLoadingSpinner />}>
                <AdminTransactions />
              </Suspense>
            </AdminRoute>
            
            <AdminRoute path="/admin/configuracoes">
              <Suspense fallback={<LazyLoadingSpinner />}>
                <AdminSettings />
              </Suspense>
            </AdminRoute>
            
            <AdminRoute path="/admin/debug">
              <Suspense fallback={<LazyLoadingSpinner />}>
                <DebugTransactions />
              </Suspense>
            </AdminRoute>
            
            <AdminRoute path="/admin/saques">
              <Suspense fallback={<LazyLoadingSpinner />}>
                <AdminWithdrawals />
              </Suspense>
            </AdminRoute>
            
            <Route component={NotFound} />
          </Switch>
          <Toaster />
        </TransactionsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

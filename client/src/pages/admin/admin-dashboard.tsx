import { useQuery } from '@tanstack/react-query';
import { Loader2, User, DollarSign, ReceiptIcon, ShoppingCart } from 'lucide-react';
import { Link } from 'wouter';
import { CyberneticBox } from '@/components/ui/cybernetic-box';
import { AdminNavigation } from './components/admin-navigation';
import { formatCurrency } from '@/lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface AdminStats {
  totalUsers: number;
  totalDeposits: number;
  totalWithdrawals: number;
  popularProducts: {
    productId: number;
    name: string;
    count: number;
  }[];
}

const COLORS = ['#7B2FF7', '#E8357B', '#FF6B00', '#FFC107'];

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: ['/api/admin/stats'],
  });

  return (
    <div className="min-h-screen pb-8">
      <AdminNavigation />
      
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
        
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
          </div>
        ) : stats ? (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <CyberneticBox className="flex items-center">
                <div className="w-12 h-12 rounded-full bg-brand-purple/20 flex items-center justify-center mr-4">
                  <User className="h-6 w-6 text-brand-purple" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Total de Usuários</p>
                  <p className="text-2xl font-bold">{stats.totalUsers}</p>
                </div>
              </CyberneticBox>
              
              <CyberneticBox className="flex items-center">
                <div className="w-12 h-12 rounded-full bg-brand-pink/20 flex items-center justify-center mr-4">
                  <DollarSign className="h-6 w-6 text-brand-pink" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Total de Depósitos</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.totalDeposits)}</p>
                </div>
              </CyberneticBox>
              
              <CyberneticBox className="flex items-center">
                <div className="w-12 h-12 rounded-full bg-brand-orange/20 flex items-center justify-center mr-4">
                  <ReceiptIcon className="h-6 w-6 text-brand-orange" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Total de Saques</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.totalWithdrawals)}</p>
                </div>
              </CyberneticBox>
            </div>
            
            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              {/* Popular Products Chart */}
              <CyberneticBox>
                <h2 className="text-xl font-semibold mb-4">Produtos Populares</h2>
                {stats.popularProducts.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.popularProducts}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="count"
                          nameKey="name"
                        >
                          {stats.popularProducts.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-center text-gray-400 py-12">
                    Nenhum produto comprado ainda.
                  </p>
                )}
              </CyberneticBox>
              
              {/* Financial Overview Chart */}
              <CyberneticBox>
                <h2 className="text-xl font-semibold mb-4">Visão Financeira</h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: 'Depósitos', value: stats.totalDeposits },
                        { name: 'Saques', value: stats.totalWithdrawals },
                        { name: 'Lucro', value: stats.totalDeposits - stats.totalWithdrawals }
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="name" stroke="#999" />
                      <YAxis stroke="#999" />
                      <Tooltip 
                        formatter={(value) => [formatCurrency(value as number), 'Valor']}
                        contentStyle={{ backgroundColor: '#1A1E35', borderColor: '#333' }}
                      />
                      <Bar dataKey="value" fill="#7B2FF7" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CyberneticBox>
            </div>
            
            {/* Quick Actions */}
            <h2 className="text-xl font-semibold mb-4">Ações Rápidas</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link href="/admin/usuarios">
                <CyberneticBox className="flex items-center p-6 cursor-pointer hover:bg-dark-tertiary transition-colors">
                  <User className="h-6 w-6 text-brand-purple mr-3" />
                  <span>Gerenciar Usuários</span>
                </CyberneticBox>
              </Link>
              
              <Link href="/admin/transacoes">
                <CyberneticBox className="flex items-center p-6 cursor-pointer hover:bg-dark-tertiary transition-colors">
                  <ReceiptIcon className="h-6 w-6 text-brand-pink mr-3" />
                  <span>Gerenciar Transações</span>
                </CyberneticBox>
              </Link>
              
              <Link href="/admin/produtos">
                <CyberneticBox className="flex items-center p-6 cursor-pointer hover:bg-dark-tertiary transition-colors">
                  <ShoppingCart className="h-6 w-6 text-brand-orange mr-3" />
                  <span>Gerenciar Produtos</span>
                </CyberneticBox>
              </Link>
            </div>
          </>
        ) : (
          <p className="text-center text-gray-400 py-12">
            Erro ao carregar estatísticas.
          </p>
        )}
      </div>
    </div>
  );
}

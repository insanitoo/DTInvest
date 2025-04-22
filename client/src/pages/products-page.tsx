import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Product, UserProduct } from '@shared/schema';
import { BottomNavigation } from '@/components/layout/bottom-navigation';
import { CyberneticBox } from '@/components/ui/cybernetic-box';
import { ProductCard } from '@/components/products/product-card';
import { formatCurrency } from '@/lib/utils';

export default function ProductsPage() {
  const { data: products, isLoading: isLoadingProducts } = useQuery<Product[]>({
    queryKey: ['/api/products'],
  });
  
  const { data: investments, isLoading: isLoadingInvestments } = useQuery<(UserProduct & { productName: string })[]>({
    queryKey: ['/api/user/investments'],
  });

  return (
    <>
      <div className="pb-20">
        {/* Header */}
        <header className="p-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Produtos</h1>
          <div className="rounded-full bg-white w-10 h-10 flex items-center justify-center">
            <span className="text-dark-secondary text-sm font-bold">DTI</span>
          </div>
        </header>
        
        {/* My Investments Section */}
        <div className="mx-4 mb-6">
          <h2 className="text-xl font-semibold mb-3">Meus Investimentos</h2>
          
          {isLoadingInvestments ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : investments && investments.length > 0 ? (
            <div className="space-y-4">
              {investments.map((investment) => (
                <CyberneticBox key={investment.id}>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-semibold">{investment.productName}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      investment.isActive 
                        ? 'bg-green-900/30 text-green-400'
                        : 'bg-red-900/30 text-red-400'
                    }`}>
                      {investment.isActive ? 'Ativo' : 'Encerrado'}
                    </span>
                  </div>
                  <div className="border-t border-gray-700 my-2 border-dashed"></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-sm text-gray-400">Preço de compra</p>
                      <p className="text-base">{formatCurrency(investment.price)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Renda diária</p>
                      <p className="text-base">{formatCurrency(investment.dailyIncome)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Dias restantes</p>
                      <p className="text-base">{investment.daysRemaining}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Data de compra</p>
                      <p className="text-base">{new Date(investment.purchasedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </CyberneticBox>
              ))}
            </div>
          ) : (
            <CyberneticBox className="py-6">
              <p className="text-center text-gray-400">
                Você ainda não possui investimentos. Compre um produto para começar a ganhar rendimentos diários.
              </p>
            </CyberneticBox>
          )}
        </div>
        
        {/* Available Products Section */}
        <div className="mx-4">
          <h2 className="text-xl font-semibold mb-3">Produtos Disponíveis</h2>
          
          {isLoadingProducts ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : products && products.length > 0 ? (
            <div className="space-y-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <CyberneticBox className="py-6">
              <p className="text-center text-gray-400">
                Não há produtos disponíveis no momento.
              </p>
            </CyberneticBox>
          )}
        </div>
      </div>
      
      {/* Bottom Navigation */}
      <BottomNavigation />
    </>
  );
}

import { Product } from '@shared/schema';
import { CyberneticBox } from '../ui/cybernetic-box';
import { Button } from '../ui/button';
import { formatCurrency } from '@/lib/utils';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { toast } = useToast();
  
  const purchaseMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/products/${product.id}/purchase`);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/investments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      
      toast({
        title: 'Produto adquirido',
        description: `Você adquiriu o produto ${product.name} com sucesso! A primeira renda diária de ${formatCurrency(product.dailyIncome)} já foi creditada.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao adquirir produto',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <CyberneticBox>
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold">{product.name}</h3>
        <Button 
          size="sm" 
          variant="primary"
          onClick={() => purchaseMutation.mutate()}
          disabled={purchaseMutation.isPending}
        >
          {purchaseMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          Comprar
        </Button>
      </div>
      <div className="border-t border-gray-700 my-2 border-dashed"></div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-sm text-gray-400">Preço</p>
          <p className="text-base">{formatCurrency(product.price)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-400">Taxa de retorno</p>
          <p className="text-base">{product.returnRate}%</p>
        </div>
        <div>
          <p className="text-sm text-gray-400">Ciclo de tempo</p>
          <p className="text-base">{product.cycleDays} Dias</p>
        </div>
        <div>
          <p className="text-sm text-gray-400">Renda diária</p>
          <p className="text-base">{formatCurrency(product.dailyIncome)}</p>
        </div>
      </div>
      <div className="mt-2">
        <p className="text-sm text-gray-400">Renda total</p>
        <p className="text-base">{formatCurrency(product.totalReturn)}</p>
      </div>
      <div className="absolute top-4 right-4">
        <span className="text-brand-red font-bold">DTI</span>
      </div>
    </CyberneticBox>
  );
}

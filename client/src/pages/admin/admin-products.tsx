import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Loader2, AlertCircle, Plus, Pencil, Trash2 } from 'lucide-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Product, InsertProduct } from '@shared/schema';
import { AdminNavigation } from './components/admin-navigation';
import { CyberneticBox } from '@/components/ui/cybernetic-box';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const productFormSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  price: z.coerce.number().min(1, "Preço deve ser maior que zero"),
  returnRate: z.coerce.number().min(1, "Taxa de retorno deve ser maior que zero"),
  cycleDays: z.coerce.number().min(1, "Ciclo deve ser maior que zero"),
  dailyIncome: z.coerce.number().min(1, "Renda diária deve ser maior que zero"),
  totalReturn: z.coerce.number().min(1, "Retorno total deve ser maior que zero"),
  active: z.boolean().default(true),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

export default function AdminProducts() {
  const { toast } = useToast();
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // Get all products
  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ['/api/admin/products'],
  });
  
  // Form handling
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: '',
      price: 0,
      returnRate: 12,
      cycleDays: 50,
      dailyIncome: 0,
      totalReturn: 0,
      active: true,
    },
  });
  
  // Create product mutation
  const createProductMutation = useMutation({
    mutationFn: async (data: ProductFormValues) => {
      const res = await apiRequest('POST', '/api/admin/products', data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/products'] });
      
      toast({
        title: 'Produto criado',
        description: 'O produto foi criado com sucesso.',
      });
      
      setShowDialog(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao criar produto',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Update product mutation
  const updateProductMutation = useMutation({
    mutationFn: async (data: ProductFormValues) => {
      if (!editingProduct) return;
      
      const res = await apiRequest('PUT', `/api/admin/products/${editingProduct.id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/products'] });
      
      toast({
        title: 'Produto atualizado',
        description: 'O produto foi atualizado com sucesso.',
      });
      
      setShowDialog(false);
      setEditingProduct(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar produto',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Delete product mutation
  const deleteProductMutation = useMutation({
    mutationFn: async () => {
      if (!editingProduct) return;
      
      const res = await apiRequest('DELETE', `/api/admin/products/${editingProduct.id}`);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/products'] });
      
      toast({
        title: 'Produto excluído',
        description: 'O produto foi excluído com sucesso.',
      });
      
      setShowDeleteDialog(false);
      setEditingProduct(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao excluir produto',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Open create dialog
  const handleOpenCreateDialog = () => {
    form.reset({
      name: '',
      price: 0,
      returnRate: 12,
      cycleDays: 50,
      dailyIncome: 0,
      totalReturn: 0,
      active: true,
    });
    setEditingProduct(null);
    setShowDialog(true);
  };
  
  // Open edit dialog
  const handleOpenEditDialog = (product: Product) => {
    form.reset({
      name: product.name,
      price: product.price,
      returnRate: product.returnRate,
      cycleDays: product.cycleDays,
      dailyIncome: product.dailyIncome,
      totalReturn: product.totalReturn,
      active: product.active,
    });
    setEditingProduct(product);
    setShowDialog(true);
  };
  
  // Open delete dialog
  const handleOpenDeleteDialog = (product: Product) => {
    setEditingProduct(product);
    setShowDeleteDialog(true);
  };
  
  // Form submit handler
  const onSubmit = (data: ProductFormValues) => {
    if (editingProduct) {
      updateProductMutation.mutate(data);
    } else {
      createProductMutation.mutate(data);
    }
  };
  
  // Auto calculate total return and daily income
  const watchPrice = form.watch('price');
  const watchReturnRate = form.watch('returnRate');
  const watchCycleDays = form.watch('cycleDays');
  
  // Update totalReturn based on price and returnRate
  if (watchPrice && watchReturnRate) {
    const totalReturn = watchPrice * (1 + watchReturnRate / 100);
    
    if (totalReturn !== form.getValues('totalReturn')) {
      form.setValue('totalReturn', totalReturn);
    }
    
    // Update dailyIncome based on totalReturn and cycleDays
    if (watchCycleDays) {
      const dailyIncome = totalReturn / watchCycleDays;
      
      if (dailyIncome !== form.getValues('dailyIncome')) {
        form.setValue('dailyIncome', dailyIncome);
      }
    }
  }

  return (
    <div className="min-h-screen pb-8">
      <AdminNavigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Gerenciar Produtos</h1>
          <Button 
            variant="primary" 
            onClick={handleOpenCreateDialog}
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Produto
          </Button>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
          </div>
        ) : products && products.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <CyberneticBox key={product.id}>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-semibold">{product.name}</h3>
                  <div className="flex space-x-2">
                    <Button 
                      variant="cybernetic" 
                      size="sm"
                      onClick={() => handleOpenEditDialog(product)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => handleOpenDeleteDialog(product)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
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
                <div className="mt-2 flex items-center">
                  <p className="text-sm text-gray-400 mr-2">Status:</p>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    product.active ? 'bg-green-500' : 'bg-red-500'
                  } bg-opacity-20 text-white`}>
                    {product.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              </CyberneticBox>
            ))}
          </div>
        ) : (
          <CyberneticBox className="py-12 text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-gray-400 mb-4" />
            <p className="text-gray-400">Nenhum produto encontrado.</p>
            <Button 
              variant="primary" 
              className="mt-4"
              onClick={handleOpenCreateDialog}
            >
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeiro Produto
            </Button>
          </CyberneticBox>
        )}
      </div>
      
      {/* Create/Edit Product Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-dark-secondary border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Nome do produto" 
                        className="bg-dark-tertiary border-gray-700" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preço (KZ)</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          placeholder="0" 
                          className="bg-dark-tertiary border-gray-700" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="returnRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Taxa de Retorno (%)</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          placeholder="12" 
                          className="bg-dark-tertiary border-gray-700" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="cycleDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ciclo (Dias)</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          placeholder="50" 
                          className="bg-dark-tertiary border-gray-700" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="dailyIncome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Renda Diária (KZ)</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          placeholder="0" 
                          className="bg-dark-tertiary border-gray-700" 
                          disabled
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="totalReturn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Retorno Total (KZ)</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number" 
                        placeholder="0" 
                        className="bg-dark-tertiary border-gray-700" 
                        disabled
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 border-gray-700">
                    <div className="space-y-0.5">
                      <FormLabel>Ativo</FormLabel>
                      <div className="text-sm text-gray-400">
                        Produto disponível para compra
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={createProductMutation.isPending || updateProductMutation.isPending}
                >
                  {(createProductMutation.isPending || updateProductMutation.isPending) ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Salvando...
                    </>
                  ) : editingProduct ? (
                    "Atualizar Produto"
                  ) : (
                    "Criar Produto"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-dark-secondary border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle>Excluir Produto</DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <p>Tem certeza que deseja excluir o produto <strong>{editingProduct?.name}</strong>?</p>
            <p className="text-sm text-gray-400 mt-2">Esta ação não pode ser desfeita.</p>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteProductMutation.mutate()}
              disabled={deleteProductMutation.isPending}
            >
              {deleteProductMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Excluindo...
                </>
              ) : (
                "Excluir"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

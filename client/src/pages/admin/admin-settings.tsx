import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Loader2, Save, Plus, Trash2, Image } from 'lucide-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Bank, CarouselImage, Setting } from '@shared/schema';
import { AdminNavigation } from './components/admin-navigation';
import { CyberneticBox } from '@/components/ui/cybernetic-box';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

const aboutUsFormSchema = z.object({
  content: z.string().min(10, "Sobre nós deve ter pelo menos 10 caracteres"),
});

const bankFormSchema = z.object({
  name: z.string().min(1, "Nome do banco é obrigatório"),
  ownerName: z.string().min(1, "Nome do proprietário é obrigatório"),
  accountNumber: z.string().min(1, "Número da conta é obrigatório"),
  active: z.boolean().default(true),
});

const carouselImageFormSchema = z.object({
  imageUrl: z.string().url("URL de imagem inválida"),
  active: z.boolean().default(true),
});

type AboutUsFormValues = z.infer<typeof aboutUsFormSchema>;
type BankFormValues = z.infer<typeof bankFormSchema>;
type CarouselImageFormValues = z.infer<typeof carouselImageFormSchema>;

export default function AdminSettings() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('about');
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [editingImage, setEditingImage] = useState<CarouselImage | null>(null);
  const [showBankDialog, setShowBankDialog] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // About Us Query
  const { data: aboutUs } = useQuery<{ content: string }>({
    queryKey: ['/api/about'],
  });
  
  // Banks Query
  const { data: banks, isLoading: isLoadingBanks } = useQuery<Bank[]>({
    queryKey: ['/api/admin/banks'],
  });
  
  // Carousel Images Query
  const { data: carouselImages, isLoading: isLoadingImages } = useQuery<CarouselImage[]>({
    queryKey: ['/api/admin/carousel'],
  });
  
  // About Us Form
  const aboutUsForm = useForm<AboutUsFormValues>({
    resolver: zodResolver(aboutUsFormSchema),
    defaultValues: {
      content: aboutUs?.content || '',
    },
  });
  
  // Bank Form
  const bankForm = useForm<BankFormValues>({
    resolver: zodResolver(bankFormSchema),
    defaultValues: {
      name: '',
      ownerName: '',
      accountNumber: '',
      active: true,
    },
  });
  
  // Carousel Image Form
  const imageForm = useForm<CarouselImageFormValues>({
    resolver: zodResolver(carouselImageFormSchema),
    defaultValues: {
      imageUrl: '',
      active: true,
    },
  });
  
  // Update about us mutation
  const updateAboutUsMutation = useMutation({
    mutationFn: async (data: AboutUsFormValues) => {
      const res = await apiRequest('PUT', '/api/admin/settings/aboutUs', { 
        value: data.content 
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/about'] });
      
      toast({
        title: 'Sobre nós atualizado',
        description: 'O texto "Sobre nós" foi atualizado com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Create bank mutation
  const createBankMutation = useMutation({
    mutationFn: async (data: BankFormValues) => {
      const res = await apiRequest('POST', '/api/admin/banks', data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/banks'] });
      
      toast({
        title: 'Banco adicionado',
        description: 'O banco foi adicionado com sucesso.',
      });
      
      setShowBankDialog(false);
      bankForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao adicionar banco',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Update bank mutation
  const updateBankMutation = useMutation({
    mutationFn: async (data: BankFormValues) => {
      if (!editingBank) return;
      
      const res = await apiRequest('PUT', `/api/admin/banks/${editingBank.id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/banks'] });
      
      toast({
        title: 'Banco atualizado',
        description: 'O banco foi atualizado com sucesso.',
      });
      
      setShowBankDialog(false);
      setEditingBank(null);
      bankForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar banco',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Delete bank mutation
  const deleteBankMutation = useMutation({
    mutationFn: async () => {
      if (!editingBank) return;
      
      const res = await apiRequest('DELETE', `/api/admin/banks/${editingBank.id}`);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/banks'] });
      
      toast({
        title: 'Banco excluído',
        description: 'O banco foi excluído com sucesso.',
      });
      
      setShowDeleteDialog(false);
      setEditingBank(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao excluir banco',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Create carousel image mutation
  const createImageMutation = useMutation({
    mutationFn: async (data: CarouselImageFormValues) => {
      const res = await apiRequest('POST', '/api/admin/carousel', data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/carousel'] });
      queryClient.invalidateQueries({ queryKey: ['/api/carousel'] });
      
      toast({
        title: 'Imagem adicionada',
        description: 'A imagem foi adicionada com sucesso.',
      });
      
      setShowImageDialog(false);
      imageForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao adicionar imagem',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Update carousel image mutation
  const updateImageMutation = useMutation({
    mutationFn: async (data: CarouselImageFormValues) => {
      if (!editingImage) return;
      
      const res = await apiRequest('PUT', `/api/admin/carousel/${editingImage.id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/carousel'] });
      queryClient.invalidateQueries({ queryKey: ['/api/carousel'] });
      
      toast({
        title: 'Imagem atualizada',
        description: 'A imagem foi atualizada com sucesso.',
      });
      
      setShowImageDialog(false);
      setEditingImage(null);
      imageForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar imagem',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Delete carousel image mutation
  const deleteImageMutation = useMutation({
    mutationFn: async () => {
      if (!editingImage) return;
      
      const res = await apiRequest('DELETE', `/api/admin/carousel/${editingImage.id}`);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/carousel'] });
      queryClient.invalidateQueries({ queryKey: ['/api/carousel'] });
      
      toast({
        title: 'Imagem excluída',
        description: 'A imagem foi excluída com sucesso.',
      });
      
      setShowDeleteDialog(false);
      setEditingImage(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao excluir imagem',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Open create bank dialog
  const handleOpenCreateBankDialog = () => {
    bankForm.reset({
      name: '',
      ownerName: '',
      accountNumber: '',
      active: true,
    });
    setEditingBank(null);
    setShowBankDialog(true);
  };
  
  // Open edit bank dialog
  const handleOpenEditBankDialog = (bank: Bank) => {
    bankForm.reset({
      name: bank.name,
      ownerName: bank.ownerName,
      accountNumber: bank.accountNumber,
      active: bank.active,
    });
    setEditingBank(bank);
    setShowBankDialog(true);
  };
  
  // Open delete bank dialog
  const handleOpenDeleteBankDialog = (bank: Bank) => {
    setEditingBank(bank);
    setEditingImage(null);
    setShowDeleteDialog(true);
  };
  
  // Open create image dialog
  const handleOpenCreateImageDialog = () => {
    imageForm.reset({
      imageUrl: '',
      active: true,
    });
    setEditingImage(null);
    setShowImageDialog(true);
  };
  
  // Open edit image dialog
  const handleOpenEditImageDialog = (image: CarouselImage) => {
    imageForm.reset({
      imageUrl: image.imageUrl,
      active: image.active,
    });
    setEditingImage(image);
    setShowImageDialog(true);
  };
  
  // Open delete image dialog
  const handleOpenDeleteImageDialog = (image: CarouselImage) => {
    setEditingImage(image);
    setEditingBank(null);
    setShowDeleteDialog(true);
  };
  
  // About Us Form Submit
  const onAboutUsSubmit = (data: AboutUsFormValues) => {
    updateAboutUsMutation.mutate(data);
  };
  
  // Bank Form Submit
  const onBankSubmit = (data: BankFormValues) => {
    if (editingBank) {
      updateBankMutation.mutate(data);
    } else {
      createBankMutation.mutate(data);
    }
  };
  
  // Image Form Submit
  const onImageSubmit = (data: CarouselImageFormValues) => {
    if (editingImage) {
      updateImageMutation.mutate(data);
    } else {
      createImageMutation.mutate(data);
    }
  };
  
  // Handle delete confirmation
  const handleDeleteConfirm = () => {
    if (editingBank) {
      deleteBankMutation.mutate();
    } else if (editingImage) {
      deleteImageMutation.mutate();
    }
  };
  
  // Update About Us form when data changes
  if (aboutUs && aboutUs.content !== aboutUsForm.getValues('content')) {
    aboutUsForm.setValue('content', aboutUs.content);
  }

  return (
    <div className="min-h-screen pb-8">
      <AdminNavigation />
      
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Configurações Gerais</h1>
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-8">
            <TabsTrigger value="about">Sobre Nós</TabsTrigger>
            <TabsTrigger value="banks">Bancos</TabsTrigger>
            <TabsTrigger value="carousel">Carrossel</TabsTrigger>
          </TabsList>
          
          {/* About Us Tab */}
          <TabsContent value="about">
            <CyberneticBox>
              <h2 className="text-xl font-semibold mb-4">Editar Texto Sobre Nós</h2>
              <Form {...aboutUsForm}>
                <form onSubmit={aboutUsForm.handleSubmit(onAboutUsSubmit)} className="space-y-4">
                  <FormField
                    control={aboutUsForm.control}
                    name="content"
                    render={({ field }) => {
                      return (
                        <FormItem>
                          <FormLabel>Conteúdo</FormLabel>
                          <FormControl>
                            <Textarea 
                              value={field.value}
                              onChange={field.onChange}
                              placeholder="Digite o texto sobre a empresa" 
                              className="bg-dark-tertiary border-gray-700 min-h-[200px]" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                  
                  <Button 
                    type="submit" 
                    variant="primary"
                    disabled={updateAboutUsMutation.isPending}
                  >
                    {updateAboutUsMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Salvar Alterações
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CyberneticBox>
          </TabsContent>
          
          {/* Banks Tab */}
          <TabsContent value="banks">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Bancos para Depósito</h2>
              <Button 
                variant="primary" 
                onClick={handleOpenCreateBankDialog}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Banco
              </Button>
            </div>
            
            {isLoadingBanks ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : banks && banks.length > 0 ? (
              <div className="space-y-4">
                {banks.map((bank) => (
                  <CyberneticBox key={bank.id} className="flex justify-between items-center">
                    <div>
                      <h3 className="font-medium">{bank.name}</h3>
                      <p className="text-sm text-gray-400">Proprietário: {bank.ownerName}</p>
                      <p className="text-sm text-gray-400">IBAN: {bank.accountNumber}</p>
                      <p className="text-sm mt-1">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          bank.active ? 'bg-green-500' : 'bg-red-500'
                        } bg-opacity-20 text-white`}>
                          {bank.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <Button 
                        variant="cybernetic" 
                        size="sm"
                        onClick={() => handleOpenEditBankDialog(bank)}
                      >
                        Editar
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleOpenDeleteBankDialog(bank)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CyberneticBox>
                ))}
              </div>
            ) : (
              <CyberneticBox className="py-6 text-center">
                <p className="text-gray-400">Nenhum banco configurado.</p>
                <Button 
                  variant="primary" 
                  className="mt-4"
                  onClick={handleOpenCreateBankDialog}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Primeiro Banco
                </Button>
              </CyberneticBox>
            )}
          </TabsContent>
          
          {/* Carousel Tab */}
          <TabsContent value="carousel">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Imagens do Carrossel</h2>
              <Button 
                variant="primary" 
                onClick={handleOpenCreateImageDialog}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Imagem
              </Button>
            </div>
            
            {isLoadingImages ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : carouselImages && carouselImages.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {carouselImages.map((image) => (
                  <CyberneticBox key={image.id}>
                    <div className="aspect-video mb-3 bg-dark-tertiary rounded-lg overflow-hidden">
                      <img 
                        src={image.imageUrl} 
                        alt="Imagem do carrossel" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        image.active ? 'bg-green-500' : 'bg-red-500'
                      } bg-opacity-20 text-white`}>
                        {image.active ? 'Ativo' : 'Inativo'}
                      </span>
                      <div className="flex space-x-2">
                        <Button 
                          variant="cybernetic" 
                          size="sm"
                          onClick={() => handleOpenEditImageDialog(image)}
                        >
                          Editar
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => handleOpenDeleteImageDialog(image)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CyberneticBox>
                ))}
              </div>
            ) : (
              <CyberneticBox className="py-6 text-center">
                <p className="text-gray-400">Nenhuma imagem configurada.</p>
                <Button 
                  variant="primary" 
                  className="mt-4"
                  onClick={handleOpenCreateImageDialog}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Primeira Imagem
                </Button>
              </CyberneticBox>
            )}
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Bank Dialog */}
      <Dialog open={showBankDialog} onOpenChange={setShowBankDialog}>
        <DialogContent className="bg-dark-secondary border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle>{editingBank ? 'Editar Banco' : 'Adicionar Banco'}</DialogTitle>
          </DialogHeader>
          
          <Form {...bankForm}>
            <form onSubmit={bankForm.handleSubmit(onBankSubmit)} className="space-y-4">
              <FormField
                control={bankForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Banco</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Ex: BAI, BIC, BFA..." 
                        className="bg-dark-tertiary border-gray-700" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={bankForm.control}
                name="ownerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Proprietário</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Nome completo do proprietário" 
                        className="bg-dark-tertiary border-gray-700" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={bankForm.control}
                name="accountNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número da Conta / IBAN</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Número da conta ou IBAN" 
                        className="bg-dark-tertiary border-gray-700" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={bankForm.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 border-gray-700">
                    <div className="space-y-0.5">
                      <FormLabel>Ativo</FormLabel>
                      <div className="text-sm text-gray-400">
                        Banco disponível para depósitos
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
                  disabled={createBankMutation.isPending || updateBankMutation.isPending}
                >
                  {(createBankMutation.isPending || updateBankMutation.isPending) ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Salvando...
                    </>
                  ) : editingBank ? (
                    "Atualizar Banco"
                  ) : (
                    "Adicionar Banco"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Image Dialog */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent className="bg-dark-secondary border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle>{editingImage ? 'Editar Imagem' : 'Adicionar Imagem'}</DialogTitle>
          </DialogHeader>
          
          <Form {...imageForm}>
            <form onSubmit={imageForm.handleSubmit(onImageSubmit)} className="space-y-4">
              <FormField
                control={imageForm.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL da Imagem</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="https://exemplo.com/imagem.jpg" 
                        className="bg-dark-tertiary border-gray-700" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {imageForm.watch("imageUrl") && (
                <div className="aspect-video bg-dark-tertiary rounded-lg overflow-hidden">
                  <img 
                    src={imageForm.watch("imageUrl")} 
                    alt="Pré-visualização"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "https://via.placeholder.com/800x400?text=Imagem+Inválida";
                    }}
                  />
                </div>
              )}
              
              <FormField
                control={imageForm.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 border-gray-700">
                    <div className="space-y-0.5">
                      <FormLabel>Ativa</FormLabel>
                      <div className="text-sm text-gray-400">
                        Imagem visível no carrossel
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
                  disabled={createImageMutation.isPending || updateImageMutation.isPending}
                >
                  {(createImageMutation.isPending || updateImageMutation.isPending) ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Salvando...
                    </>
                  ) : editingImage ? (
                    "Atualizar Imagem"
                  ) : (
                    "Adicionar Imagem"
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
            <DialogTitle>
              {editingBank ? 'Excluir Banco' : 'Excluir Imagem'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <p>
              Tem certeza que deseja excluir este {editingBank ? 'banco' : 'imagem'}?
            </p>
            {editingBank && (
              <p className="font-medium mt-2">{editingBank.name} - {editingBank.ownerName}</p>
            )}
            {editingImage && (
              <div className="mt-2 aspect-video bg-dark-tertiary rounded-lg overflow-hidden">
                <img 
                  src={editingImage.imageUrl} 
                  alt="Imagem a ser excluída" 
                  className="w-full h-full object-cover"
                />
              </div>
            )}
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
              onClick={handleDeleteConfirm}
              disabled={deleteBankMutation.isPending || deleteImageMutation.isPending}
            >
              {(deleteBankMutation.isPending || deleteImageMutation.isPending) ? (
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

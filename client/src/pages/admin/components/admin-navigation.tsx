import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { 
  Home,
  LayoutDashboard, 
  Users, 
  ShoppingCart, 
  Settings, 
  Receipt, 
  Menu, 
  X,
  LogOut,
  Bug
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

export function AdminNavigation() {
  const [location] = useLocation();
  const { logoutMutation } = useAuth();
  const [open, setOpen] = useState(false);

  const navItems = [
    {
      title: 'Dashboard',
      href: '/admin',
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    {
      title: 'Transações',
      href: '/admin/transacoes',
      icon: <Receipt className="h-5 w-5" />,
    },
    {
      title: 'Usuários',
      href: '/admin/usuarios',
      icon: <Users className="h-5 w-5" />,
    },
    {
      title: 'Produtos',
      href: '/admin/produtos',
      icon: <ShoppingCart className="h-5 w-5" />,
    },
    {
      title: 'Configurações',
      href: '/admin/configuracoes',
      icon: <Settings className="h-5 w-5" />,
    },
    {
      title: 'Depuração',
      href: '/admin/debug',
      icon: <Bug className="h-5 w-5" />,
    },
  ];

  const isActive = (path: string) => {
    return location === path;
  };

  const logout = () => {
    logoutMutation.mutate();
  };

  return (
    <div className="bg-dark-secondary border-b border-gray-800">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/admin" className="flex items-center space-x-2 font-bold text-xl">
              <div className="rounded-full bg-white w-8 h-8 flex items-center justify-center">
                <span className="text-dark-secondary text-sm font-bold">S&P</span>
              </div>
              <span>Admin</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            {navItems.map((item) => (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center px-3 py-2 rounded-lg transition-colors ${
                  isActive(item.href) 
                    ? 'bg-dark-tertiary text-brand-purple' 
                    : 'hover:bg-dark-tertiary/50'
                }`}
              >
                {item.icon}
                <span className="ml-2">{item.title}</span>
              </Link>
            ))}

            <div className="ml-4 border-l border-gray-700 pl-4">
              <Button 
                variant="ghost" 
                size="sm" 
                className="flex items-center text-gray-300 hover:text-white"
                onClick={logout}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-10 w-10"
                >
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-dark-secondary border-l border-gray-800 p-0">
                <div className="flex flex-col h-full">
                  <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                    <div className="flex items-center space-x-2 font-bold text-xl">
                      <div className="rounded-full bg-white w-8 h-8 flex items-center justify-center">
                        <span className="text-dark-secondary text-sm font-bold">S&P</span>
                      </div>
                      <span>Admin</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex-1 py-4">
                    <div className="px-4 py-2">
                      <Link
                        href="/"
                        className="flex items-center px-3 py-2 rounded-lg transition-colors hover:bg-dark-tertiary/50"
                        onClick={() => setOpen(false)}
                      >
                        <Home className="h-5 w-5" />
                        <span className="ml-2">Voltar ao Site</span>
                      </Link>
                    </div>
                    
                    <nav className="px-4 py-2">
                      {navItems.map((item) => (
                        <Link 
                          key={item.href} 
                          href={item.href}
                          className={`flex items-center px-3 py-2 rounded-lg transition-colors mb-1 ${
                            isActive(item.href) 
                              ? 'bg-dark-tertiary text-brand-purple' 
                              : 'hover:bg-dark-tertiary/50'
                          }`}
                          onClick={() => setOpen(false)}
                        >
                          {item.icon}
                          <span className="ml-2">{item.title}</span>
                        </Link>
                      ))}
                    </nav>
                  </div>

                  <div className="p-4 border-t border-gray-800">
                    <Button 
                      variant="ghost" 
                      className="w-full flex items-center justify-center"
                      onClick={() => {
                        setOpen(false);
                        logout();
                      }}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sair
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth-new';
import { formatCurrency } from '@/lib/utils';
import { Home, User, LogOut, Wallet, CreditCard, Users, Settings, Package, PieChart, Clock } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export function Navbar() {
  const { user, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    logoutMutation.mutate();
    setLocation('/auth');
  };

  // Obter iniciais do número de telefone para o avatar
  const getUserInitials = () => {
    if (!user?.phoneNumber) return 'U';
    return user.phoneNumber.substring(0, 2);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <div className="mr-4 md:flex" onClick={() => setLocation('/')} style={{ cursor: 'pointer' }}>
          <div className="flex items-center space-x-2">
            <svg width="32" height="32" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="40" height="40" rx="8" fill="url(#paint0_linear)" />
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M20.295 8C16.1138 8 12.7127 10.5324 11.4225 14.091C14.0035 14.0973 16.45 15.5049 17.6221 18.2029C17.7805 18.5825 17.9095 18.8364 18.0406 19.0155C18.1973 19.2303 18.4105 19.3333 18.6991 19.3333C19.0838 19.3333 19.3501 19.0593 19.5033 18.7451C19.5989 18.5522 19.6946 18.2772 19.8221 17.9183C21.1284 14.3961 25.7548 13.2357 29.4398 14.8131C30.1146 15.1287 30.4991 15.4111 30.6568 15.6359C30.8362 15.8923 30.8729 16.2027 30.6847 16.6261C28.8102 20.6587 24.8203 21.2233 20.9227 20.3348C20.7165 20.2742 20.5234 20.2115 20.3439 20.151C16.4891 18.953 12.9236 23.8452 15.0522 28.3513C15.1475 28.5457 15.1951 28.7401 15.1854 28.8969C15.1741 29.0871 15.0913 29.2241 14.8862 29.379C14.5789 29.6133 14.123 29.5662 13.711 29.2995C11.2654 27.6475 9.75409 24.7959 9.75409 21.6127C9.75409 14.0658 14.3706 8 20.295 8Z"
                fill="white"
              />
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M19.7051 32C23.8862 32 27.2874 29.4676 28.5775 25.909C25.9965 25.9027 23.55 24.4951 22.3779 21.7971C22.2195 21.4175 22.0906 21.1636 21.9594 20.9845C21.8028 20.7697 21.5895 20.6667 21.3009 20.6667C20.9162 20.6667 20.6499 20.9407 20.4967 21.2549C20.4011 21.4478 20.3054 21.7228 20.1779 22.0817C18.8716 25.6039 14.2453 26.7643 10.5602 25.1869C9.88544 24.8713 9.50093 24.5889 9.34321 24.3641C9.16384 24.1077 9.12711 23.7973 9.31527 23.3739C11.1898 19.3413 15.1798 18.7767 19.0773 19.6652C19.2835 19.7258 19.4767 19.7884 19.6561 19.849C23.5109 21.047 27.0764 16.1548 24.9478 11.6487C24.8525 11.4543 24.8049 11.2599 24.8146 11.1031C24.8259 10.9129 24.9087 10.7759 25.1139 10.621C25.4211 10.3867 25.8771 10.4338 26.289 10.7005C28.7346 12.3525 30.246 15.2041 30.246 18.3873C30.246 25.9342 25.6294 32 19.7051 32Z"
                fill="white"
              />
              <defs>
                <linearGradient
                  id="paint0_linear"
                  x1="0"
                  y1="0"
                  x2="40"
                  y2="40"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#4F46E5" />
                  <stop offset="1" stopColor="#06B6D4" />
                </linearGradient>
              </defs>
            </svg>
            <span className="font-semibold text-xl tracking-tight">S&P Global</span>
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center space-x-4">
          {user && user.isAdmin && (
            <Button 
              onClick={() => setLocation('/admin')} 
              variant="outline"
              className="hidden md:flex"
            >
              Área Admin
            </Button>
          )}
          
          {user && (
            <span className="text-sm font-medium hidden md:block">
              Saldo: {formatCurrency(user.balance || 0)}
            </span>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar>
                  <AvatarFallback>{getUserInitials()}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {user && <DropdownMenuLabel>{user.phoneNumber}</DropdownMenuLabel>}
              {user && (
                <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">
                  Saldo: {formatCurrency(user.balance || 0)}
                </DropdownMenuLabel>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setLocation('/')}>
                <Home className="mr-2 h-4 w-4" />
                Início
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocation('/user')}>
                <User className="mr-2 h-4 w-4" />
                Perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocation('/contas-bancarias')}>
                <CreditCard className="mr-2 h-4 w-4" />
                Contas Bancárias
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocation('/historico-saques')}>
                <Clock className="mr-2 h-4 w-4" />
                Histórico de Saques
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocation('/team')}>
                <Users className="mr-2 h-4 w-4" />
                Minha Equipe
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocation('/products')}>
                <Package className="mr-2 h-4 w-4" />
                Produtos
              </DropdownMenuItem>
              {user && user.isAdmin && (
                <DropdownMenuItem onClick={() => setLocation('/admin')}>
                  <PieChart className="mr-2 h-4 w-4" />
                  Área Admin
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
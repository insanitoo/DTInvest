import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Home, Shield, Users, User } from 'lucide-react';

interface NavItem {
  id: string;
  title: string;
  icon: React.ReactNode;
  path: string;
}

export function BottomNavigation() {
  const [location] = useLocation();
  
  const navItems: NavItem[] = [
    {
      id: 'home',
      title: 'Início',
      icon: <Home className="h-5 w-5" />,
      path: '/'
    },
    {
      id: 'products',
      title: 'Produtos',
      icon: <Shield className="h-5 w-5" />,
      path: '/produtos'
    },
    {
      id: 'team',
      title: 'Equipa',
      icon: <Users className="h-5 w-5" />,
      path: '/equipa'
    },
    {
      id: 'user',
      title: 'Usuário',
      icon: <User className="h-5 w-5" />,
      path: '/usuario'
    }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-dark-secondary border-t border-gray-800 p-2 z-20">
      <div className="grid grid-cols-4 gap-2">
        {navItems.map((item) => {
          const isActive = (
            (item.path === '/' && location === '/') ||
            (item.path !== '/' && location.startsWith(item.path))
          );
          
          return (
            <Link 
              key={item.id}
              href={item.path}
              className="flex flex-col items-center justify-center py-1"
            >
              <div className={`nav-icon ${isActive ? 'active opacity-100' : 'opacity-60'} relative`}>
                {item.icon}
              </div>
              <span className="text-xs mt-1">{item.title}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

import React from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Home, User, ShoppingCart, Users, Clock } from "lucide-react";

export function BottomNavigation() {
  const [location] = useLocation();

  const isActive = (path: string) => {
    return location === path;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-dark-secondary border-t border-dark-border z-10">
      <div className="flex justify-around items-center h-16">
        <Link href="/" className={cn(
          "flex flex-col items-center justify-center text-xs py-1",
          isActive("/") ? "text-primary" : "text-gray-400"
        )}>
          <Home className="h-5 w-5 mb-1" />
          <span>Início</span>
        </Link>

        <Link href="/products" className={cn(
          "flex flex-col items-center justify-center text-xs py-1",
          isActive("/products") ? "text-primary" : "text-gray-400"
        )}>
          <ShoppingCart className="h-5 w-5 mb-1" />
          <span>Produtos</span>
        </Link>

        <Link href="/historico-saques" className={cn(
          "flex flex-col items-center justify-center text-xs py-1",
          isActive("/historico-saques") ? "text-primary" : "text-gray-400"
        )}>
          <Clock className="h-5 w-5 mb-1" />
          <span>Saques</span>
        </Link>

        <Link href="/team" className={cn(
          "flex flex-col items-center justify-center text-xs py-1",
          isActive("/team") ? "text-primary" : "text-gray-400"
        )}>
          <Users className="h-5 w-5 mb-1" />
          <span>Equipa</span>
        </Link>

        <Link href="/user" className={cn(
          "flex flex-col items-center justify-center text-xs py-1",
          isActive("/user") ? "text-primary" : "text-gray-400"
        )}>
          <User className="h-5 w-5 mb-1" />
          <span>Perfil</span>
        </Link>
      </div>
    </div>
  );
}
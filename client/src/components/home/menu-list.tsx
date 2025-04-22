import React from "react";
import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { 
  BarChart3, 
  Building2, 
  Clock, 
  FileText, 
  Headphones, 
  Settings
} from "lucide-react";

interface MenuItemProps {
  icon: React.ReactNode;
  title: string;
  href: string;
}

export function MenuItem({ icon, title, href }: MenuItemProps) {
  return (
    <Link href={href} className="w-full">
      <div className="flex items-center justify-between w-full p-4 mb-4 rounded-lg bg-dark-secondary hover:bg-dark-tertiary transition-colors cyber-element">
        <div className="flex items-center">
          <div className="mr-4 text-primary">
            {icon}
          </div>
          <span className="text-base font-medium">{title}</span>
        </div>
        <ChevronRight className="h-5 w-5 text-gray-400" />
      </div>
    </Link>
  );
}

export function MenuList() {
  const menuItems = [
    {
      icon: <Building2 className="h-6 w-6" />,
      title: "Meu banco",
      href: "/user?tab=bank"
    },
    {
      icon: <Clock className="h-6 w-6" />,
      title: "Registros de fundos",
      href: "/user?tab=transactions"
    },
    {
      icon: <Headphones className="h-6 w-6" />,
      title: "Serviço",
      href: "/service"
    }
  ];

  return (
    <div className="w-full">
      {menuItems.map((item, index) => (
        <MenuItem
          key={index}
          icon={item.icon}
          title={item.title}
          href={item.href}
        />
      ))}
    </div>
  );
}

export function AboutSection() {
  return (
    <div className="mt-6">
      <h2 className="text-xl font-bold mb-4">Sobre Nós</h2>
      <div className="p-4 rounded-lg bg-dark-secondary">
        <p className="text-sm text-gray-300 leading-relaxed">
          A DTI é uma plataforma líder em soluções de investimento com foco em segurança e inovação. 
          Nossa missão é proporcionar aos nossos clientes oportunidades de crescimento financeiro com 
          segurança cibernética de ponta.
        </p>
      </div>
    </div>
  );
}
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  BarChart3, 
  Building2, 
  History, 
  FileSpreadsheet, 
  Headset,
  Settings 
} from 'lucide-react';
import { Setting } from '@shared/schema';
import { BottomNavigation } from '@/components/layout/bottom-navigation';
import { ImageCarousel } from '@/components/home/image-carousel';
import { BalanceCard } from '@/components/home/balance-card';
import { Button } from '@/components/ui/button';
import { MenuItem } from '@/components/home/menu-item';
import { CyberneticBox } from '@/components/ui/cybernetic-box';
import { WithdrawalModal } from '@/components/modals/withdrawal-modal';
import { DepositModal } from '@/components/modals/deposit-modal';

export default function HomePage() {
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  
  const { data: aboutUs } = useQuery<{ content: string }>({
    queryKey: ['/api/about'],
  });

  return (
    <>
      <div className="pb-20">
        {/* Header */}
        <header className="p-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">S&P Global</h1>
          <div className="rounded-full bg-white w-10 h-10 flex items-center justify-center">
            <span className="text-dark-secondary text-sm font-bold">S&P</span>
          </div>
        </header>
        
        {/* Image Carousel */}
        <ImageCarousel />
        
        {/* Balance Card */}
        <BalanceCard />
        
        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4 mx-4 mb-8">
          <Button 
            variant="primary" 
            className="rounded-lg py-6 flex items-center justify-center space-x-2 cyber-element"
            onClick={() => setShowDepositModal(true)}
          >
            <Building2 className="mr-2" />
            <span>Recarregar</span>
          </Button>
          <Button 
            variant="secondary2" 
            className="rounded-lg py-6 flex items-center justify-center space-x-2 cyber-element"
            onClick={() => setShowWithdrawalModal(true)}
          >
            <FileSpreadsheet className="mr-2" />
            <span>Retirar</span>
          </Button>
        </div>
        
        {/* Menu Items */}
        <div className="mx-4 space-y-3">
          <MenuItem 
            icon={<BarChart3 />} 
            title="Meus investimentos" 
            href="/produtos" 
          />
          <MenuItem 
            icon={<Building2 />} 
            title="Meu banco" 
            href="/usuario?tab=bank" 
          />
          <MenuItem 
            icon={<History />} 
            title="Registros de fundos" 
            href="/usuario?tab=transactions" 
          />
          <MenuItem 
            icon={<FileSpreadsheet />} 
            title="Registro de depósito" 
            href="/usuario?tab=deposits" 
          />
          <MenuItem 
            icon={<Headset />} 
            title="Serviço" 
            href="/usuario?tab=service" 
          />
          <MenuItem 
            icon={<Settings />} 
            title="Definições" 
            href="/usuario?tab=settings" 
          />
        </div>
        
        {/* About Us Section */}
        <div className="mx-4 mt-8 mb-4">
          <h2 className="text-xl font-semibold mb-3">Sobre Nós</h2>
          <CyberneticBox>
            <p className="text-gray-300 text-sm">
              {aboutUs?.content || 
                "A S&P Global é uma plataforma líder em soluções de investimento com foco em segurança e inovação. Nossa missão é proporcionar aos nossos clientes oportunidades de crescimento financeiro com segurança cibernética de ponta."}
            </p>
          </CyberneticBox>
        </div>
      </div>
      
      {/* Bottom Navigation */}
      <BottomNavigation />
      
      {/* Modals */}
      <WithdrawalModal 
        isOpen={showWithdrawalModal} 
        onClose={() => setShowWithdrawalModal(false)} 
      />
      <DepositModal 
        isOpen={showDepositModal} 
        onClose={() => setShowDepositModal(false)} 
      />
    </>
  );
}

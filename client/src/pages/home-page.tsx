import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth-new';
import { BottomNavigation } from '@/components/layout/bottom-navigation';
import { BalanceCard } from '@/components/home/balance-card';
import { WithdrawalModal } from '@/components/modals/withdrawal-modal';
import { DepositModal } from '@/components/modals/deposit-modal';
import { MenuList, AboutSection } from '@/components/home/menu-list';
import { Transaction } from '@shared/schema';

export default function HomePage() {
  const { user } = useAuth();
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);

  // Fetch transactions for background data (não exibidas na UI atualizada)
  const { data: transactions } = useQuery<Transaction[]>({
    queryKey: ['/api/transactions'],
  });

  return (
    <>
      <div className="pb-20">
        {/* Header */}
        <header className="p-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">DTI</h1>
          <div className="rounded-full bg-white w-10 h-10 flex items-center justify-center">
            <span className="text-dark-secondary text-sm font-bold">S&P</span>
          </div>
        </header>

        {/* Carousel/Image Banner */}
        <div className="mb-2 px-4">
          <div className="rounded-xl overflow-hidden h-48 w-full bg-gradient-to-br from-blue-900 to-indigo-900 shadow-lg">
            <div className="flex justify-center items-center h-full">
              <div className="w-full h-full flex justify-center items-center bg-cybernetic-pattern">
                {/* A representação da imagem do carrossel com elementos 3D */}
                <div className="grid grid-cols-4 grid-rows-4 gap-1 rotate-45 opacity-60">
                  {Array.from({ length: 16 }).map((_, index) => (
                    <div 
                      key={index} 
                      className="w-6 h-6 bg-blue-500 bg-opacity-50 border border-blue-400"
                      style={{ 
                        transform: `translateZ(${Math.random() * 20}px)`,
                        animation: `pulse ${1 + Math.random() * 3}s infinite alternate`
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Balance Card with Action Buttons */}
        <BalanceCard 
          onDepositClick={() => setShowDepositModal(true)}
          onWithdrawClick={() => setShowWithdrawalModal(true)} 
        />

        {/* Menu Items */}
        <div className="px-4 mb-6">
          <MenuList />
        </div>

        {/* About Section */}
        <div className="px-4 mb-6">
          <AboutSection />
        </div>
      </div>

      {/* Modals */}
      <WithdrawalModal 
        isOpen={showWithdrawalModal} 
        onClose={() => setShowWithdrawalModal(false)} 
      />
      <DepositModal 
        isOpen={showDepositModal} 
        onClose={() => setShowDepositModal(false)} 
      />

      {/* Bottom Navigation */}
      <BottomNavigation />
    </>
  );
}

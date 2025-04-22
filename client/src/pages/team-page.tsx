
import { useQuery } from '@tanstack/react-query';
import { Loader2, Ticket, Link2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth-new';
import { BottomNavigation } from '@/components/layout/bottom-navigation';
import { ReferralItem } from '@/components/team/referral-item';
import { LevelCard } from '@/components/team/level-card';

interface ReferralStats {
  level1: {
    count: number;
    commission: number;
    referrals: {
      id: number;
      phoneNumber: string;
      hasProduct: boolean;
    }[];
  };
  level2: {
    count: number;
    commission: number;
    referrals: {
      id: number;
      phoneNumber: string;
      hasProduct: boolean;
    }[];
  };
  level3: {
    count: number;
    commission: number;
    referrals: {
      id: number;
      phoneNumber: string;
      hasProduct: boolean;
    }[];
  };
}

export default function TeamPage() {
  const { user } = useAuth();
  const { data: referralStats, isLoading } = useQuery<ReferralStats>({
    queryKey: ['/api/user/referrals'],
  });

  const referralLink = `${window.location.origin}/auth?ref=${user?.referralCode}`;
  
  return (
    <>
      <div className="pb-20">
        {/* Header */}
        <header className="p-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Equipa</h1>
          <div className="rounded-full bg-white w-10 h-10 flex items-center justify-center">
            <span className="text-dark-secondary text-sm font-bold">DTI</span>
          </div>
        </header>
        
        {/* Referral Code */}
        <div className="mx-4">
          <ReferralItem 
            icon={<Ticket />} 
            title="Código de convite" 
            value={user?.referralCode || ''} 
          />
        </div>
        
        {/* Referral Link */}
        <div className="mx-4">
          <ReferralItem 
            icon={<Link2 />} 
            title="Ligação de convite" 
            value={referralLink} 
          />
        </div>
        
        {/* Referral Banner */}
        <div className="mx-4 mt-6 mb-4">
          <div className="bg-gradient-to-r from-brand-red to-brand-orange rounded-xl p-3 text-center">
            <h3 className="text-base font-bold">RECOMPENSAS DE CONVITE</h3>
            <p className="text-sm">Convide amigos para ganhar 33% de recompensa por convite</p>
          </div>
        </div>

        {/* Referral Levels */}
        <div className="mx-4 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : referralStats ? (
            <>
              <LevelCard 
                level={1} 
                commission={referralStats.level1.commission} 
                members={referralStats.level1.count} 
                commissionPercentage={25} 
                referrals={referralStats.level1.referrals}
              />
              
              <LevelCard 
                level={2} 
                commission={referralStats.level2.commission} 
                members={referralStats.level2.count} 
                commissionPercentage={5} 
                referrals={referralStats.level2.referrals}
              />
              
              <LevelCard 
                level={3} 
                commission={referralStats.level3.commission} 
                members={referralStats.level3.count} 
                commissionPercentage={3} 
                referrals={referralStats.level3.referrals}
              />
            </>
          ) : null}
        </div>
      </div>
      
      <BottomNavigation />
    </>
  );
}

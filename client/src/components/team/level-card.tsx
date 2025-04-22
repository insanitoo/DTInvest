import { CyberneticBox } from '../ui/cybernetic-box';
import { Button } from '../ui/button';
import { formatCurrency } from '@/lib/utils';
import { useState } from 'react';
import { Users, ChevronDown, ChevronUp } from 'lucide-react';

interface Referral {
  id: number;
  phoneNumber: string;
  hasProduct: boolean;
  balance?: number;
}

interface LevelCardProps {
  level: number;
  commission: number;
  members: number;
  commissionPercentage: number;
  referrals: Referral[];
}

export function LevelCard({ 
  level, 
  commission, 
  members, 
  commissionPercentage,
  referrals
}: LevelCardProps) {
  const [showReferrals, setShowReferrals] = useState(false);
  
  return (
    <CyberneticBox className="mb-4">
      <h3 className="text-lg font-medium mb-3">Nível - {level}</h3>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <p className="text-sm text-gray-400">Comissão</p>
          <p className="text-base">{commissionPercentage}%</p>
        </div>
        <div>
          <p className="text-sm text-gray-400">Membros da equipe</p>
          <p className="text-base">{members}</p>
        </div>
        <div>
          <p className="text-sm text-gray-400">Total ganho</p>
          <p className="text-base">{formatCurrency(commission)}</p>
        </div>
      </div>
      
      <Button 
        variant="outline"
        className="w-full mt-3 flex items-center justify-center gap-2"
        onClick={() => setShowReferrals(!showReferrals)}
      >
        <Users className="h-4 w-4" />
        <span>Ver equipe</span>
        {showReferrals ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </Button>
      
      {showReferrals && referrals.length > 0 && (
        <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
          <div className="text-sm font-medium grid grid-cols-4">
            <span>ID</span>
            <span>Telefone</span>
            <span>Status</span>
            <span>Saldo</span>
          </div>
          {referrals.map(referral => (
            <div key={referral.id} className="text-sm grid grid-cols-4 py-1 border-t border-gray-800">
              <span className="text-gray-400">{referral.id}</span>
              <span>{referral.phoneNumber}</span>
              <span>
                {referral.hasProduct ? (
                  <span className="text-green-500">Ativo</span>
                ) : (
                  <span className="text-yellow-500">Pendente</span>
                )}
              </span>
              <span className="text-gray-400">-</span>
            </div>
          ))}
        </div>
      )}
      
      {showReferrals && referrals.length === 0 && (
        <div className="mt-3 text-sm text-gray-400 text-center py-3">
          Nenhum membro neste nível
        </div>
      )}
    </CyberneticBox>
  );
}

import React from "react";
import { CyberneticBox } from "../ui/cybernetic-box";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export function BalanceCard() {
  const { user, isLoading } = useAuth();

  return (
    <div className="px-4 mb-6">
      <CyberneticBox className="bg-dark-secondary rounded-lg p-5">
        <div className="mb-2">
          <h2 className="text-gray-400 text-sm">Saldo Disponível</h2>
        </div>
        
        {isLoading ? (
          <div className="flex items-center h-10">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            <div className="flex items-end mb-3">
              <h3 className="text-3xl font-bold">
                {user ? formatCurrency(user.balance) : 'KZ 0.00'}
              </h3>
            </div>
            
            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              <div className="bg-dark-tertiary rounded-md p-2">
                <p className="text-gray-400 mb-1">Comissão Nível 1</p>
                <p className="font-medium">
                  {user ? formatCurrency(user.level1Commission || 0) : 'KZ 0.00'}
                </p>
              </div>
              <div className="bg-dark-tertiary rounded-md p-2">
                <p className="text-gray-400 mb-1">Comissão Nível 2</p>
                <p className="font-medium">
                  {user ? formatCurrency(user.level2Commission || 0) : 'KZ 0.00'}
                </p>
              </div>
              <div className="bg-dark-tertiary rounded-md p-2">
                <p className="text-gray-400 mb-1">Comissão Nível 3</p>
                <p className="font-medium">
                  {user ? formatCurrency(user.level3Commission || 0) : 'KZ 0.00'}
                </p>
              </div>
            </div>
          </>
        )}
      </CyberneticBox>
    </div>
  );
}

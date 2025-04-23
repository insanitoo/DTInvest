import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, Filter } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

export type TransactionFilterType = 'all' | 'deposit' | 'withdrawal' | 'purchase' | 'commission';
export type TransactionFilterStatus = 'all' | 'pending' | 'completed' | 'failed' | 'processing';

interface TransactionFiltersProps {
  onFilterChange: (type: TransactionFilterType, status: TransactionFilterStatus) => void;
  activeFilters: {
    type: TransactionFilterType;
    status: TransactionFilterStatus;
  };
}

export function TransactionFilters({ onFilterChange, activeFilters }: TransactionFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localType, setLocalType] = useState<TransactionFilterType>(activeFilters.type);
  const [localStatus, setLocalStatus] = useState<TransactionFilterStatus>(activeFilters.status);

  const handleApplyFilters = () => {
    onFilterChange(localType, localStatus);
    setIsOpen(false);
  };

  const handleClearFilters = () => {
    setLocalType('all');
    setLocalStatus('all');
    onFilterChange('all', 'all');
    setIsOpen(false);
  };

  const getFilterCount = () => {
    let count = 0;
    if (activeFilters.type !== 'all') count++;
    if (activeFilters.status !== 'all') count++;
    return count;
  };

  const filterCount = getFilterCount();

  return (
    <div>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-9 border-gray-700 text-gray-300 bg-dark-tertiary"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtrar
            {filterCount > 0 && (
              <Badge 
                className="ml-2 bg-primary text-white" 
                variant="secondary"
              >
                {filterCount}
              </Badge>
            )}
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-4 border-gray-700 bg-dark-secondary">
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Filtros de Transação</h4>
            
            <div>
              <h5 className="text-sm text-gray-400 mb-2">Tipo</h5>
              <RadioGroup 
                value={localType} 
                onValueChange={(value) => setLocalType(value as TransactionFilterType)}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="type-all" />
                  <Label htmlFor="type-all">Todos</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="deposit" id="type-deposit" />
                  <Label htmlFor="type-deposit">Depósitos</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="withdrawal" id="type-withdrawal" />
                  <Label htmlFor="type-withdrawal">Saques</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="purchase" id="type-purchase" />
                  <Label htmlFor="type-purchase">Compras</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="commission" id="type-commission" />
                  <Label htmlFor="type-commission">Comissões</Label>
                </div>
              </RadioGroup>
            </div>

            <Separator className="bg-gray-700" />

            <div>
              <h5 className="text-sm text-gray-400 mb-2">Status</h5>
              <RadioGroup 
                value={localStatus} 
                onValueChange={(value) => setLocalStatus(value as TransactionFilterStatus)}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="status-all" />
                  <Label htmlFor="status-all">Todos</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="pending" id="status-pending" />
                  <Label htmlFor="status-pending">Pendentes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="processing" id="status-processing" />
                  <Label htmlFor="status-processing">Em processamento</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="completed" id="status-completed" />
                  <Label htmlFor="status-completed">Concluídos</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="failed" id="status-failed" />
                  <Label htmlFor="status-failed">Falhos</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex gap-2 justify-end">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleClearFilters}
              >
                Limpar
              </Button>
              <Button 
                variant="default" 
                size="sm"
                onClick={handleApplyFilters}
              >
                Aplicar
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
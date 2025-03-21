import { CyberneticBox } from '../ui/cybernetic-box';
import { Button } from '../ui/button';
import { Clipboard, Copy } from 'lucide-react';
import { copyToClipboard } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface ReferralItemProps {
  icon: React.ReactNode;
  title: string;
  value: string;
}

export function ReferralItem({ icon, title, value }: ReferralItemProps) {
  const { toast } = useToast();
  
  const handleCopy = async () => {
    try {
      await copyToClipboard(value);
      toast({
        title: "Copiado!",
        description: `${title} copiado para a área de transferência.`,
      });
    } catch (error) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar para a área de transferência.",
        variant: "destructive",
      });
    }
  };

  return (
    <CyberneticBox className="mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-dark-tertiary flex items-center justify-center text-brand-purple">
            {icon}
          </div>
          <div>
            <p className="text-sm text-gray-400">{title}</p>
            <p className="text-base font-medium truncate max-w-[180px]">{value}</p>
          </div>
        </div>
        <Button
          size="icon"
          variant="cybernetic"
          onClick={handleCopy}
          className="w-8 h-8"
        >
          <Copy className="h-4 w-4 text-gray-400" />
        </Button>
      </div>
    </CyberneticBox>
  );
}

import { CyberneticBox } from '../ui/cybernetic-box';
import { Link } from 'wouter';
import { ChevronRight } from 'lucide-react';
import { ReactNode } from 'react';

interface MenuItemProps {
  icon: ReactNode;
  title: string;
  href: string;
}

export function MenuItem({ icon, title, href }: MenuItemProps) {
  return (
    <Link href={href}>
      <CyberneticBox className="flex items-center justify-between cursor-pointer hover:bg-dark-tertiary/50 transition-colors">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-dark-tertiary flex items-center justify-center text-brand-purple">
            {icon}
          </div>
          <span>{title}</span>
        </div>
        <ChevronRight className="text-gray-400 h-5 w-5" />
      </CyberneticBox>
    </Link>
  );
}

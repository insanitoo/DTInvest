import React from 'react';
import { cn } from '@/lib/utils';

interface CyberneticBoxProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function CyberneticBox({
  className,
  children,
  ...props
}: CyberneticBoxProps) {
  return (
    <div
      className={cn(
        'bg-dark-secondary rounded-xl p-4 relative cyber-element',
        'before:content-[""] before:absolute before:w-[10px] before:h-[10px] before:border-t before:border-l before:border-brand-orange/50 before:top-[-3px] before:left-[-3px]',
        'after:content-[""] after:absolute after:w-[10px] after:h-[10px] after:border-b after:border-r after:border-brand-orange/50 after:bottom-[-3px] after:right-[-3px]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

import React from 'react';
import { cn } from '@/lib/utils';

interface GradientCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
}

export function GradientCard({
  variant = 'primary',
  className,
  children,
  ...props
}: GradientCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl p-4 shadow-lg',
        variant === 'primary' 
          ? 'bg-gradient-to-r from-brand-purple/70 to-brand-pink/70' 
          : 'bg-gradient-to-r from-brand-orange/70 to-brand-yellow/70',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

import React from "react";
import { cn } from "@/lib/utils";

interface CyberneticBoxProps extends React.HTMLAttributes<HTMLDivElement> {
  withGlow?: boolean;
  borderColor?: string;
}

export function CyberneticBox({
  children,
  className,
  withGlow = true,
  borderColor,
  ...props
}: CyberneticBoxProps) {
  return (
    <div
      className={cn(
        "cyber-element bg-dark-secondary rounded-lg p-4 border border-dark-border",
        withGlow && "cyber-element",
        borderColor && `border-${borderColor}`,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

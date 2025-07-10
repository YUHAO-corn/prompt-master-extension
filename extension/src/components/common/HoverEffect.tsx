import React from 'react';

interface HoverEffectProps {
  children: React.ReactNode;
  className?: string;
}

export function HoverEffect({ children, className = '' }: HoverEffectProps) {
  return (
    <div
      className={`transform transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${className}`}
    >
      {children}
    </div>
  );
}

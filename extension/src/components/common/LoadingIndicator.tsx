import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingIndicatorProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingIndicator({ size = 'md', className = '' }: LoadingIndicatorProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div className={`flex items-center justify-center ${className}`} data-testid="loading-indicator">
      <Loader2 className={`${sizeClasses[size]} animate-spin text-magic-400`} />
    </div>
  );
}

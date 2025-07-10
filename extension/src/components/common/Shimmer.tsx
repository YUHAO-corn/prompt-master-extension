import React from 'react';

interface ShimmerProps {
  className?: string;
}

export function Shimmer({ className = '' }: ShimmerProps) {
  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] animate-shimmer-interval" />
    </div>
  );
}

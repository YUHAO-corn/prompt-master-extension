import React from 'react';
import { HoverEffect } from './HoverEffect';
import { Shimmer } from './Shimmer';
import { Sparkles } from 'lucide-react';

interface CardProps {
  title?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  isLocked?: boolean;
  isRecommended?: boolean;
}

export function Card({ 
  title, 
  children, 
  actions, 
  className = '', 
  onClick, 
  isLocked = false,
  isRecommended = false 
}: CardProps) {
  const cardClassNames = `
    bg-white dark:bg-gradient-to-br dark:from-magic-800 dark:to-magic-900 
    border border-gray-200 dark:border-magic-700/30
    rounded-lg overflow-hidden 
    shadow-sm hover:shadow-md dark:shadow-none
    transition-all duration-300
    ${onClick && !isLocked ? 'cursor-pointer hover:translate-y-[-2px]' : ''} 
    ${isLocked ? 'opacity-70' : ''}
    ${className}
  `;
  
  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (onClick && !isLocked) {
      onClick(event);
    }
  };
  
  const content = (
    <div className={cardClassNames} onClick={handleClick}>
      <div className="relative">
        {title && (
          <div className="px-2.5 py-2 bg-gray-50 dark:bg-magic-800/50 border-b border-gray-100 dark:border-magic-700/30 flex justify-between items-center">
            <h3 className="text-xs font-medium text-gray-800 dark:text-magic-200 relative z-raised overflow-hidden text-ellipsis whitespace-nowrap">{title}</h3>
            {isRecommended && (
              <span className="inline-flex items-center text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-full">
                <Sparkles size={9} className="mr-0.5" />
                Recommended
              </span>
            )}
          </div>
        )}
        
        <div className="p-3 relative z-raised">{children}</div>
        
        {actions && (
          <div className="flex items-center justify-end px-3 pb-2 relative z-raised">{actions}</div>
        )}
      </div>
    </div>
  );
  
  return onClick && !isLocked ? <HoverEffect>{content}</HoverEffect> : content;
}

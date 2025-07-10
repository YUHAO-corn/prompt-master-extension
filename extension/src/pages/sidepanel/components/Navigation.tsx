import React from 'react';
import { BookMarked, Wand2 } from 'lucide-react';
import { ProBadge } from '../../../components/membership';
import { useMembership } from '../../../hooks/useMembership';

interface NavigationProps {
  activeTab: 'library' | 'optimize';
  onTabChange: (tab: 'library' | 'optimize') => void;
}

export function Navigation({ activeTab, onTabChange }: NavigationProps) {
  // 获取会员状态
  const { isProMember } = useMembership();
  
  return (
    <div className="flex border-b border-magic-200 dark:border-magic-700/30 flex-shrink-0 h-[46px]">
      <button
        onClick={() => onTabChange('library')}
        className={`flex-1 px-4 py-2.5 text-xs font-medium transition-all duration-300 relative ${
          activeTab === 'library'
            ? 'text-purple-700 dark:text-magic-200 bg-purple-50/80 dark:bg-magic-800/30'
            : 'text-magic-600 dark:text-magic-400 hover:text-purple-600 hover:bg-purple-50/50 dark:hover:text-magic-300 dark:hover:bg-magic-800/20'
        }`}
      >
        <div className="flex items-center justify-center space-x-1.5">
          <BookMarked size={14} />
          <span>Prompt Library</span>
        </div>
        {activeTab === 'library' && (
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-purple-500 to-purple-600 dark:from-magic-500 dark:to-magic-400"></div>
        )}
      </button>
      <button
        onClick={() => onTabChange('optimize')}
        className={`flex-1 px-4 py-2.5 text-xs font-medium transition-all duration-300 relative ${
          activeTab === 'optimize'
            ? 'text-purple-700 dark:text-magic-200 bg-purple-50/80 dark:bg-magic-800/30'
            : 'text-magic-600 dark:text-magic-400 hover:text-purple-600 hover:bg-purple-50/50 dark:hover:text-magic-300 dark:hover:bg-magic-800/20'
        }`}
      >
        <div className="flex items-center justify-center space-x-1.5">
          <Wand2 size={14} />
          <span className="whitespace-nowrap">Prompt Optimizer</span>
        </div>
        {activeTab === 'optimize' && (
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-purple-500 to-purple-600 dark:from-magic-500 dark:to-magic-400"></div>
        )}
      </button>
    </div>
  );
} 
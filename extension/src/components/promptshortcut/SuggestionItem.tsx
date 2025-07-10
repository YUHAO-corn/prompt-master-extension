import React, { useMemo } from 'react';

interface Suggestion {
  id: string;
  title: string;
  content: string;
  createdAt?: number;
}

interface SuggestionItemProps {
  suggestion: Suggestion;
  isHighlighted: boolean;
  onClick: () => void;
  searchTerm: string;
}

const SuggestionItem: React.FC<SuggestionItemProps> = ({
  suggestion,
  isHighlighted,
  onClick,
  searchTerm,
}) => {
  // 高亮匹配文本
  const highlightedTitle = useMemo(() => {
    if (!searchTerm.trim()) {
      return <span>{suggestion.title}</span>;
    }

    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = suggestion.title.split(regex);

    return (
      <>
        {parts.map((part, i) => 
          regex.test(part) ? 
            <span key={i} className="text-brand-blue font-medium">{part}</span> : 
            <span key={i}>{part}</span>
        )}
      </>
    );
  }, [suggestion.title, searchTerm]);

  return (
    <div
        className={`px-3 py-2 cursor-pointer w-full box-border ${
        isHighlighted ? 'bg-magic-700' : 'hover:bg-magic-700'
      }`}
      onClick={onClick}
    >
      <div className="truncate text-sm">
        {highlightedTitle}
      </div>
    </div>
  );
};

export default SuggestionItem; 
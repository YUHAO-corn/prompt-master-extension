import React from 'react';
import { marked } from 'marked';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

// 配置marked选项，启用GitHub风格Markdown
marked.setOptions({
  gfm: true, // 启用GitHub风格Markdown
  breaks: true // 转换换行符为<br>
});

// 使用marked库将Markdown转换为HTML
export function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  console.log("Rendering markdown:", content);
  
  // 使用marked将Markdown转换为HTML
  const html = marked(content || '');
  
  // 通过dangerouslySetInnerHTML直接渲染HTML
  return (
    <div 
      className={`markdown-content ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
} 
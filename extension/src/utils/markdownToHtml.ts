/**
 * 将Markdown文本转换为HTML
 * 处理基本的Markdown语法：标题、加粗、斜体、列表等
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown) return '';
  
  let html = markdown;
  
  // 处理标题 (h1, h2, h3)
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // 处理加粗和斜体
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
  
  // 处理无序列表
  html = html.replace(/^\s*[\-\*]\s+(.*$)/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>');
  
  // 处理有序列表
  html = html.replace(/^\s*\d+\.\s+(.*$)/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)(?!\s*(<\/ul>|<li>))/gim, '<ol>$1</ol>');
  
  // 处理引用块
  html = html.replace(/^\>\s(.*$)/gim, '<blockquote>$1</blockquote>');
  
  // 处理段落和换行
  html = html.replace(/(?!\n|<\/h[1-3]>|<\/li>|<\/blockquote>$)([^\n]+)(?!\n|<h[1-3]>|<li>|<blockquote>)/gim, '<p>$1</p>');
  
  // 处理链接
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  
  // 处理代码块
  html = html.replace(/`([^`]+)`/gim, '<code>$1</code>');
  
  return html;
} 
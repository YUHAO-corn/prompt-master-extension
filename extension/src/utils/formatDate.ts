/**
 * 将毫秒时间戳格式化为可读的日期字符串
 * @param timestamp 毫秒时间戳
 * @returns 格式化的日期字符串，例如：Mar 28, 2024 12:34
 */
export function formatDate(timestamp: number): string {
  if (!timestamp) return 'Unknown';
  
  const date = new Date(timestamp);
  
  // 格式化为：MMM DD, YYYY HH:MM
  const year = date.getFullYear();
  const month = date.toLocaleString('en', { month: 'short' });
  const day = date.getDate();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  return `${month} ${day}, ${year} ${hours}:${minutes}`;
} 
/**
 * 字符串处理工具函数
 */

/**
 * 计算字符串字节长度（中文2字节，其他1字节）
 * @param str 要计算的字符串
 * @returns 字节长度
 */
export function calculateByteLength(str: string): number {
  if (!str) return 0;
  
  let byteLen = 0;
  for (let i = 0; i < str.length; i++) {
    // 中文字符范围
    if (/[\u4e00-\u9fa5]/.test(str[i])) {
      byteLen += 2;
    } else {
      byteLen += 1;
    }
  }
  return byteLen;
}

/**
 * 智能截断字符串确保不超过指定字节数
 * @param text 要截断的文本
 * @param maxBytes 最大字节数
 * @param addEllipsis 是否添加省略号（默认为false）
 * @returns 截断后的文本
 */
export function smartTruncate(
  text: string, 
  maxBytes: number, 
  addEllipsis: boolean = false
): string {
  if (!text) return '';
  
  const textBytes = calculateByteLength(text);
  if (textBytes <= maxBytes) {
    return text;
  }
  
  // 计算实际可用字节数
  const effectiveMaxBytes = addEllipsis 
    ? maxBytes - 3  // 减去省略号的字节数
    : maxBytes;
  
  let result = '';
  let currentBytes = 0;
  let lastBreakPoint = 0;
  
  // 按字符依次添加，直到接近字节限制
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const charBytes = /[\u4e00-\u9fa5]/.test(char) ? 2 : 1;
    
    // 记录可能的断点位置（空格、标点等）
    if (/[\s,.;，。；、！？!?]/.test(char)) {
      lastBreakPoint = i;
    }
    
    // 如果添加当前字符会超出限制，中断循环
    if (currentBytes + charBytes > effectiveMaxBytes) {
      break;
    }
    
    result += char;
    currentBytes += charBytes;
  }
  
  // 尝试在单词边界截断（针对英文）
  if (/[a-zA-Z0-9]$/.test(result) && lastBreakPoint > 0) {
    // 截断点需要考虑是否离结尾太远（避免截断太多内容）
    if (result.length - lastBreakPoint <= Math.min(5, result.length / 3)) {
      result = result.substring(0, lastBreakPoint + 1);
    }
  }
  
  // 避免以空格结尾
  result = result.trim();
  
  // 针对中文内容，检测是否截断在标点符号后
  if (/[\u4e00-\u9fa5]/.test(text) && /[,，;；]$/.test(result)) {
    result = result.substring(0, result.length - 1);
  }
  
  return addEllipsis ? result + '...' : result;
}

/**
 * 生成邀请码 - 6位字符，包含数字和大写字母，去除容易混淆的字符
 * @returns 唯一的邀请码字符串
 */
export function generateInviteCode(): string {
  // 去除容易混淆的字符：0, O, I, 1
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  
  // 生成6位字符
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}
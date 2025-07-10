import { TITLE_LIMITS } from '../../utils/constants';
import { calculateByteLength, smartTruncate } from '../../utils/stringUtils';
import { generateTitle as aiServiceGenerateTitle } from '@/services/utils/aiService';

/**
 * 豆包API标题生成服务
 * 使用豆包AI模型生成更智能的标题
 */

/**
 * 使用统一AI服务生成标题
 * @param content 提示词内容
 * @returns 生成的标题
 */
export async function generateTitleWithDoubao(content: string): Promise<string> {
  // 处理空内容
  if (!content || content.trim().length === 0) {
    return '未命名提示词';
  }
  
  try {
    console.log('[DoubaoTitleGenerator] 使用AI服务生成标题');
    
    // 使用统一的AI服务
    const generatedTitle = await aiServiceGenerateTitle(content);
    console.log('[DoubaoTitleGenerator] 获取到AI生成标题:', generatedTitle);
    
    // 确保标题不超过字节限制 - 使用统一的smartTruncate，并且不添加省略号
    if (calculateByteLength(generatedTitle) > TITLE_LIMITS.PROCESSING) {
      return smartTruncate(generatedTitle, TITLE_LIMITS.PROCESSING, false);
    }
    
    return generatedTitle;
  } catch (error) {
    console.error('[DoubaoTitleGenerator] 标题生成错误:', error);
    
    // 错误处理，返回一个基本的标题，根据内容语言选择默认标题
    const fallbackTitle = content.length > 30 ? 
      content.substring(0, 30).trim() : 
      content.trim();
      
    return smartTruncate(fallbackTitle, TITLE_LIMITS.PROCESSING, false);
  }
}

/**
 * 导出标题生成函数
 */
export async function generateTitle(content: string): Promise<string> {
  return generateTitleWithDoubao(content);
} 
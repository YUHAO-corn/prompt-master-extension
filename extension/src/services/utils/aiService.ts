import { OptimizationMode } from '../systemPrompts';
import { getSystemPrompt as getDetailedSystemPrompt } from '../systemPrompts';
import { callAIProxy } from './aiProxyClient';
import { getOptimizationConfig, TITLE_GENERATION_CONFIG } from './apiConfigs';
import { CHECK_QUOTA, INCREMENT_USAGE } from '@/types/centralState';
import { safeLogger } from '@/utils/safeEnvironment';
import { detectMainLanguage, translateText } from '@/utils/languageUtils';

/**
 * 统一的AI服务模块
 * 提供所有AI相关功能的访问点
 * 集中管理API调用、错误处理和配额监控
 */

/**
 * AI服务错误类型
 */
export class AIServiceError extends Error {
  code: string;

  constructor(message: string, code: string = 'ai-service/unknown-error') {
    super(message);
    this.name = 'AIServiceError';
    this.code = code;
  }
}

/**
 * 优化提示词选项
 */
export interface OptimizePromptOptions {
  mode?: OptimizationMode;
  isToolbar?: boolean;
  userId?: string | null;
  isReoptimize?: boolean; // 新增：标记请求是否为重新优化请求
}

/**
 * 生成标题选项
 */
export interface GenerateTitleOptions {
  userId?: string | null;
}

/**
 * 统一的配额检查函数
 * @param userId 用户ID
 * @param feature 功能名称
 * @returns 是否有配额可用
 */
async function checkQuota(userId: string | null, feature: string): Promise<boolean> {
  if (!userId) return true; // 如果没有用户ID，默认允许操作
  
  try {
    const quotaResult = await chrome.runtime.sendMessage({
      type: CHECK_QUOTA,
      userId: userId,
      feature: feature
    });
    
    return quotaResult && quotaResult.hasQuota !== false;
  } catch (error) {
    console.error(`[AIService] Failed to check quota for ${feature}:`, error);
    throw new AIServiceError(
      `Failed to verify usage quota for ${feature}`, 
      `ai-service/quota-check-failed`
    );
  }
}

/**
 * 统一的使用量递增函数
 * @param userId 用户ID
 * @param feature 功能名称
 */
async function incrementUsage(userId: string | null, feature: string): Promise<void> {
  if (!userId) return; // 如果没有用户ID，跳过记录
  
  try {
    await chrome.runtime.sendMessage({
      type: INCREMENT_USAGE,
      userId: userId,
      feature: feature
    });
  } catch (error) {
    // 记录但不抛出错误，因为这不应该阻止用户继续使用功能
    console.error(`[AIService] Failed to record usage for ${feature}:`, error);
  }
}

/**
 * 处理优化结果
 * @param content 原始优化结果
 * @param originalContent 原始内容（用于检查语言一致性）
 * @returns 处理后的优化结果
 */
async function processOptimizationResult(optimizedContent: string | null, originalContent: string): Promise<string> {
  safeLogger.log(`[AIService - processOptimizationResult] Input content:`, optimizedContent ? optimizedContent.substring(0,100) + '...' : '[EMPTY/NULL]');
  safeLogger.log(`[AIService - processOptimizationResult] Original content for lang check:`, originalContent ? originalContent.substring(0,100) + '...' : '[EMPTY/NULL]');

  if (!optimizedContent) {
    // 如果AI返回空内容，可能应该返回原始输入或者抛出错误
    // 暂时返回原始内容，以避免破坏现有流程，但这可能不是最佳策略
    safeLogger.warn('[AIService - processOptimizationResult] AI returned null or empty content. Returning original content.');
    return originalContent;
  }

  let finalContent = optimizedContent;

  // 常见的引导语模式
  const preamblePatterns = [
    /^optimized prompt:/im,
    /^优化后的提示词：/im,
    /^以下是优化后的提示词：/im,
    /^here's the optimized prompt:/im,
    // 可以根据需要添加更多模式
  ];

  for (const pattern of preamblePatterns) {
    if (pattern.test(finalContent)) {
      finalContent = finalContent.replace(pattern, '').trim();
      safeLogger.log(`[AIService - processOptimizationResult] Removed preamble based on pattern: ${pattern}`);
      break; 
    }
  }
  safeLogger.log(`[AIService - processOptimizationResult] After removing引导语:`, finalContent ? finalContent.substring(0,100) + '...' : '[EMPTY/NULL]');
  
  // 语言一致性检查和修正
  return await ensureLanguageConsistency(finalContent, originalContent);
}

/**
 * 处理标题生成结果
 * @param title 原始生成的标题
 * @param originalContent 原始内容
 * @returns 处理后的标题
 */
async function processTitleResult(title: string, originalContent: string = ''): Promise<string> {
  // 清理特殊字符、引号、标点符号和常见前缀
  let processed = title.trim();
  
  processed = processed.replace(/^["""「」【】《》]+|["""「」【】《》]+$/g, '');
  processed = processed.replace(/^(标题[：:]\s*|Title[：:]\s*|主题[：:]\s*|Theme[：:]\s*)/i, '');
  processed = processed.replace(/^(关于|相关|有关|regarding|about|on)\s*/i, '');
  processed = processed.replace(/[,.;:!?，。；：！？、]/g, ''); // 移除所有标点符号
  
  // 如果提供了原始内容，则进行语言一致性检查
  if (originalContent) {
    return await ensureLanguageConsistency(processed, originalContent);
  }
  
  return processed;
}

/**
 * 优化提示词
 * @param content 要优化的内容
 * @param options 优化选项
 * @returns 优化后的内容
 */
export async function optimizePrompt(
  content: string,
  options: OptimizePromptOptions = {}
): Promise<string> {
  const { mode = 'standard', isToolbar = false, userId = null, isReoptimize = false } = options;
  
  try {
    // 检查内容
    if (!content || content.trim() === '') {
      throw new AIServiceError('Content cannot be empty', 'ai-service/empty-content');
    }
    
    // 检查配额
    // Quota check is now handled by the caller (e.g., optimizationHandler)
    // await checkQuota(userId, 'optimization'); 
    
    console.log(`[AIService] optimizePrompt called. Mode: ${mode}, isToolbar: ${isToolbar}, userId: ${userId}, isReoptimize: ${isReoptimize}`);
    safeLogger.log(`[AIService] optimizePrompt called. Mode: ${mode}, isToolbar: ${isToolbar}, userId: ${userId}, isReoptimize: ${isReoptimize}, content (start):`, content ? content.substring(0, 50) + '...': '[EMPTY]');
    
    // 获取系统提示词
    const systemPrompt = getDetailedSystemPrompt(mode);
    safeLogger.log(`[AIService] System prompt for mode ${mode}:`, systemPrompt ? systemPrompt.substring(0,150) + '...': '[EMPTY]');
    
    // 为重新优化请求增加特殊提示
    let userContent = content;
    if (isReoptimize) {
      userContent = `I need a different optimization approach for this prompt. Please try another approach or perspective to further enhance it:\n\n${content}`;
    }
    
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userContent }
    ];
    safeLogger.log('[AIService] Messages prepared for AI Proxy:', JSON.stringify(messages, null, 2)); // Log full messages structure
    
    // 获取配置
    let apiConfig = getOptimizationConfig(mode, isToolbar);
    
    // 调整重新优化请求的参数以获取不同结果
    if (isReoptimize) {
      apiConfig = {
        ...apiConfig,
        temperature: Math.min(apiConfig.temperature + 0.15, 0.8), // 增加随机性
      };
    }
    
    safeLogger.log('[AIService] API Config for AI Proxy:', apiConfig);
    
    // 调用API
    safeLogger.log('[AIService] Calling callAIProxy...');
    const rawOptimizedResult = await callAIProxy(messages, apiConfig);
    safeLogger.log('[AIService] callAIProxy RAW result:', rawOptimizedResult ? rawOptimizedResult.substring(0, 200) + '...' : '[EMPTY]');

    // 新增：检查AI是否返回了原始内容
    if (rawOptimizedResult && content && content.trim() === rawOptimizedResult.trim()) {
        safeLogger.warn(`[AIService] AI service returned the original content. Input (start): "${content.substring(0,80)}...", Output (start): "${rawOptimizedResult.substring(0,80)}..."`);
    }
    
    // 处理结果
    safeLogger.log('[AIService] Processing optimization result...');
    const processedResult = await processOptimizationResult(rawOptimizedResult, content);
    safeLogger.log('[AIService] processOptimizationResult output:', processedResult ? processedResult.substring(0, 200) + '...' : '[EMPTY]');
    
    // 记录使用量 (Caller should handle this if quota check is also handled by caller)
    // await incrementUsage(userId, 'optimization');
    
    return processedResult;
  } catch (error) {
    // 处理和转换错误
    if (error instanceof AIServiceError) {
      throw error; // 已经是我们的错误类型，直接传递
    }
    
    // 将其他错误转换为AIServiceError
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[AIService] Optimization failed:', error);
    throw new AIServiceError(
      `Prompt optimization failed: ${message}`, 
      'ai-service/optimization-failed'
    );
  }
}

/**
 * 继续优化提示词
 * @param content 已经优化过的内容
 * @param options 优化选项
 * @returns 进一步优化的内容
 */
export async function continueOptimization(
  content: string,
  options: OptimizePromptOptions = {}
): Promise<string> {
  const { mode = 'standard', isToolbar = false, userId = null } = options;
  
  try {
    // 检查内容
    if (!content || content.trim() === '') {
      throw new AIServiceError('Content cannot be empty', 'ai-service/empty-content');
    }
    
    // 检查配额
    await checkQuota(userId, 'optimization');
    
    // 准备API调用
    console.log(`[AIService] Continuing optimization in mode: ${mode}, isToolbar: ${isToolbar}`);
    
    // 获取系统提示词
    const systemPrompt = getDetailedSystemPrompt(mode);
    
    // 创建消息 - 增加进一步优化的指令
    const userPrompt = `Please further optimize the following prompt, enhancing its clarity, structure, and effectiveness:\n\n${content}`;
    
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt }
    ];
    
    // 获取配置 - 略微提高温度
    const baseConfig = getOptimizationConfig(mode, isToolbar);
    const apiConfig = {
      ...baseConfig,
      temperature: Math.min(baseConfig.temperature + 0.1, 0.7),
    };
    
    // 调用API
    const result = await callAIProxy(messages, apiConfig);
    
    // 处理结果
    const processedResult = await processOptimizationResult(result, content);
    
    // 记录使用量
    await incrementUsage(userId, 'optimization');
    
    return processedResult;
  } catch (error) {
    // 处理和转换错误
    if (error instanceof AIServiceError) {
      throw error;
    }
    
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[AIService] Continue optimization failed:', error);
    throw new AIServiceError(
      `Continue optimization failed: ${message}`, 
      'ai-service/continue-optimization-failed'
    );
  }
}

/**
 * 生成标题
 * @param content 用于生成标题的内容
 * @param options 生成选项
 * @returns 生成的标题
 */
export async function generateTitle(
  content: string,
  options: GenerateTitleOptions = {}
): Promise<string> {
  const { userId = null } = options;
  
  try {
    // Check content
    if (!content || content.trim() === '') {
      throw new AIServiceError('Content cannot be empty for title generation', 'ai-service/empty-content');
    }
    
    // Quota check for title generation
    // await checkQuota(userId, 'title_generation'); // Assuming 'title_generation' is a feature to track

    console.log(`[AIService] generateTitle called. userId: ${userId}, content length: ${content.length}`);
    safeLogger.log(`[AIService] generateTitle called. userId: ${userId}, content (start):`, content ? content.substring(0, 80) + '...': '[EMPTY]');

    // Get system prompt for title generation
    const systemPrompt = getDetailedSystemPrompt('title_generation'); // Changed from 'concise'
    safeLogger.log('[AIService] System prompt for title_generation:', systemPrompt ? systemPrompt.substring(0,150) + '...': '[EMPTY]');

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: content }
    ];
    safeLogger.log('[AIService] Messages prepared for AI Proxy (title generation):', JSON.stringify(messages, null, 2));

    // Get API config for title generation
    const apiConfig = TITLE_GENERATION_CONFIG;
    safeLogger.log('[AIService] API Config for AI Proxy (title generation):', apiConfig);

    // Call API proxy
    safeLogger.log('[AIService] Calling callAIProxy for title generation...');
    const rawTitleResult = await callAIProxy(messages, apiConfig);
    safeLogger.log('[AIService] callAIProxy RAW result (title generation):', rawTitleResult ? rawTitleResult.substring(0, 100) + '...' : '[EMPTY]');

    // Process the result - 传递原始内容用于语言一致性检查
    const processedTitle = await processTitleResult(rawTitleResult, content);
    safeLogger.log('[AIService] processTitleResult output (title generation):', processedTitle);

    // Increment usage for title generation
    // await incrementUsage(userId, 'title_generation');

    return processedTitle;
  } catch (error) {
    // Handle and convert error
    if (error instanceof AIServiceError) {
      throw error;
    }
    
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[AIService] Title generation failed:', error);
    throw new AIServiceError(
      `Title generation failed: ${message}`,
      'ai-service/title-generation-failed'
    );
  }
}

// --- 辅助函数 ---

/**
 * 确保语言一致性，如果不一致则翻译
 * @param content 处理后内容
 * @param originalContent 原始内容
 * @returns 确保语言一致性的内容
 */
async function ensureLanguageConsistency(content: string, originalContent: string): Promise<string> {
  // 检测原始内容和结果的语言
  const originalLang = detectMainLanguage(originalContent);
  const resultLang = detectMainLanguage(content);
  
  // 如果是其他语言或语言一致，直接返回
  if (originalLang === 'other' || originalLang === resultLang) {
    return content;
  }
  
  // 语言不一致，需要翻译
  console.log(`[AIService] 检测到语言不一致: 原始=${originalLang}, 结果=${resultLang}，进行翻译`);
  safeLogger.log(`[AIService] 检测到语言不一致，原始语言: ${originalLang}, 结果语言: ${resultLang}`);
  
  try {
    // 翻译回原始语言
    const translatedContent = await translateText(content, originalLang);
    safeLogger.log(`[AIService] 翻译完成: 原始长度 ${content.length}, 翻译后长度 ${translatedContent.length}`);
    return translatedContent;
  } catch (error) {
    console.error('[AIService] 翻译失败:', error);
    safeLogger.error('[AIService] 翻译失败:', error);
    // 翻译失败时返回原始响应
    return content;
  }
} 
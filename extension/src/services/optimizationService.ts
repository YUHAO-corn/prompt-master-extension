import { OptimizationMode } from './systemPrompts';
import { optimizePrompt as aiServiceOptimizePrompt, continueOptimization, AIServiceError } from '@/services/utils/aiService';
// Import message types for quota management
import { CHECK_QUOTA, INCREMENT_USAGE } from '@/types/centralState'; 
import { safeLogger } from '@/utils/safeEnvironment'; // Import safeLogger
import { getOptimizationConfig } from '@/services/utils/apiConfigs';
// Import Analytics
import { trackOptimizationUsed, trackFeatureUsage } from '@/services/analytics';
// 新增：导入功能网关服务
import { featureUsageService, FeatureType } from './featureUsage';

// 优化版本类型
export interface OptimizationVersion {
  id: number;
  content: string;
  isLoading?: boolean;
  isNew?: boolean;
  createdAt?: number;
  parentId?: number;
  editedContent?: string;
  isEdited?: boolean;
  position?: number;
}

// 优化选项类型
export interface OptimizeOptions {
  mode?: OptimizationMode;
  temperature?: number;
  maxTokens?: number;
  isToolbar?: boolean; // 新增控制是否为工具栏优化的标志
  isReoptimize?: boolean; // 新增是否为重新优化请求的标志
}

/**
 * 检测内容语言并确保语言一致性
 * @param originalContent 原始提示词内容
 * @param optimizedContent 优化后的内容
 * @returns 修正后的内容
 */
function ensureLanguageConsistency(originalContent: string, optimizedContent: string): string {
  // 简单的语言检测规则
  const isOriginalChinese = /[\u4e00-\u9fa5]/.test(originalContent);
  const isOptimizedChinese = /[\u4e00-\u9fa5]/.test(optimizedContent);
  
  // 如果语言不一致，重新请求优化
  if (isOriginalChinese !== isOptimizedChinese) {
    console.warn('[OptimizationService] 检测到语言不一致，尝试修正');
    
    // 构建更强调语言要求的提示
    const languagePrompt = isOriginalChinese 
      ? "请注意：输入内容是中文，必须用中文回复。请重新优化以下提示词："
      : "IMPORTANT: The input is in English. Please optimize the following prompt in English ONLY:";
    
    // 返回带有明确语言要求的原始内容
    return `${languagePrompt}\n\n${originalContent}`;
  }
  
  return optimizedContent;
}

/**
 * 对模型返回的内容进行标准化处理
 * 确保在存储前格式就已经统一，使所有地方显示一致
 * @param content 模型返回的原始内容
 * @param originalContent 原始提示词内容
 */
function postProcessResponse(content: string, originalContent: string): string {
  // 1. 移除中英文引导语，只匹配内容开头
  let processed = content.replace(/^(优化后的提示词[:：]|以下是优化后的提示词[:：]|优化结果[:：]|以下是[^:：]*优化[^:：]*[:：]|Optimized Prompt[:：]?|Here is the optimized prompt[:：]?|The optimized version[:：]?|Optimized Result[:：]?|Optimization Result[:：]?|Here's the optimized prompt[:：]?)/i, '').trim();
  
  // 2. 检查语言一致性
  processed = ensureLanguageConsistency(originalContent, processed);
  
  // 3. 转换Markdown为人类可读的纯文本
  processed = convertMarkdownToPlainText(processed);
  
  // 4. 处理过多的空行（超过2个连续空行的情况）
  processed = processed.replace(/\n{3,}/g, '\n\n');
  
  // 5. 移除末尾的空行
  processed = processed.replace(/\n+$/g, '');
  
  // 6. 确保开头没有空行
  processed = processed.replace(/^\n+/, '');
  
  return processed;
}

/**
 * 将Markdown格式转换为人类可读的纯文本
 * 处理标题层级、列表、强调语法等
 * @param markdownText Markdown格式的文本
 * @returns 转换后的人类可读纯文本
 */
function convertMarkdownToPlainText(markdownText: string): string {
  // 预处理：处理代码块，防止内部内容被误处理
  markdownText = markdownText.replace(/```[\s\S]*?```/g, (match) => {
    return match.replace(/```(?:.*\n)?([\s\S]*?)```/g, '$1');
  });
  
  // 预处理：识别标题结构并为其添加适当编号
  const lines = markdownText.split('\n');
  const result: string[] = [];
  
  // 标题计数器
  const counters = [0, 0, 0, 0, 0, 0]; // h1-h6的计数器
  let lastLevel = 0; // 上一个标题级别
  let inList = false; // 是否在列表中
  
  // 标题模式正则表达式
  const headingRegex = /^(#{1,6})\s+(.*)$/;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const headingMatch = line.match(headingRegex);
    const isListItem = line.match(/^(\s*)[-*+]|\d+\.\s+/);
    
    // 处理标题
    if (headingMatch) {
      // 如果从列表切换到标题，添加额外空行分隔
      if (inList) {
        result.push('');
        inList = false;
      }
      
      const level = headingMatch[1].length; // 标题级别
      const title = headingMatch[2].trim(); // 标题内容
      
      // 当遇到新的标题时，重置所有更低级别的计数器
      if (level <= lastLevel) {
        for (let j = level; j <= 5; j++) {
          counters[j] = 0;
        }
      }
      
      // 增加当前级别的计数
      counters[level - 1]++;
      lastLevel = level;
      
      // 根据标题级别生成编号
      let prefix = '';
      if (level === 1) {
        // 一级标题不添加编号
        prefix = '';
      } else {
        // 生成多级编号 (如 1., 1.1, 1.1.1)
        prefix = '';
        for (let j = 1; j < level; j++) {
          if (counters[j - 1] > 0) {
            prefix += counters[j - 1] + '.';
          }
        }
        prefix = prefix.replace(/\.$/, '') + ' '; // 移除末尾的点并添加空格
      }
      
      // 替换标题行
      line = prefix + title;
      
      // 在一级标题和前添加空行，保持结构清晰
      if (level === 1 && i > 0) {
        result.push(''); // 在一级标题前添加空行
      }
    } 
    // 处理列表项
    else if (isListItem) {
      inList = true;
      
      // 处理无序列表项
      if (line.match(/^(\s*)[-*+]\s+/)) {
        line = line.replace(/^(\s*)[-*+]\s+/, (match, indentation) => {
          // 保持缩进，替换为圆点
          return indentation + '• ';
        });
      } 
      // 处理有序列表项
      else if (line.match(/^(\s*)\d+\.\s+/)) {
        line = line.replace(/^(\s*)(\d+)\.\s+/, (match, indentation, number) => {
          // 保持缩进和编号
          return indentation + number + '. ';
        });
      }
    } 
    // 空行处理
    else if (line.trim() === '') {
      // 如果不是在列表内的空行，并且前一行不是空行，则保留
      if (!inList || (i > 0 && lines[i-1].trim() !== '')) {
        result.push(line);
      }
      continue; // 跳过后续处理
    } 
    // 结束列表状态
    else {
      inList = false;
    }
    
    // 处理各种Markdown格式
    // 移除粗体和斜体标记
    line = line
      .replace(/\*\*(.*?)\*\*/g, '$1') // 移除粗体
      .replace(/__(.*?)__/g, '$1')     // 移除下划线粗体
      .replace(/\*(.*?)\*/g, '$1')     // 移除斜体
      .replace(/_(.*?)_/g, '$1')       // 移除下划线斜体
      .replace(/`(.*?)`/g, '$1');      // 移除内联代码
    
    result.push(line);
    
    // 在一级标题后添加空行
    if (headingMatch && headingMatch[1].length === 1) {
      result.push(''); // 在一级标题后添加空行
    }
  }
  
  // 最终文本处理
  let resultText = result.join('\n');
  
  // 统一空行处理：确保标题间只有一个空行，内容部分紧凑
  resultText = resultText
    .replace(/\n{3,}/g, '\n\n')      // 将三个以上空行减少为两个
    .replace(/\n+$/g, '')           // 移除末尾空行
    .replace(/^\n+/, '');           // 移除开头空行
  
  return resultText;
}

/**
 * 确保本地定义的 getSystemPrompt 函数被导出，并在所有分支都有返回值
 */
export function getSystemPrompt(mode: OptimizationMode | string): string {
  console.log(`[OptimizationService] 获取系统提示，模式: ${mode}`);
  switch (mode) {
    case 'concise':
      return "Please optimize the following prompt to be more concise, clear, and efficient. Focus on the core intent and remove redundant information.";
    case 'standard':
      return "Please optimize the following prompt to be clearer, more specific, and effective, while maintaining the original intent. You can add details or adjust the structure as appropriate.";
    case 'creative':
      return "Please optimize the following prompt to be more creative, inspiring, and capable of evoking interesting associations. Feel free to diverge ideias or introduce novel perspectives.";
    case 'universal':
      return `# Prompt Optimization Expert Guide (Universal Optimization v3.1)\\n\\n## Core Task\\nYou are a professional prompt optimization expert. Your sole task is to analyze and improve the **prompt** provided by the user (instructions the user intends to send to another AI). The goal is to enhance the prompt's **clarity, structure, specificity, completeness, and overall effectiveness**, thereby helping the user obtain higher-quality, more aetherflow-app-compliant responses from the target AI.\\n\\n**Remember: Your final output must be only the optimized prompt text itself, without any other text.**\\n\\n## Language Requirements\\n- **Strictly maintain** the output language keluarga with the language of the prompt to be optimized (Chinese input for Chinese output, English input for English output).\\n- **Do not** change the original language during the optimization process.\\n\\n## Output Requirements (Extremely Important - Emphasize Again)\\n1.  **Directly output the optimized prompt text.**\\n2.  The output content must **only** be the optimized prompt itself, ready to be copied and used directly.\\n3.  **Absolutely no** introductory phrases (e.g., \"Optimized prompt:\", \"Here is the optimized version:\", etc.).\\n4.  **Absolutely no** custom tags (e.g., \`[Core Task]\`, \`[Key Constraints]\`, etc.).\\n5.  **Absolutely no** explanatory, commentary, analytical, or meta-instructional text.\\n6.  **Allowed** to use standard Markdown format (e.g., lists \`-\`, \`*\`, \`1.\`, bold \`** **\`) **within** the optimized prompt itself to enhance its structure and readability, provided that doing so improves the prompt's quality and effectiveness.\\n\\n## Optimization Principles and Methods (Internal Guidance)\\nFollow these principles during optimization (in order of importance). These are your thinking framework; **do not reflect them in the output**:\\n1.  **Preserve Original Intent**: The original core intent and goal of the user's prompt must be fully preserved. This is the highest priority.\\n2.  **Internal Thinking Steps (Recommended)**:\\n    *   Step 1: Understand the original prompt. What is its core goal? Who is the intended target AI? What is the context?\\n    *   Step 2: Evaluate its quality. What are its strengths? What are its weaknesses (ambiguity, missing information, disorganized structure, overly complex/simple, etc.)?\\n    *   Step 3: Devise an improvement strategy. Which optimization principles (clarity, structure, completeness, efficiency) should be applied? Is it necessary to add roles, examples, constraints? How to balance effectiveness and length?\\n    *   Step 4: Generate the final, clean optimized prompt text.\\n3.  **Enhance Clarity & Specificity**:\\n    *   Eliminate ambiguous statements; use more precise, unambiguous language.\\n    *   If the original prompt is too broad, add specific details, background information, or context as appropriate.\\n    *   Clearly state the requirements for the output (format, length, style, etc.).\\n4.  **Optimize Structure**:\\n    *   Add a clear structure and hierarchical organization, especially for complex tasks. Use Markdown lists, bullet points, etc.\\n    *   Ensure logical flow.\\n5.  **Ensure Completeness**:\\n    *   Assess whether key elements are included. If necessary, consider adding: Role, Examples, Constraints, or negative requirements.\\n6.  **Improve Efficiency**:\\n    *   Remove truly redundant words. Use more concise expressions, but **avoid oversimplification** that leads to information loss.\\n    *   **Balance**: The goal is to find the **most effective** expression, not necessarily the shortest.\\n7.  ** (Optional) Handle Ill-Posed Input**: If the input text is too short, unclear, or does not resemble a prompt, prioritize returning a version that is close to the original with minor structural adjustments, or make only minimal corrections. Avoid excessive guessing or creation.`;
    default:
      console.warn(`[OptimizationService] Unknown optimization mode: ${mode}, using standard mode.`);
      // Default to standard mode if mode is unrecognized
      return "Please optimize the following prompt to be clearer, more specific, and effective, while maintaining the original intent. You can add details or adjust the structure as appropriate.";
      }
}

/**
 * 优化提示词服务 - 使用统一的AI服务
 */
export async function optimizePrompt(
  content: string, 
  mode: OptimizationMode = 'standard',
  userId: string | null,
  options: OptimizeOptions = {}
): Promise<string> {
  console.log(`[OptimizationService] Starting optimization with mode: ${mode}, isToolbar: ${options.isToolbar}, isReoptimize: ${options.isReoptimize}`);
  
  // 使用功能网关包装整个优化流程，这样会自动向SW发送消息
  const result = await featureUsageService.trackFeature(
    FeatureType.PROMPT_OPTIMIZE,
    async () => {
      const optimizationId = `optimization_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      try {
        const result = await aiServiceOptimizePrompt(content, {
          mode,
          isToolbar: options.isToolbar,
          userId,
          isReoptimize: options.isReoptimize
        });
        
        // 🚀 Analytics埋点：优化功能使用成功
        try {
          trackOptimizationUsed(optimizationId, mode);
        } catch (analyticsError) {
          console.error('[Analytics] Failed to track optimization success:', analyticsError);
        }
        
        return result;
        
      } catch (error) {
        // 转换错误为更友好的格式
        if (error instanceof AIServiceError) {
          console.error(`[OptimizationService] AI Service error: ${error.code} - ${error.message}`);
          
          // 根据错误代码提供更具体的错误信息
          if (error.code === 'ai-service/empty-content') {
            throw new Error('提示词内容不能为空');
          } else if (error.code === 'ai-service/quota-check-failed') {
            throw new Error('配额检查失败，请稍后重试');
          } else if (error.code === 'ai-service/optimization-failed') {
            throw new Error(`优化失败: ${error.message}`);
          } else {
            throw new Error(`优化服务错误: ${error.message}`);
          }
        } else {
          // 处理其他未知错误
          console.error('[OptimizationService] Unknown error during optimization:', error);
          const errorMessage = error instanceof Error ? error.message : '未知错误';
          throw new Error(`优化失败: ${errorMessage}`);
        }
      }
    },
    {
      metadata: {
        mode,
        isToolbar: options.isToolbar,
        isReoptimize: options.isReoptimize,
        contentLength: content.length,
        userId
      }
    }
  );
  
  return result.data as string;
}

/**
 * 基于现有版本继续优化提示词 - 使用统一的AI服务
 */
export async function continueOptimize(
  content: string,
  mode: OptimizationMode = 'standard',
  userId: string | null = null,
  options: OptimizeOptions = {}
): Promise<string> {
  console.log(`[OptimizationService] Starting continue optimization with mode: ${mode}, isToolbar: ${options.isToolbar}`);
  
  // 使用功能网关包装继续优化流程，这样会自动向SW发送消息
  const result = await featureUsageService.trackFeature(
    FeatureType.PROMPT_OPTIMIZE, // 使用相同的功能类型，通过isReoptimize标志区分
    async () => {
      try {
        return await continueOptimization(content, {
          mode,
          isToolbar: options.isToolbar,
          userId
        });
      } catch (error) {
        // 转换错误为更友好的格式
        if (error instanceof AIServiceError) {
          console.error(`[OptimizationService] AI Service error in continue: ${error.code} - ${error.message}`);
          
          // 根据错误代码提供更具体的错误信息
          if (error.code === 'ai-service/empty-content') {
            throw new Error('提示词内容不能为空');
          } else if (error.code.includes('quota')) {
            throw new Error('配额检查失败，请稍后重试');
          } else {
            throw new Error(`继续优化失败: ${error.message}`);
          }
        } else {
          // 处理其他未知错误
          console.error('[OptimizationService] Unknown error during continue optimization:', error);
          const errorMessage = error instanceof Error ? error.message : '未知错误';
          throw new Error(`继续优化失败: ${errorMessage}`);
        }
      }
    },
    {
      metadata: {
        mode,
        isToolbar: options.isToolbar,
        isReoptimize: true, // 继续优化标记为re-optimize
        contentLength: content.length,
        userId
      }
    }
  );
  
  return result.data as string;
}

// 仅在非生产环境使用，用于测试Markdown转换功能
export function testMarkdownConversion(markdownText: string): string {
  // 这个函数保留原有实现，因为它是测试辅助功能
  throw new Error('当前版本不再支持此功能');
}

// 测试函数：用于测试移除引导语和Markdown转换
export function testProcessingFunctions(content: string): {
  afterRemovingPrefixes: string;
  finalResult: string;
} {
  // 这个函数保留原有实现，因为它是测试辅助功能
  throw new Error('当前版本不再支持此功能');
} 
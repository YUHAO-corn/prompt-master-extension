/**
 * 语言工具函数
 * 提供语言检测和翻译功能
 */

/**
 * 语言类型
 */
export type LanguageType = 'zh' | 'en' | 'ja' | 'ko' | 'ru' | 'fr' | 'de' | 'es' | 'other';

/**
 * 检测文本的主要语言
 * @param text 需要检测的文本
 * @returns 检测到的语言类型
 */
export function detectMainLanguage(text: string): LanguageType {
  if (!text || text.trim() === '') {
    return 'other';
  }

  // 去除数字、标点符号和空格等通用字符
  const cleanText = text.replace(/[0-9\s\p{P}]/gu, '');
  if (!cleanText) {
    return 'other';
  }
  
  // 各语言特征检测
  const langPatterns: Record<LanguageType, RegExp> = {
    zh: /[\u4e00-\u9fa5]/g,             // 中文
    en: /[a-zA-Z]{2,}/g,                // 英文
    ja: /[\u3040-\u30FF\u3400-\u4DBF]/g, // 日文(平假名、片假名及部分汉字)
    ko: /[\uAC00-\uD7A3]/g,             // 韩文
    ru: /[\u0400-\u04FF]/g,             // 俄文
    fr: /[çéàèùâêîôûëïüÿæœ]/gi,         // 法文特殊字符
    de: /[äöüßÄÖÜ]/g,                   // 德文特殊字符
    es: /[áéíóúüñ¿¡]/gi,                // 西班牙文特殊字符
    other: /./g                         // 默认匹配任何字符(不会用于实际检测)
  };
  
  // 计算各语言字符出现次数
  const charCounts: Record<LanguageType, number> = {
    zh: 0, en: 0, ja: 0, ko: 0, ru: 0, fr: 0, de: 0, es: 0, other: 0
  };
  
  // 特殊处理英文计数方式
  const englishWords = (cleanText.match(langPatterns.en) || []).join('').length;
  charCounts.en = englishWords;
  
  // 其他语言按字符计数
  Object.entries(langPatterns).forEach(([lang, pattern]) => {
    if (lang !== 'en' && lang !== 'other') {
      charCounts[lang as LanguageType] = (cleanText.match(pattern) || []).length;
    }
  });
  
  // 中文优先级特殊处理：如果有大量中文字符且远多于其他语言，则认为是中文
  if (charCounts.zh > 3 && charCounts.zh >= charCounts.ja * 2) {
    return 'zh';
  }
  
  // 找出最多字符的语言
  let dominantLang: LanguageType = 'other';
  let maxCount = 0;
  
  Object.entries(charCounts).forEach(([lang, count]) => {
    if (count > maxCount) {
      maxCount = count;
      dominantLang = lang as LanguageType;
    }
  });
  
  // 如果没有明显的主导语言，且有英文内容，则返回英文
  if (dominantLang === 'other' && charCounts.en > 0) {
    return 'en';
  }
  
  return dominantLang;
}

/**
 * 翻译服务接口
 * 定义所有翻译服务的共同方法
 */
interface TranslationService {
  name: string;
  translate(text: string, targetLang: LanguageType): Promise<string>;
}

/**
 * Google非官方翻译API服务
 */
class GoogleFreeTranslation implements TranslationService {
  name = 'GoogleFreeAPI';
  
  async translate(text: string, targetLang: LanguageType): Promise<string> {
    try {
      // 使用免费的Google翻译API
      const apiUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`API返回错误: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Google翻译API返回的数据结构比较特殊
      let translatedText = '';
      if (data && data[0]) {
        data[0].forEach((item: any) => {
          if (item[0]) {
            translatedText += item[0];
          }
        });
      }
      
      return translatedText || text;
    } catch (error) {
      console.error('[GoogleFreeAPI] 翻译失败:', error);
      throw error;
    }
  }
}

/**
 * MyMemory翻译API服务
 */
class MyMemoryTranslation implements TranslationService {
  name = 'MyMemoryAPI';
  
  async translate(text: string, targetLang: LanguageType): Promise<string> {
    try {
      const langCode = targetLang === 'zh' ? 'zh-CN' : targetLang;
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|${langCode}`;
      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error(`API返回错误: ${res.status}`);
      }
      
      const data = await res.json();
      return data.responseData?.translatedText || text;
    } catch (error) {
      console.error('[MyMemoryAPI] 翻译失败:', error);
      throw error;
    }
  }
}

/**
 * Lingva翻译API服务
 */
class LingvaTranslation implements TranslationService {
  name = 'LingvaAPI';
  
  async translate(text: string, targetLang: LanguageType): Promise<string> {
    try {
      const url = `https://lingva.ml/api/v1/auto/${targetLang}/${encodeURIComponent(text)}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`API返回错误: ${response.status}`);
      }
      
      const data = await response.json();
      return data.translation || text;
    } catch (error) {
      console.error('[LingvaAPI] 翻译失败:', error);
      throw error;
    }
  }
}

/**
 * AI备用翻译服务 - 当所有免费API都失败时使用
 * 使用同一个AI服务进行翻译，成本低于专业翻译API
 */
class AIBackupTranslation implements TranslationService {
  name = 'AIBackupTranslation';
  
  async translate(text: string, targetLang: LanguageType): Promise<string> {
    try {
      // 此处使用已有的AI服务接口
      // 导入可能因项目结构而变化，请根据实际情况调整
      const { callAIProxy } = require('../services/utils/aiProxyClient');
      
      // 构建简单的翻译提示词
      const langName = this.getLangName(targetLang);
      const messages = [
        { 
          role: 'system' as const, 
          content: `你是一个专业翻译助手。请将用户的文本准确翻译成${langName}，保持原文的格式和结构，不要添加任何解释或额外内容。` 
        },
        { 
          role: 'user' as const, 
          content: text 
        }
      ];
      
      // 翻译配置 - 使用较低温度以确保准确性
      const config = {
        temperature: 0.3,
        max_tokens: Math.max(text.length * 2, 500), // 预估输出长度
        model: 'qwen-turbo' // 使用成本较低的模型
      };
      
      console.log('[AIBackupTranslation] 正在使用AI服务进行翻译...');
      const result = await callAIProxy(messages, config);
      return result || text;
    } catch (error) {
      console.error('[AIBackupTranslation] 翻译失败:', error);
      throw error;
    }
  }
  
  // 获取语言的中文名称，用于提示词
  private getLangName(lang: LanguageType): string {
    const langNames: Record<LanguageType, string> = {
      zh: '中文',
      en: '英文',
      ja: '日语',
      ko: '韩语',
      ru: '俄语',
      fr: '法语',
      de: '德语',
      es: '西班牙语',
      other: '原语言'
    };
    return langNames[lang] || '原语言';
  }
}

/**
 * 翻译管理器
 * 按顺序尝试各种翻译服务，直到获得结果
 */
class TranslationManager {
  private services: TranslationService[] = [];
  
  constructor() {
    // 按可靠性顺序添加翻译服务
    this.services.push(new GoogleFreeTranslation());
    this.services.push(new MyMemoryTranslation());
    this.services.push(new LingvaTranslation());
    this.services.push(new AIBackupTranslation());
  }
  
  /**
   * 尝试所有翻译服务，直到成功获取翻译结果
   */
  async translate(text: string, targetLang: LanguageType): Promise<string> {
    // 记录是否使用了AI备用翻译
    let usedAIBackup = false;
    
    for (const service of this.services) {
      try {
        console.log(`[TranslationManager] 尝试使用 ${service.name} 服务...`);
        const result = await service.translate(text, targetLang);
        
        if (result && result !== text) {
          // 如果是AI备用翻译，记录日志
          if (service.name === 'AIBackupTranslation') {
            usedAIBackup = true;
            console.log('[TranslationManager] 所有API翻译失败，使用AI备用翻译成功');
          } else {
            console.log(`[TranslationManager] ${service.name} 翻译成功`);
          }
          return result;
        }
      } catch (error) {
        console.warn(`[TranslationManager] ${service.name} 翻译失败:`, error);
        // 继续尝试下一个服务
      }
    }
    
    // 如果所有服务都失败，返回原文
    console.error('[TranslationManager] 所有翻译服务都失败，返回原文');
    return text;
  }
}

// 创建单例翻译管理器
const translationManager = new TranslationManager();

/**
 * 翻译文本，带备用API机制
 * @param text 要翻译的文本
 * @param targetLang 目标语言
 * @returns 翻译后的文本
 */
export async function translateText(text: string, targetLang: LanguageType): Promise<string> {
  // 如果目标语言不是zh或en，转换为en以确保API支持
  const normalizedTargetLang = (targetLang !== 'zh' && targetLang !== 'en') ? 'en' : targetLang;
  
  // 如果目标语言是other，直接返回原文
  if (targetLang === 'other') {
    return text;
  }
  
  // 使用翻译管理器进行翻译
  return await translationManager.translate(text, normalizedTargetLang);
} 
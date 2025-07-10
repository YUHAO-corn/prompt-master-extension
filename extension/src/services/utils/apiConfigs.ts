import { OptimizationMode } from '../systemPrompts';

/**
 * 集中管理API调用参数配置
 * 针对不同功能提供特定的参数设置
 */

// 自动标题生成配置
export const TITLE_GENERATION_CONFIG = {
  max_tokens: 60,
  temperature: 0.3,
  top_p: 0.9,
  frequency_penalty: 0.1,
};

// 工具栏优化功能配置
export const TOOLBAR_OPTIMIZATION_CONFIG = {
  max_tokens: 200,
  temperature: 0.4,
  top_p: 0.9,
  frequency_penalty: 0.2,
};

// 侧边栏优化功能配置
export const SIDEBAR_OPTIMIZATION_CONFIG = {
  max_tokens: 200,
  temperature: 0.5,
  top_p: 0.9,
  frequency_penalty: 0.2,
};

/**
 * 根据优化模式获取适当的配置
 * @param mode 优化模式
 * @param isToolbar 是否为工具栏优化（默认为侧边栏）
 * @returns 对应的API调用参数
 */
export function getOptimizationConfig(mode: OptimizationMode, isToolbar: boolean = false) {
  // 基础配置（使用工具栏或侧边栏的默认配置）
  const baseConfig = isToolbar ? TOOLBAR_OPTIMIZATION_CONFIG : SIDEBAR_OPTIMIZATION_CONFIG;
  
  // 根据模式调整参数
  switch (mode) {
    case 'creative':
      // 创意模式使用更高的温度
      return {
        ...baseConfig,
        temperature: 0.6, // 增加随机性
        frequency_penalty: 0.1, // 降低频率惩罚以允许更多创意
      };
    case 'concise':
      // 简洁模式使用更低的温度和更高的频率惩罚
      return {
        ...baseConfig,
        temperature: 0.3, // 降低随机性
        frequency_penalty: 0.3, // 增加频率惩罚以减少重复
        max_tokens: 150,
      };
    case 'standard':
    default:
      // 标准模式使用默认配置
      return baseConfig;
  }
} 
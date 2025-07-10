// 导出主要的服务
export { featureUsageService, FeatureUsageService } from './service';

// 导出类型定义和枚举
export { FeatureType } from './types';
export type { FeatureUsageRecord, FeatureUsageResult, FeatureUsageOptions, FeatureExecutor } from './types';

// 导出便捷的使用方法
export { featureUsageService as default } from './service'; 
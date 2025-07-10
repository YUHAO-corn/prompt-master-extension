# FeatureUsageService - 功能使用追踪服务

这个服务专注于记录功能使用情况，用于数据分析和奖励系统。

## 核心功能

1. **使用追踪** - 记录功能使用情况用于分析和奖励系统
2. **零侵入** - 包装现有功能而不修改其实现和错误处理
3. **错误隔离** - 追踪失败不影响原有功能执行

## 基本使用

### 在服务层使用

```typescript
import { featureUsageService, FeatureType } from '@/services/featureUsage';

// 包装现有功能
async function optimizePrompt(content: string) {
  return await featureUsageService.trackFeature(
    FeatureType.PROMPT_OPTIMIZE,
    async () => {
      // 原有的优化逻辑，完全不变
      return await originalOptimizeFunction(content);
    },
    {
      metadata: { contentLength: content.length }
    }
  );
}

// 或者使用便捷包装器
const trackedOptimize = featureUsageService.wrapFunction(
  FeatureType.PROMPT_OPTIMIZE,
  () => originalOptimizeFunction(content)
);
```

### 在React组件中使用

```typescript
import { useFeatureUsage } from '@/hooks/useFeatureUsage';
import { FeatureType } from '@/services/featureUsage';

function OptimizeButton() {
  const { trackFeature, wrapFeature } = useFeatureUsage();
  
  // 方法1：直接追踪
  const handleOptimize = async () => {
    try {
      const result = await trackFeature(
        FeatureType.PROMPT_OPTIMIZE,
        async () => await optimizePrompt(content)
      );
      setOptimizedContent(result.data);
    } catch (error) {
      setError(error.message);
    }
  };
  
  // 方法2：包装现有函数
  const wrappedOptimize = wrapFeature(
    FeatureType.PROMPT_OPTIMIZE,
    async () => await optimizePrompt(content),
    { metadata: { source: 'button_click' } }
  );
  
  return <button onClick={wrappedOptimize}>优化</button>;
}
```

## 支持的功能类型

当前支持的功能类型（在 `types.ts` 中定义）：

- `PROMPT_CREATE` - 创建提示词
- `PROMPT_OPTIMIZE` - 优化提示词
- `PROMPT_SHORTCUT` - 快捷输入
- `PROMPT_EXPORT` - 导出提示词
- `PROMPT_FAVORITE` - 收藏提示词
- `PROMPT_USE` - 使用提示词
- `CLOUD_SYNC` - 云同步

## 配置选项

```typescript
interface FeatureUsageOptions {
  skipTracking?: boolean;       // 跳过使用追踪
  metadata?: Record<string, any>; // 额外的追踪数据
}
```

## 集成步骤

### 1. 包装现有功能

找到功能的调用入口点，用 `featureUsageService.trackFeature()` 包装：

```typescript
// 原有代码
const result = await optimizePrompt(content);

// 包装后
const result = await featureUsageService.trackFeature(
  FeatureType.PROMPT_OPTIMIZE,
  () => optimizePrompt(content)
);
```

### 2. 添加新功能类型

如需追踪新功能，在 `types.ts` 中添加：

```typescript
export enum FeatureType {
  // ... 现有类型
  NEW_FEATURE = 'new_feature',
}
```

### 3. 添加追踪元数据

为分析提供更多上下文信息：

```typescript
await featureUsageService.trackFeature(
  FeatureType.PROMPT_EXPORT,
  () => exportPrompts(),
  {
    metadata: { 
      format: 'json',
      count: prompts.length,
      source: 'settings_page'
    }
  }
);
```

## 数据流程

```
用户操作 → FeatureUsageService → 执行原有功能 → 记录使用数据 → 返回结果
```

## 特点

1. **不管认证** - 各功能自行处理用户认证和权限
2. **不修改原有逻辑** - 所有现有功能代码保持不变
3. **错误处理** - 追踪失败不会影响功能执行
4. **性能影响** - 最小化，主要是异步的数据记录
5. **渐进集成** - 可以逐个功能地添加追踪

## 获得的数据

通过这个服务，你可以获得：

- **功能使用频率** - 哪些功能最受欢迎
- **用户行为模式** - 用户如何使用你的产品
- **成功率统计** - 功能执行的成功/失败比例
- **奖励系统基础** - "使用10次优化功能获得3天会员"

## 未来扩展

- 本地缓存使用数据
- 批量上报到后端分析服务
- 用户行为分析和推荐
- 与会员系统集成的配额管理 
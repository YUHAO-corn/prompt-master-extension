# 配置服务 (Config Service)

这个服务用于安全管理API密钥、环境配置和会员限制，避免在代码中硬编码敏感信息。

## 设计理念

- **环境隔离**：自动区分开发和生产环境
- **安全性**：敏感信息不直接硬编码在源代码中
- **集中管理**：所有配置集中在一处，便于维护
- **类型安全**：所有配置都有适当的类型定义

## 使用方法

在需要使用配置的地方，导入并使用`configService`：

```typescript
import { configService } from '../../services/config';

// 获取当前环境
const env = configService.getEnvironment();

// 获取Paddle配置
const vendorId = configService.getPaddleVendorId();
const monthlyProductId = configService.getPaddleProductIdMonthly();

// 获取会员限制
const userLimits = configService.getMembershipLimits(isProUser);
const maxPrompts = userLimits.maxPrompts;
```

## 配置修改方法

为了安全起见，配置值存储在`configMap`中，如需修改请直接编辑`index.ts`文件中的配置映射：

```typescript
private readonly configMap: Record<string, Record<'development' | 'production', any>> = {
  // Paddle配置
  PADDLE_VENDOR_ID: {
    development: '33333', // 开发环境ID - 替换为开发环境Vendor ID
    production: '33333'   // 生产环境ID - 替换为生产环境Vendor ID
  },
  // 其他配置...
};
```

修改时请确保：
1. 保留开发环境和生产环境的区分
2. 敏感密钥不要提交到公共代码仓库
3. 更新后在开发环境测试配置是否正确

## 会员限制配置

会员限制配置定义在`membershipLimits`对象中：

```typescript
private readonly membershipLimits = {
  free: {
    maxPrompts: 5,              // 免费版最多5条提示词
    dailyOptimizations: 3,       // 每天3次优化
    canExport: false,            // 不能导出
    hasPrioritySupport: false    // 无优先支持
  },
  pro: {
    maxPrompts: 100,             // Pro版最多100条提示词
    dailyOptimizations: 50,      // 每天50次优化
    canExport: true,             // 可以导出
    hasPrioritySupport: true     // 有优先支持
  }
};
```

## 测试配置

可以使用`test.ts`文件来测试配置是否正确：

```typescript
import { testConfigService } from '../../services/config/test';

// 执行测试，会在控制台打印配置信息
testConfigService();
```

## 注意事项

- 配置服务自动检测当前环境，无需手动指定
- 敏感信息（如API密钥）在日志中会被部分掩盖，以保护安全
- 如果新增配置项，请同时在`ConfigService`接口中添加相应的方法 
# 会员状态管理服务 (MembershipService)

## 概述

会员状态管理服务负责管理AetherFlow应用中的会员状态，包括状态存储、验证、同步和权限检查等功能。该服务是付费功能的核心组件，确保会员权益能够正确地应用于应用的各个功能模块。

## 主要功能

- **会员状态管理**：存储、更新和检索用户会员状态
- **状态同步**：在本地和服务器(Firestore)之间同步会员状态
- **权限检查**：提供各种API检查用户的会员权限(如Pro会员、配额等)
- **自动验证**：定期自动验证会员状态，确保状态的准确性
- **支付处理**：处理成功支付后的状态更新
- **降级处理**：处理会员到期或取消的降级流程
- **开发测试工具**：提供开发环境下的会员状态模拟切换功能

## 数据结构

核心数据结构 `MembershipState`：

```typescript
interface MembershipState {
  // 会员状态: free(免费), pro(专业版), trial(试用)
  status: 'free' | 'pro' | 'trial';
  
  // 订阅计划: monthly(月付), annual(年付), 未订阅为null
  plan: 'monthly' | 'annual' | null;
  
  // 当前订阅开始时间戳
  startedAt: number | null;
  
  // 当前订阅结束时间戳(下次续费日)
  expiresAt: number | null;
  
  // 是否在当前周期结束后取消
  cancelAtPeriodEnd: boolean;
  
  // 上次验证时间(本地状态刷新时间)
  lastVerifiedAt: number;
  
  // 订阅ID(支付平台返回)
  subscriptionId: string | null;
  
  // 客户ID(支付平台返回)
  customerId: string | null;
}
```

会员权益配额 `MembershipQuota`：

```typescript
interface MembershipQuota {
  // 最大提示词数量
  maxPrompts: number;
  
  // 每日优化次数上限
  dailyOptimizations: number;
  
  // 是否能使用导出功能
  canExport: boolean;
  
  // 是否有优先支持特权
  hasPrioritySupport: boolean;
}
```

## 主要API

### 状态管理

- `getCurrentMembership()`: 获取当前会员状态
- `isProMember()`: 检查用户是否为Pro会员
- `updateMembershipState(updates)`: 更新会员状态
- `refreshMembershipState()`: 刷新会员状态(从服务器同步)

### 支付处理

- `handleSuccessfulPayment(paymentData)`: 处理成功支付
- `handleMembershipExpiration()`: 处理会员到期

### 权益配额

- `getMembershipQuota()`: 获取会员权益配额信息

### 状态监听

- `onMembershipChange(callback)`: 订阅会员状态变化事件

### 开发工具 (仅开发环境)

- `_devSetProMembership()`: 切换为Pro会员状态
- `_devSetFreeMembership()`: 切换为免费会员状态
- `_devSetExpiringSoon()`: 模拟会员即将到期

## 使用示例

获取会员状态:

```typescript
import { membershipService } from '../services/membership';

async function checkMembership() {
  const membershipState = await membershipService.getCurrentMembership();
  console.log('当前会员状态:', membershipState.status);
  
  const isPro = await membershipService.isProMember();
  console.log('是否为Pro会员:', isPro);
}
```

监听状态变化:

```typescript
const unsubscribe = membershipService.onMembershipChange((state) => {
  console.log('会员状态已更新:', state);
  // 更新UI或执行其他操作
});

// 取消监听
unsubscribe();
```

处理支付成功:

```typescript
await membershipService.handleSuccessfulPayment({
  subscriptionId: 'sub_12345',
  customerId: 'cus_12345',
  plan: 'monthly',
  expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30天后
});
```

获取会员配额:

```typescript
const quota = await membershipService.getMembershipQuota();
console.log(`最大提示词数量: ${quota.maxPrompts}`);
console.log(`每日优化次数: ${quota.dailyOptimizations}`);
```

## 架构说明

### 本地与服务器同步

会员状态同时存储在本地(Chrome Storage)和服务器(Firestore)中:

1. **本地优先**: 所有操作首先更新本地状态，确保离线可用
2. **后台同步**: 状态变更后在后台异步同步到服务器
3. **定期验证**: 系统会定期(默认24小时)从服务器验证会员状态
4. **网络恢复**: 当网络从离线恢复时，尝试同步最新状态

### 状态变更通知

使用观察者模式允许UI组件订阅会员状态变更:

1. **防抖处理**: 使用防抖技术避免短时间内频繁通知
2. **错误隔离**: 单个观察者的错误不会影响其他观察者
3. **状态广播**: 任何状态变更自动广播给所有观察者

## 未来计划

- 支持多设备同步冲突解决
- 添加会员即将到期通知
- 实现更细粒度的权限控制
- 支持不同级别的会员计划 
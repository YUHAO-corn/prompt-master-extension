# AetherFlow 组件库

## 组件结构

AetherFlow项目采用简洁的组件结构：

1. `common/` - 通用基础UI组件
   - 可重用的UI元素，如Button、Card、Input等
   - 可在任何页面和业务组件中使用

2. `pages/sidepanel/components/` - 业务组件
   - 特定于功能的组件，如LibraryTab、OptimizeSection等
   - 包含具体业务逻辑的实现

## 组件使用指南

### 1. 通用组件

通用组件应该：
- 不包含特定业务逻辑
- 保持高度可复用性
- 有良好的接口设计
- 有相应的测试

使用示例：
```tsx
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';

function MyComponent() {
  return (
    <Card>
      <h2>My Card Content</h2>
      <Button>Click Me</Button>
    </Card>
  );
}
```

### 2. 业务组件

业务组件应该：
- 在适当的页面目录下
- 可以引用通用组件
- 包含特定业务逻辑
- 维护自己的状态

## 重构历史

此组件结构是经过重构简化的结果：

1. 已移除的目录：
   - `components/library/` - 已迁移到pages/sidepanel/components
   - `components/optimize/` - 已迁移到pages/sidepanel/components
   - `components/navigation/` - 已迁移到pages/sidepanel/components

2. 主要变更：
   - 将业务逻辑从通用组件库中分离
   - 减少冗余和重复实现
   - 简化组件引用关系
   - 提高代码可维护性

## 未来开发指南

1. 添加新的通用UI组件
   - 放在`components/common/`目录下
   - 遵循现有设计模式
   - 编写适当的测试
   - 确保无业务逻辑依赖

2. 添加新的业务组件
   - 放在正确的页面目录下，如`pages/sidepanel/components/`
   - 可以使用通用组件构建
   - 避免在业务组件之间形成复杂依赖 
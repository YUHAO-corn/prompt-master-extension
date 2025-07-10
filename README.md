# 🌊 Prompt Master Extension

> **Your Prompts, All In One Place. Everywhere.**  
> **让您的提示词，随处可见，随时可用**

**[English](README_EN.md) | 中文**

一款专为 AI 重度用户设计的 Chrome 浏览器扩展，致力于解决提示词管理效率低下的核心痛点。通过提供提示词快捷输入、智能库管理和 AI 驱动优化功能，打造完整的提示词生命周期管理生态系统。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Extension-green.svg)](https://chrome.google.com/webstore)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)

---

## 🎯 产品价值主张

### 核心痛点分析
在AI时代，用户面临着四大核心痛点：
- **🔍 提示词遗失**：优质提示词散落各平台，难以统一管理
- **⏰ 重复输入低效**：相似场景需重复编写类似提示词  
- **📉 质量参差不齐**：自创提示词效果不稳定，缺乏优化指导
- **🔄 跨平台困难**：不同AI平台间无法共享提示词库

### 解决方案设计
Prompt Master Extension 通过"保存→管理→优化→使用"的完整闭环，为用户提供：

**🚀 即时访问** - 任意网页按 \`/\` 快速调用提示词库  
**📚 智能管理** - 云端同步的分类标签系统  
**🤖 AI优化** - 基于大语言模型的提示词质量提升  
**🌐 全平台兼容** - 支持ChatGPT、Claude、Gemini等50+平台

---

## ✨ 产品功能特性

### 🚀 快捷输入系统
- **一键触发**：在任何输入框输入 \`/\` 即可调用提示词库
- **智能搜索**：实时关键词匹配，基于使用频率智能排序
- **无缝插入**：选择即插入，支持键盘和鼠标操作
- **响应迅速**：本地优化，响应时间 < 200ms

### 📚 智能库管理
- **一键保存**：选中网页文本即可保存为提示词
- **自动分类**：AI驱动的智能标题生成和内容摘要
- **多维检索**：支持搜索、排序、过滤、收藏等多种操作
- **使用统计**：跟踪提示词使用频次和效果

### 🤖 AI驱动优化
- **智能分析**：基于大语言模型分析提示词结构和逻辑
- **多策略优化**：提供简洁性、专业性、创意性等不同优化方向
- **版本管理**：支持多轮优化和历史版本对比
- **最佳实践**：内置提示词工程最佳实践指导

### ☁️ 云端同步 (Pro)
- **跨设备访问**：所有设备实时同步提示词库
- **数据安全**：端到端加密，保障用户隐私
- **离线支持**：网络异常时仍可正常使用
- **备份恢复**：自动备份，防止数据丢失

---

## 🏗️ 技术架构设计

### 系统架构概览

采用现代化分布式架构，确保高可用性、可扩展性和优秀用户体验：

\`\`\`mermaid
graph TB
    subgraph "用户环境"
        User["👤 用户"]
        Browser["🌐 浏览器"]
        AI_Sites["🤖 AI平台<br/>(ChatGPT, Claude, Gemini)"]
    end

    subgraph "Aetherflow Chrome Extension"
        Content["📄 Content Script<br/>- 快捷输入检测<br/>- DOM操作<br/>- 提示词插入"]
        Sidepanel["📱 Side Panel<br/>- 提示词库管理<br/>- 提示词优化<br/>- 用户界面"]
        Background["⚙️ Background Script<br/>- 状态管理<br/>- 消息路由<br/>- 数据同步"]
        LocalStorage["💾 Chrome Storage<br/>- 本地数据缓存<br/>- 离线支持"]
    end

    subgraph "Backend Services"
        NodeJS["🚀 Node.js + Express<br/>- API代理<br/>- 认证处理"]
        Firebase["🔥 Firebase<br/>- 用户认证<br/>- 数据存储"]
        AI_API["🧠 AI Optimization API<br/>- 提示词优化<br/>- 内容分析"]
        Paddle["💳 Paddle<br/>- 支付处理<br/>- 订阅管理"]
    end

    %% 用户交互
    User -->|使用| Browser
    Browser -->|访问| AI_Sites
    User -->|安装使用| Content
    User -->|管理设置| Sidepanel

    %% 扩展内部通信
    Content <-->|消息通信| Background
    Sidepanel <-->|消息通信| Background
    Background <-->|数据操作| LocalStorage

    %% 扩展与后端通信
    Background <-->|API调用| NodeJS
    Sidepanel -->|跳转支付| Paddle

    %% 后端服务连接
    NodeJS <-->|用户认证| Firebase
    NodeJS <-->|数据存储| Firebase
    NodeJS <-->|AI服务| AI_API

    %% 数据同步
    Firebase -.->|实时同步| Background
\`\`\`

### 前端组件架构

\`\`\`mermaid
graph TB
    subgraph "用户界面层 (UI Layer)"
        App["📱 App.tsx<br/>主应用入口"]
        LibraryTab["📚 LibraryTab<br/>提示词库界面"]
        OptimizerTab["🎯 OptimizerTab<br/>优化功能界面"]
        MembershipCenter["⭐ MembershipCenter<br/>会员中心"]
        QuickCommand["⚡ QuickCommand<br/>快捷输入组件"]
    end

    subgraph "业务逻辑层 (Business Logic)"
        usePromptsData["🪝 usePromptsData<br/>提示词数据管理"]
        useAuth["🔐 useAuth<br/>用户认证状态"]
        useMembership["💎 useMembership<br/>会员状态管理"]
        useQuota["📊 useQuota<br/>配额管理"]
        useOptimize["🎯 useOptimize<br/>优化功能"]
    end

    subgraph "服务层 (Service Layer)"
        StorageService["💾 StorageService<br/>数据存储抽象"]
        AuthService["🔐 AuthService<br/>认证服务"]
        OptimizationService["🧠 OptimizationService<br/>优化服务"]
        MessagingService["📨 MessagingService<br/>消息通信"]
    end

    subgraph "数据层 (Data Layer)"
        ChromeStorage["🗄️ ChromeStorage<br/>本地存储实现"]
        CloudStorage["☁️ CloudStorage<br/>云端存储同步"]
        FirestoreListener["🔥 FirestoreListener<br/>实时数据监听"]
    end

    %% 连接关系
    App --> LibraryTab
    App --> OptimizerTab
    App --> MembershipCenter
    LibraryTab --> usePromptsData
    OptimizerTab --> useOptimize
    MembershipCenter --> useMembership
    usePromptsData --> StorageService
    useAuth --> AuthService
    useOptimize --> OptimizationService
    StorageService --> ChromeStorage
    StorageService --> CloudStorage
    CloudStorage --> FirestoreListener
\`\`\`

### 技术栈选择

**前端 (Chrome Extension)**
- **框架**: React 18 + TypeScript - 现代化开发体验
- **构建**: Webpack 5 - Chrome Extension优化配置  
- **样式**: Tailwind CSS - 快速响应式设计
- **状态**: Context + Hooks - 轻量级状态管理
- **认证**: Firebase Auth - 企业级用户认证

**后端 (API Server)**  
- **运行时**: Node.js + Express - 高性能异步处理
- **语言**: TypeScript - 类型安全和开发效率
- **数据库**: Firebase Firestore - NoSQL文档数据库
- **认证**: Firebase Admin SDK - 服务端认证验证

**基础设施**
- **云服务**: Google Cloud Platform - 企业级稳定性
- **数据库**: Firebase Firestore - 自动扩展和实时同步  
- **认证**: Firebase Authentication - 支持多种登录方式
- **支付**: Paddle - 全球订阅支付解决方案

---

## 💼 商业模式与市场策略

### 用户画像分析

通过深度市场调研，我们识别出四大核心用户群体：

| 用户群体 | 占比 | 核心需求 | 付费意愿 |
|---------|------|----------|----------|
| **内容创作者 & 营销人员** | 35% | 高效生成营销文案，跨平台复用 | 高 |
| **开发者 & 工程师** | 25% | 技术文档和编程辅助，精确提示词 | 中高 |  
| **学生 & 研究人员** | 20% | 学术研究辅助，知识管理 | 中 |
| **商务专业人员** | 20% | 商务沟通优化，专业领域提示词 | 高 |

### 竞品分析与差异化

| 竞品 | 用户规模 | 核心局限 | 我们的优势 |
|------|----------|----------|------------|
| AI Prompt Genius | 100k+ | ❌ 无优化功能，平台兼容性有限 | ✅ AI驱动优化 + 全平台兼容 |
| Prompt Perfect | 8k+ | ❌ 仅支持特定AI平台 | ✅ 支持50+平台，完整功能闭环 |
| Teleprompt AI | 7k+ | ❌ 功能单一，无管理功能 | ✅ 完整生命周期管理 |

### 免费增值策略

采用"轻量级模式 → 价值体验 → 付费转化"的增长策略：

| 功能模块 | 轻量级模式 (免费) | Pro模式 (\$9.99/月) |
|----------|------------------|-------------------|
| **提示词存储** | 50条限制 | 无限制 |
| **快捷输入** | ✅ 完整功能 | ✅ 完整功能 |
| **AI优化** | 每日20次限制 | 无限制 |
| **云端同步** | ❌ 仅本地存储 | ✅ 跨设备同步 |
| **高级管理** | ❌ 基础功能 | ✅ 标签、分类等 |

---

## 🚀 快速开始

### 用户使用指南

1. **安装扩展**
   \`\`\`bash
   # 从Chrome Web Store安装 (即将上线)
   # 或从源码构建 (见下方开发指南)
   \`\`\`

2. **首次设置**
   - 创建账户或登录
   - 导入现有提示词 (可选)
   - 开始构建您的提示词库

3. **开始使用**
   - 访问任意AI平台
   - 按 \`/\` 键打开提示词选择器
   - 选择提示词，享受效率提升！

### 开发者指南

1. **克隆项目**
   \`\`\`bash
   git clone https://github.com/YUHAO-corn/prompt-master-extension.git
   cd prompt-master-extension
   \`\`\`

2. **环境配置**
   \`\`\`bash
   # 复制环境配置文件
   cp .env.example .env.local
   
   # 编辑 .env.local 配置 Firebase 等服务
   # 详见 .env.example 中的说明
   \`\`\`

3. **安装依赖**
   \`\`\`bash
   # 扩展依赖
   cd extension && npm install
   
   # 后端依赖
   cd ../backend && npm install
   \`\`\`

4. **启动开发**
   \`\`\`bash
   # 启动后端服务
   cd backend && npm run dev
   
   # 构建扩展 (另开终端)
   cd extension && npm run build:dev
   
   # 在Chrome中加载: chrome://extensions/ > 加载已解压的扩展程序 > extension/build/
   \`\`\`

---

## 📈 产品发展路线图

### 已完成 (V1.0)
- ✅ 核心提示词管理功能
- ✅ AI驱动优化系统  
- ✅ 免费增值商业模式
- ✅ Chrome商店发布

### 进行中 (V1.1)  
- 🔄 用户体验优化
- 🔄 性能提升和bug修复
- 🔄 移动端适配改进

### 规划中 (V2.0)
- 📅 提示词模板市场
- 📅 团队协作功能
- 📅 API开放平台
- 📅 第三方集成扩展

### 远期愿景 (V3.0)
- 🔮 智能提示词推荐
- 🔮 上下文感知优化
- 🔮 多模态内容支持
- 🔮 个性化AI助手

---

## 📊 成功指标

### 产品指标
- **用户获取**: Chrome商店下载量 > 10k
- **用户激活**: 7日内完成核心操作 > 60%
- **用户留存**: 30日留存率 > 40%
- **付费转化**: 免费到付费转化率 > 8%

### 技术指标  
- **性能**: 快捷输入响应时间 < 200ms
- **稳定性**: 系统正常运行时间 > 99.5%
- **兼容性**: 支持Chrome 90+版本
- **安全性**: 用户数据端到端加密

---

## 🤝 贡献指南

我们欢迎所有形式的贡献！请查看 [贡献指南](CONTRIBUTING.md) 了解详细信息。

### 参与方式
1. 🐛 **Bug报告**: 使用issue模板报告问题
2. 💡 **功能建议**: 提出新功能想法
3. 🔧 **代码贡献**: 提交Pull Request
4. 📚 **文档改进**: 完善项目文档

---

## 📜 开源协议

本项目采用 MIT 协议 - 详见 [LICENSE](LICENSE) 文件

---

## �� 致谢

感谢所有为这个项目做出贡献的开发者和用户！

### 核心贡献者
- **产品设计**: AI产品经理的系统性产品思维
- **技术架构**: 现代化前端架构和后端API设计  
- **用户体验**: 基于用户调研的交互设计优化

---

## 📞 联系我们

- 🐛 **Bug报告**: 使用GitHub Issues
- 💡 **功能建议**: 使用GitHub Issues
- 📧 **商务合作**: 敏感事务请直接联系

---

**以 ❤️ 打造 by Aetherflow团队**

*简化AI提示词管理，一个快捷键的距离。*

---

**[English](README_EN.md) | 中文**

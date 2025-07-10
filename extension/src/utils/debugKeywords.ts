/**
 * 调试关键词参考指南
 * 
 * 在Chrome DevTools控制台中，您可以使用以下关键词进行日志筛选：
 * 
 * === 快速筛选指南 ===
 * 
 * 🔍 Google登录完整流程：
 *    过滤器: GOOGLE_LOGIN_FLOW
 *    用途: 查看从UI点击到完成的整个Google登录过程
 * 
 * 🔍 中央状态管理：
 *    过滤器: CENTRAL_STATE
 *    用途: 查看CentralStateManager的状态变更和广播
 * 
 * 🔍 后端代理调用：
 *    过滤器: BACKEND_PROXY
 *    用途: 查看与后端API的通信情况
 * 
 * 🔍 UI状态更新：
 *    过滤器: UI_STATE_UPDATE
 *    用途: 查看前端UI Hook的状态变化
 * 
 * 🔍 认证流程调试：
 *    过滤器: AUTH_FLOW_DEBUG
 *    用途: 查看详细的用户数据传递情况
 * 
 * === 使用方法 ===
 * 
 * 1. 打开Chrome DevTools控制台
 * 2. 在过滤器输入框中输入关键词（例如：GOOGLE_LOGIN_FLOW）
 * 3. 执行操作（如点击Google登录）
 * 4. 查看过滤后的日志
 * 
 * === 组合使用 ===
 * 
 * - 查看Google登录的后端调用：GOOGLE_LOGIN_FLOW|BACKEND_PROXY
 * - 查看状态管理完整流程：CENTRAL_STATE|UI_STATE_UPDATE
 * - 查看认证相关的所有日志：AUTH_FLOW|GOOGLE_LOGIN|CENTRAL_STATE
 * 
 * === 常见问题诊断 ===
 * 
 * ❌ Google登录失败：
 *    1. 筛选 GOOGLE_LOGIN_FLOW 查看失败点
 *    2. 筛选 BACKEND_PROXY 查看后端通信
 * 
 * ❌ 登录后UI无响应：
 *    1. 筛选 CENTRAL_STATE 查看状态广播
 *    2. 筛选 UI_STATE_UPDATE 查看UI接收情况
 * 
 * ❌ 状态不一致：
 *    1. 筛选 AUTH_FLOW_DEBUG 查看数据传递
 *    2. 对比 CENTRAL_STATE 和 UI_STATE_UPDATE 的用户信息
 */

export const DEBUG_KEYWORDS = {
  GOOGLE_LOGIN_FLOW: 'GOOGLE_LOGIN_FLOW',
  CENTRAL_STATE: 'CENTRAL_STATE', 
  BACKEND_PROXY: 'BACKEND_PROXY',
  UI_STATE_UPDATE: 'UI_STATE_UPDATE',
  AUTH_FLOW_DEBUG: 'AUTH_FLOW_DEBUG'
} as const;

export type DebugKeyword = typeof DEBUG_KEYWORDS[keyof typeof DEBUG_KEYWORDS]; 
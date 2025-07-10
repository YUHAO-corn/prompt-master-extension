// 消息类型常量
export type MessageType = 
  // 提示词相关消息
  | 'GET_PROMPTS' 
  | 'GET_PROMPT' 
  | 'SAVE_PROMPT'
  | 'UPDATE_PROMPT'
  | 'DELETE_PROMPT'
  | 'INCREMENT_PROMPT_USE'
  | 'SEARCH_PROMPTS'
  | 'SEARCH_LOCAL_PROMPTS'
  | 'OPTIMIZE_PROMPT'
  | 'PROMPT_UPDATED'
  | 'IMPORT_PROMPTS'
  | 'EXPORT_PROMPTS'
  | 'GENERATE_TITLE'
  | 'CLOUD_SYNC_COMPLETED'
  // 内容脚本相关消息类型
  | 'COPY_TO_CLIPBOARD'
  | 'INJECT_PROMPT'
  | 'CLOSE_PROMPT_SHORTCUT'
  // 选中文本捕获相关消息类型
  | 'ADD_CONTEXT_MENU_ITEM'
  | 'CAPTURE_SELECTION_AS_PROMPT'
  | 'CAPTURE_SELECTION'
  | 'SHOW_NOTIFICATION'
  | 'SAVE_PROMPT_CAPTURE'
  // 消息通信检测
  | 'PING'
  | 'CONTENT_SCRIPT_READY'
  | 'HEARTBEAT'
  // 侧边栏
  | 'OPEN_SIDEBAR'
  // 优化
  | 'OPTIMIZE_SELECTION'
  // 旧版兼容消息类型
  | 'LEGACY_SEARCH_PROMPTS'
  | 'GET_SELECTED_TEXT'
  // 添加认证相关消息类型
  | 'LOGIN_WITH_GOOGLE'
  | 'LOGIN_WITH_EMAIL'     // 新增：邮箱登录
  | 'REGISTER_USER'        // 新增：用户注册
  | 'UPDATE_PROFILE'       // 新增：更新用户资料
  | 'DELETE_ACCOUNT'       // 新增：删除账户
  | 'CHECK_AUTH_STATE'
  | 'LOGOUT'
  | 'AUTH_STATE_CHANGED'
  // 优化相关新消息类型
  | 'OPTIMIZE_MODAL_CONTENT'
  | 'MODAL_OPTIMIZATION_RESULT'
  | 'OPTIMIZATION_RESULT'
  // Generic response types (NEW)
  | 'GENERIC_SUCCESS'
  | 'GENERIC_ERROR'
  // Central State Manager Messages (NEW)
  | 'CENTRAL_AUTH_STATE_UPDATED'
  | 'CENTRAL_MEMBERSHIP_STATE_UPDATED'
  // Quota Service Messages (NEW)
  | 'QUOTA_STATE_UPDATED' // Broadcast from QuotaService
  | 'CHECK_QUOTA'         // Request from UI to check quota
  | 'INCREMENT_USAGE'    // Request from UI/Features to increment usage
  // New state request/response types
  | 'GET_MEMBERSHIP_STATE'
  | 'MEMBERSHIP_STATE_RESPONSE'
  | 'GET_QUOTA_STATE'
  | 'QUOTA_STATE_RESPONSE'
  // Optional refresh trigger type
  | 'TRIGGER_MEMBERSHIP_REFRESH'
  // Add Auth State Request/Response Types
  | 'GET_AUTH_STATE'
  | 'AUTH_STATE_RESPONSE'
  // Invite Code Messages
  | 'GET_INVITE_CODE'
  | 'INVITE_CODE_RESPONSE';

/**
 * 统一消息接口
 */
export interface Message<T = any> {
  // 消息类型
  type: MessageType;
  // 消息负载
  payload?: T;
  // 可选的数据字段，主要用于新消息格式
  data?: any;
  // 请求ID，用于追踪异步请求
  requestId?: string;
  // 可选的发送者上下文
  from?: 'background' | 'content' | 'popup' | 'sidepanel';
  // 可选的错误信息
  error?: any;
  // 可选的成功标志
  success?: boolean;
}

/**
 * 消息响应接口
 */
export interface MessageResponse<T = any> {
  // 操作是否成功
  success: boolean;
  // 响应数据
  data?: T;
  // 错误信息
  error?: string;
  // 请求ID，对应请求的requestId
  requestId?: string;
}

/**
 * 消息处理回调
 * 注意：返回true表示将异步发送响应，Chrome扩展API需要这样标记
 */
export type MessageCallback = (
  message: Message,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
) => void | boolean | Promise<void | boolean>;

// --- Specific Payload Types (Example - Add more as needed) ---

export interface OptimizeSelectionPayload {
  content: string;
}

export interface OptimizationResultPayload {
  optimizedContent: string;
  error?: { code: string; message: string }; // Optional error details
}

export interface SavePromptPayload {
  title: string;
  content: string;
}

export interface GenerateTitlePayload {
  content: string;
}

export interface TitleGeneratedPayload {
  title: string;
}

// --- Helper Functions (Optional) ---

export function createSuccessResponse(payload?: any): Message {
  // Use the new generic success type
  return { type: 'GENERIC_SUCCESS', success: true, payload }; 
}

export function createErrorResponse(error: Error | any, type?: MessageType): Message {
  const message = error instanceof Error ? error.message : String(error);
  // Use the new generic error type if no specific type is provided
  const errorType = type || 'GENERIC_ERROR'; 
  return {
    type: errorType, 
    success: false, 
    error: { 
      message: message, 
      // Include stack or code if available and desired
      stack: error instanceof Error ? error.stack : undefined,
      code: (error as any).code // Add error code if exists
    } 
  };
} 
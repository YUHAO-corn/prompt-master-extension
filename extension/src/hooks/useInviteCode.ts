import { useState, useEffect, useCallback } from 'react';
import { safeLogger } from '../utils/safeEnvironment';

// 消息类型常量
const GET_INVITE_CODE = 'GET_INVITE_CODE';
const INVITE_CODE_RESPONSE = 'INVITE_CODE_RESPONSE';

interface InviteCodeState {
  inviteCode: string | null;
  inviteLink: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * 邀请码管理Hook
 * 遵循项目的消息传递架构，通过Background Script管理邀请码
 */
export function useInviteCode() {
  const [state, setState] = useState<InviteCodeState>({
    inviteCode: null,
    inviteLink: null,
    loading: true,
    error: null
  });

  // 生成邀请链接
  const generateInviteLink = useCallback((inviteCode: string): string => {
    // 根据环境选择基础URL
    const baseUrl = process.env.NODE_ENV === 'development' 
      ? 'https://dev.aetherflow-app.com' 
      : 'https://aetherflow-app.com';
    return `${baseUrl}/invite?ref=${inviteCode}`;
  }, []);

  // 从Background Script获取邀请码
  const fetchInviteCode = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      safeLogger.log('[useInviteCode] Sending GET_INVITE_CODE request to background.');
      
      const response = await chrome.runtime.sendMessage({ type: GET_INVITE_CODE });
      
      safeLogger.log('[useInviteCode] Received response:', response);
      
      if (response && response.type === INVITE_CODE_RESPONSE) {
        safeLogger.log('[useInviteCode] Received INVITE_CODE_RESPONSE:', response.payload);
        
        if (response.payload?.inviteCode) {
          const inviteCode = response.payload.inviteCode;
          const inviteLink = generateInviteLink(inviteCode);
          
          setState({
            inviteCode,
            inviteLink,
            loading: false,
            error: null
          });
        } else if (response.error) {
          setState(prev => ({
            ...prev,
            loading: false,
            error: response.error
          }));
        }
      } else {
        setState(prev => ({
          ...prev,
          loading: false,
          error: 'Failed to get invite code'
        }));
      }
    } catch (error) {
      safeLogger.error('[useInviteCode] Error fetching invite code:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }, [generateInviteLink]);

  // 复制邀请链接到剪贴板
  const copyInviteLink = useCallback(async (): Promise<boolean> => {
    if (!state.inviteLink) {
      safeLogger.warn('[useInviteCode] No invite link to copy');
      return false;
    }

    try {
      await navigator.clipboard.writeText(state.inviteLink);
      safeLogger.log('[useInviteCode] Invite link copied successfully');
      return true;
    } catch (error) {
      safeLogger.error('[useInviteCode] Failed to copy invite link:', error);
      return false;
    }
  }, [state.inviteLink]);

  // 重新获取邀请码
  const refreshInviteCode = useCallback(() => {
    fetchInviteCode();
  }, [fetchInviteCode]);

  // 组件挂载时获取邀请码
  useEffect(() => {
    fetchInviteCode();
  }, [fetchInviteCode]);

  return {
    ...state,
    copyInviteLink,
    refreshInviteCode
  };
} 
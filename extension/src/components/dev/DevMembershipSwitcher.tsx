import React, { useState } from 'react';
import { useMembership } from '../../hooks/useMembership';
import { membershipService } from '../../services/membership';
import { authService } from '../../services/auth'; // <-- 导入 authService
import { Button } from '../common/Button';
import { LoadingIndicator } from '../common/LoadingIndicator';

// Cloud Run 函数 URL (替换为你的实际 URL)
const CLOUD_RUN_URL = 'https://set-membership-test-423266303314.us-west2.run.app';

/**
 * 开发环境下会员状态切换工具 (仅通过后端更新)
 */
export const DevMembershipSwitcher: React.FC = () => {
  const { membershipState } = useMembership(); // Keep useMembership to potentially display current state or disable buttons
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Removed handleSetLocalStatus function

  // 处理通过后端Cloud Run设置会员状态的函数
  const handleSetBackendStatus = async (targetStatus: 'free' | 'pro') => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const currentUser = await authService.getCurrentUser();
      if (!currentUser || !currentUser.uid) {
        throw new Error('User not logged in.');
      }
      const userId = currentUser.uid;

      const idToken = await authService.getIdToken(true); // true 强制刷新
      if (!idToken) {
        throw new Error('Failed to get ID token.');
      }

      console.log(`Sending request to Cloud Run: userId=${userId}, targetStatus=${targetStatus}`);

      const response = await fetch(CLOUD_RUN_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          targetStatus: targetStatus,
          // 可选：根据需要传递 plan 或 expiresAt
          // plan: 'annual',
          // expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 // 模拟一周后过期
        }),
      });

      const responseData = await response.json();
      console.log('Cloud Run response:', responseData);

      if (!response.ok) {
        throw new Error(responseData.message || `HTTP error! status: ${response.status}`);
      }

      setSuccessMessage(responseData.message || `Backend status set to ${targetStatus} successfully.`);

      // 注意：后端更新后，前端状态可能不会立即更新，
      // 取决于 Firestore 监听和本地同步的延迟。
      // 可能需要提示用户等待或手动刷新。

    } catch (err) {
      console.error('Error setting backend status:', err);
      setError(`Failed to set backend status: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  if (process.env.NODE_ENV !== 'development') {
    return null; // 只在开发环境渲染
  }

  return (
    <div className="mt-auto p-2 border-t border-magic-700 bg-magic-800/50">
      <p className="text-xs text-magic-400 mb-2">Dev Tools (Simulate Backend Update):</p>
      <div className="grid grid-cols-2 gap-1">
        {/* Removed local status buttons */}

        {/* 后端切换按钮 (更新文本) */}
        <Button variant="secondary" onClick={() => handleSetBackendStatus('free')} disabled={loading}>Set Firestore: Free</Button>
        <Button variant="secondary" onClick={() => handleSetBackendStatus('pro')} disabled={loading}>Set Firestore: Pro</Button>

      </div>
      {loading && <div className="mt-1 flex justify-center"><LoadingIndicator size="sm" /></div>}
      {error && <p className="text-xs text-red-500 mt-1 break-words">Error: {error}</p>}
      {successMessage && <p className="text-xs text-green-500 mt-1 break-words">{successMessage}</p>}
    </div>
  );
}; 
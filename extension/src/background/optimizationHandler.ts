// extension/src/background/optimizationHandler.ts

// Import the centralized optimization service
import { optimizePrompt } from '../services/optimizationService'; 
// Import the getter for the CentralStateManager instance
import { getCentralStateManager } from './index'; // Use CentralStateManager
import { safeLogger } from '@/utils/safeEnvironment'; // Import safeLogger

/**
 * Handles the OPTIMIZE_SELECTION message by calling the centralized optimization service.
 * NOTE: This function likely also needs userId for quota, but is not the focus now.
 */
export async function handleOptimizeSelection(
  payload: { content?: string, isReoptimize?: boolean }, 
  sender: chrome.runtime.MessageSender, 
  sendResponse: (response?: any) => void
): Promise<void> {
  safeLogger.log('[OptimizationHandler] Received OPTIMIZE_SELECTION request, content length:', payload?.content?.length);
  safeLogger.log('[OptimizationHandler] Full payload for OPTIMIZE_SELECTION:', payload);
  
  // --- Get User ID from Central State --- 
  let userId: string | null = null;
  try {
    const centralStateManager = getCentralStateManager();
    userId = centralStateManager.getAuthState().userId;

    if (!userId) {
      safeLogger.warn('[OptimizationHandler] User not logged in for OPTIMIZE_SELECTION.');
      sendResponse({ success: false, error: { code: 'auth/not-logged-in', message: 'Please log in to optimize selection.' } });
      return;
    }
    safeLogger.log(`[OptimizationHandler] User ID retrieved for OPTIMIZE_SELECTION: ${userId}`);
  } catch (error) {
    safeLogger.error('[OptimizationHandler] Error retrieving CentralStateManager or userId for OPTIMIZE_SELECTION:', error);
    sendResponse({ success: false, error: { code: 'internal/state-error', message: 'Failed to retrieve user authentication state.' } });
    return;
  }
  // --- End Get User ID ---

  if (!sender.tab?.id || !payload?.content) {
    safeLogger.error('[OptimizationHandler] Invalid request for OPTIMIZE_SELECTION: Missing tab ID or content.', { payload, sender });
    sendResponse({ success: false, error: 'Invalid payload or sender tab info for OPTIMIZE_SELECTION' });
    return; 
  }

  const tabId = sender.tab.id;
  const originalContent = payload.content;
  const optimizationMode = 'universal'; // Changed from 'standard' to 'universal'
  const isReoptimize = payload.isReoptimize || false;
  const serviceOptions = { isToolbar: true, isReoptimize };

  try {
    safeLogger.log(`[OptimizationHandler] Calling optimizationService.optimizePrompt for user ${userId} (OPTIMIZE_SELECTION)...`);
    safeLogger.log(`[OptimizationHandler] optimizePrompt ARGS: originalContent (length: ${originalContent?.length}), mode: ${optimizationMode}, userId: ${userId}, options:`, serviceOptions);
    
    // 这里使用标准模式进行优化，并设置isToolbar标志为true表示这是工具栏优化
    const optimizedContent = await optimizePrompt(originalContent, optimizationMode, userId, serviceOptions);

    safeLogger.log(`[OptimizationHandler] optimizePrompt RETURNED: optimizedContent (length: ${optimizedContent?.length}):`, optimizedContent ? optimizedContent.substring(0, 100) + '...' : '[EMPTY]');
    safeLogger.log(`[OptimizationHandler] OPTIMIZE_SELECTION ${isReoptimize ? '(reoptimize)' : ''} successful via service for user ${userId}. Length: ${optimizedContent.length}`);

    // Send the result back to the content script
    safeLogger.log(`[OptimizationHandler] Sending OPTIMIZATION_RESULT to tab ${tabId} with payload:`, { optimizedContent: optimizedContent ? optimizedContent.substring(0,100) + '...': '[EMPTY]'});
    chrome.tabs.sendMessage(tabId, {
        type: 'OPTIMIZATION_RESULT',
        payload: { optimizedContent: optimizedContent }
    }).catch(error => {
        safeLogger.error(`[OptimizationHandler] Error sending OPTIMIZATION_RESULT to Tab ${tabId} for user ${userId}:`, error);
    });

    sendResponse({ success: true });

  } catch (error: any) {
    safeLogger.error(`[OptimizationHandler] Error calling optimizationService for OPTIMIZE_SELECTION for user ${userId}:`, error);
    // Send error back using the appropriate response format for this message type
    sendResponse({ 
        success: false, 
        error: { 
            code: error.code || 'optimization/service-failed', 
            message: error.message || 'Optimization failed' 
        }
    });
  }
}

/**
 * Handles the OPTIMIZE_MODAL_CONTENT message for the preview modal.
 */
export async function handleOptimizeModalContent(
  payload: { content?: string }, 
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): Promise<void> {
  safeLogger.log('[OptimizationHandler] Received OPTIMIZE_MODAL_CONTENT request, content length:', payload?.content?.length);

  // --- Start: Get User ID from Central State --- 
  let userId: string | null = null;
  try {
    const centralStateManager = getCentralStateManager();
    userId = centralStateManager.getAuthState().userId;

    if (!userId) {
      safeLogger.warn('[OptimizationHandler] User is not logged in. Cannot perform optimization.');
      sendResponse({ 
        success: false, 
        error: { 
            code: 'auth/not-logged-in', 
            message: 'Please log in to optimize content.' 
        } 
      });
      return; 
    }
    safeLogger.log(`[OptimizationHandler] User ID retrieved for optimization: ${userId}`);
  } catch (error) {
    safeLogger.error('[OptimizationHandler] Error retrieving CentralStateManager or userId:', error);
    sendResponse({ 
        success: false, 
        error: { 
            code: 'internal/state-error', // Use consistent error code
            message: 'Failed to retrieve user authentication state. Please try again later.' 
        } 
    });
    return; 
  }
  // --- End: Get User ID from Central State --- 

  if (!sender.tab?.id || !payload?.content) {
    safeLogger.error('[OptimizationHandler] Invalid request: Missing tab ID or content.', { payload, sender });
    sendResponse({ success: false, error: 'Invalid payload or sender tab info for OPTIMIZE_MODAL_CONTENT' });
    return;
  }

  const tabId = sender.tab.id;
  const originalContent = payload.content;

  try {
    safeLogger.log(`[OptimizationHandler] Calling optimizationService.optimizePrompt for user ${userId} for modal...`);
    // 对于模态框优化，我们仍然使用通用模式，但isToolbar标志设为false表示这不是工具栏优化
    const optimizedContent = await optimizePrompt(originalContent, 'universal', userId, { isToolbar: false }); 

    safeLogger.log(`[OptimizationHandler] Modal optimization successful via service for user ${userId}. Length: ${optimizedContent.length}`);

    chrome.tabs.sendMessage(tabId, {
        type: 'MODAL_OPTIMIZATION_RESULT',
        payload: { optimizedContent: optimizedContent }
    }).catch(error => {
        safeLogger.error(`[OptimizationHandler] Error sending MODAL_OPTIMIZATION_RESULT to Tab ${tabId} for user ${userId}:`, error);
    });

    sendResponse({ success: true });

  } catch (error: any) {
    safeLogger.error(`[OptimizationHandler] Error calling optimizationService for modal for user ${userId}:`, error);
    const errorPayload = { 
        code: error.code || 'optimization/service-failed', 
        message: error.message || 'Optimization failed' 
    };
    chrome.tabs.sendMessage(tabId, {
        type: 'MODAL_OPTIMIZATION_RESULT',
        payload: { error: errorPayload }
    }).catch(sendMessageError => {
        safeLogger.error(`[OptimizationHandler] Error sending MODAL_OPTIMIZATION_RESULT (error state) to Tab ${tabId} for user ${userId}:`, sendMessageError);
    });
    sendResponse({ success: false, error: errorPayload });
  }
}

// No separate initializer needed for this handler
 
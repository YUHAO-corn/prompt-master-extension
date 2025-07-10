// AetherFlow Capture Feature - Content Script Logic
import '../styles/captureUI.css'; // Import CSS for webpack
// Import toolbar functions
import { floatingToolbar, showFloatingToolbar, hideFloatingToolbar } from './floatingToolbar';
// Import preview modal functions
import { previewModalState, showPreviewModal, hidePreviewModal } from './previewModal';
// Import optimization popup functions
import { optimizePopupElement, getOrCreateOptimizationPopup, hideOptimizationPopup, isOptimizationPopupPinned } from './optimizationPopup';
// Import toast notification function
import { showToastNotification } from './toastNotification';

console.log('AetherFlow Capture script loaded.');

export let currentSelection: Selection | null = null; // Export currentSelection

/**
 * Initializes the capture feature.
 * Sets up event listeners and message listeners.
 */
export function initCaptureFeature(): void {
  console.log('Initializing AetherFlow Capture Feature...');

  // --- Event Listeners for UI --- 
  document.addEventListener('mouseup', handleMouseUp, true);
  document.addEventListener('mousedown', handleMouseDown, true);
  
  // --- 添加选择事件监听，支持键盘选择 --- 
  // selectionchange 事件在任何选择变化时触发，包括键盘和鼠标
  document.addEventListener('selectionchange', handleSelectionChange);
  
  // --- Message Listener from Background/Popup --- 
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Capture Script] Received message:', message);
    if (message.type === 'SHOW_CAPTURE_MODAL_FROM_CONTEXT') {
        if (message.payload && message.payload.content) {
            console.log('[Capture Script] Handling SHOW_CAPTURE_MODAL_FROM_CONTEXT');
            // Ensure any existing toolbar is hidden
            hideFloatingToolbar(); 
            // Show the preview modal with the provided content and source URL
            const sourceUrl = message.payload.sourceUrl; // 从 payload 中获取 URL
            showPreviewModal(message.payload.content, sourceUrl);
            sendResponse({ success: true });
        } else {
            console.error('[Capture Script] Invalid payload for SHOW_CAPTURE_MODAL_FROM_CONTEXT');
            sendResponse({ success: false, error: 'Invalid payload' });
        }
        return true; // Indicate async response if needed, though showing modal is mostly sync
    } else if (message.type === 'TITLE_GENERATED') {
        console.log('[Capture Script] Received generated title:', message.payload.title);
        if (previewModalState) {
            const titleInput = previewModalState.modal.querySelector('#aetherflow-capture-title') as HTMLInputElement;
            const titleSpinner = previewModalState.modal.querySelector('.aetherflow-capture-title-spinner') as HTMLSpanElement;

            if (titleSpinner) {
                titleSpinner.style.display = 'none'; // Hide spinner
            }
            if (titleInput) {
                // Only update if user hasn't manually edited the title
                if (titleInput.dataset.edited === 'false') {
                    titleInput.value = message.payload.title;
                }
            }
        }
        sendResponse({ success: true }); // Acknowledge receipt
        return true;
    } else if (message.type === 'PING') {
        // Respond to PING from background to indicate script is ready
        console.log('[Capture Script] Received PING, sending PONG');
        sendResponse({ type: 'PONG' });
        return true; // Important to return true for async/sync response
    }
    // Handle other message types if needed
    // Return false or nothing if not handling the message or response is synchronous
    // return false; 
  });

  // Send ready message to background on initialization
  // Use a slight delay to ensure background listener is ready
  setTimeout(() => {
      chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY', data: { url: window.location.href } }).catch(err => {
          console.warn('[Capture Script] Could not send ready message to background:', err);
      });
  }, 100); 
  
}

/**
 * 处理选择变化事件，支持键盘选择文本时显示工具栏
 * 该函数通过防抖（debounce）机制避免频繁触发
 */
let selectionChangeTimeout: NodeJS.Timeout | null = null;
const SELECTION_DEBOUNCE_DELAY = 200; // 200毫秒的防抖延迟

function handleSelectionChange(): void {
  // 清除之前的定时器
  if (selectionChangeTimeout) {
    clearTimeout(selectionChangeTimeout);
  }
  
  // 设置新的定时器，防抖处理
  selectionChangeTimeout = setTimeout(() => {
    const selection = window.getSelection();
    
    // 检查选择是否有效（不为空且不是折叠状态）
    if (selection && !selection.isCollapsed && selection.toString().trim().length > 0) {
      console.log('[Capture Script] Selection changed via keyboard:', selection.toString().substring(0, 30) + '...');
      currentSelection = selection;
      
      // 检查工具栏是否已显示，如果没有则显示
      if (!floatingToolbar || floatingToolbar.style.display === 'none') {
        // 使用showFloatingToolbar但不传递MouseEvent参数，它会基于选区位置
        showFloatingToolbar(selection);
      }
    }
  }, SELECTION_DEBOUNCE_DELAY);
}

/**
 * Handles the mouseup event to detect text selection.
 * @param event The MouseEvent object.
 */
function handleMouseUp(event: MouseEvent): void {
  // Debounce or throttle might be needed here if logic becomes complex
  const selection = window.getSelection();

  if (selection && selection.toString().trim().length > 0) {
    currentSelection = selection;
    // Check if selection is inside an input/textarea? Maybe disable there.
    console.log('Text selected:', selection.toString());
    showFloatingToolbar(selection, event);
  } else {
    // If no text is selected, ensure the toolbar is hidden
    // This might be redundant if handleMouseDown covers it
    hideFloatingToolbar();
  }
}

/**
 * Handles the mousedown event to hide the toolbar/modal when clicking outside.
 * @param event The MouseEvent object.
 */
function handleMouseDown(event: MouseEvent): void {
  // Hide Toolbar if click is outside
  if (floatingToolbar && !floatingToolbar.contains(event.target as Node)) {
    const captureButton = floatingToolbar.querySelector('.aetherflow-capture-action-button');
    if (!captureButton || !captureButton.contains(event.target as Node)) {
         hideFloatingToolbar();
    }
  }

  // Hide Preview Modal ONLY if it exists, is NOT pinned, and the click is OUTSIDE the modal content
  if (previewModalState && !previewModalState.isPinned && !previewModalState.modal.contains(event.target as Node)) {
     console.log('Click detected outside unpinned modal, hiding...');
     hidePreviewModal();
   }

   // Hide Optimization Popup if click is outside AND it's not pinned
   if (optimizePopupElement && optimizePopupElement.style.display !== 'none' &&
       !isOptimizationPopupPinned() &&
       !optimizePopupElement.contains(event.target as Node)) {
      console.log('Click detected outside unpinned optimization popup, hiding...');
      hideOptimizationPopup();
   }
}

// --- Initialization Call --- //
// Ensure the script runs only in the top frame, or handle frames appropriately
if (window.self === window.top) {
    // Call init function
    initCaptureFeature();
} else {
    console.log('[Capture Script] Running in iframe, capture feature may be limited or disabled.');
    // Optionally initialize limited functionality or specific listeners for iframes
} 
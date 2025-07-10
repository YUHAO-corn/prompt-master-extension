import {
    currentSelection,
    // showPreviewModal, // No longer needed here
    // getOrCreateOptimizationPopup, // Moved to optimizationPopup
    // hideOptimizationPopup, // We define hideOptimizationPopup locally
} from './capture';
import { showPreviewModal } from './previewModal'; // Correct import path
import { getOrCreateOptimizationPopup, hideOptimizationPopup, showOptimizationPopup, setOriginalPrompt } from './optimizationPopup'; // Import from new file
import { showToast } from './toast'; // <-- 新增：导入 showToast

export let floatingToolbar: HTMLDivElement | null = null;

// 新增：记录上次优化请求的时间戳和频率限制
let lastOptimizationRequestTime = 0;
const OPTIMIZATION_REQUEST_INTERVAL = 3000; // 3秒

// 新增：记录最后一次显示工具栏的时间，用于防止频繁触发
let lastToolbarShowTime = 0;
const TOOLBAR_SHOW_INTERVAL = 300; // 300毫秒内不重复显示

/**
 * Handles the click event on the disable button.
 * TODO: Implement logic to disable on site (send message to background).
 */
function handleDisableSiteClick(): void {
  console.log('Disable on this site clicked');
  alert('Disable functionality not yet implemented.'); // Placeholder feedback
  hideFloatingToolbar(); // Hide after click
}

// 优化：使用Toast组件统一显示错误
function showToolbarError(message: string, forDuration: number = 3000): void {
  // 调用toast.ts中的showToast方法，使用error类型
  import('./toast').then(({ showToast }) => {
    showToast(message, 'error', forDuration);
  }).catch(err => {
    console.error('[FloatingToolbar] Error importing toast module:', err);
    // 如果无法导入toast，使用alert作为备选
    alert(message);
  });
}

/**
 * Handles the click event on the capture button in the floating toolbar.
 */
function handleCaptureClick(): void {
  console.log('Capture button clicked');
  hideFloatingToolbar(); // 先隐藏工具栏

  chrome.runtime.sendMessage({ type: 'CHECK_AUTH_STATE' }, (authResponse) => {
    if (chrome.runtime.lastError) {
      console.error('[FloatingToolbar] Error checking auth state for capture:', chrome.runtime.lastError);
      alert('Unable to verify user status. Please try again later.'); // 英文错误提示
      return;
    }

    if (authResponse && authResponse.success && authResponse.user) {
      // 用户已登录
      // const userId = authResponse.user.uid; // userId 暂时不在剪藏的直接流程中使用，但后续 showPreviewModal 可能需要
      if (currentSelection) {
        const selectedText = currentSelection.toString();
        // 工具栏已隐藏，现在显示预览模态框
        // TODO: 考虑是否需要将 userId 传递给 showPreviewModal，如果其内部的自动标题等功能需要
        const sourceUrl = window.location.href; // 获取当前页面 URL
        showPreviewModal(selectedText, sourceUrl); // 传递 URL
      } else {
        console.error('[FloatingToolbar] No selection found when capture clicked (after auth check).');
        // alert('请重新选择文本进行剪藏。'); // 可选
      }
    } else {
      // 用户未登录或获取状态失败
      console.log('[FloatingToolbar] User not authenticated for capture, requesting sidebar open with login prompt.');
      chrome.runtime.sendMessage({ type: 'OPEN_SIDEBAR', payload: { promptLogin: true } });
      // 工具栏已隐藏
    }
  });
}

/**
 * Placeholder handler for the Optimize button click.
 * TODO: Implement optimization request logic and show popup on result.
 */
function handleOptimizeClick(event: MouseEvent): void {
    console.log('[FloatingToolbar] Optimize button clicked. Event:', event);

    // 新增：频率限制检查
    const currentTime = Date.now();
    if (currentTime - lastOptimizationRequestTime < OPTIMIZATION_REQUEST_INTERVAL) {
        console.log('[FloatingToolbar] Optimization request too frequent. Showing toast.');
        import('./toast').then(({ showToast }) => {
            showToast("Too many requests, please wait a moment", "info");
        });
        // 注意：这里我们直接返回，不隐藏工具栏，允许用户看到提示
        return;
    }
    // 如果未被频率限制，则更新时间戳
    lastOptimizationRequestTime = currentTime;
    
    const clickedButton = event.currentTarget as HTMLButtonElement;
    if (!clickedButton) {
        console.error('[FloatingToolbar] Optimize button element not found on initial click.');
        return;
    }
    const buttonRectForPopup = clickedButton.getBoundingClientRect(); // 获取按钮位置以备后用
    console.log('[FloatingToolbar] Initial optimize button rect for popup:', buttonRectForPopup);

    hideFloatingToolbar(); 
    console.log('[FloatingToolbar] Toolbar hidden.');

    chrome.runtime.sendMessage({ type: 'CHECK_AUTH_STATE' }, (authResponse) => {
        console.log('[FloatingToolbar] CHECK_AUTH_STATE response received:', authResponse);
        if (chrome.runtime.lastError) {
            console.error('[FloatingToolbar] Error checking auth state:', chrome.runtime.lastError);
            alert('Unable to verify user status. Please try again later.');
            return;
        }

        if (authResponse && authResponse.success && authResponse.user) {
            const userId = authResponse.user.uid;
            console.log('[FloatingToolbar] User authenticated. User ID:', userId);

            const selectedText = currentSelection ? currentSelection.toString() : null;
            console.log('[FloatingToolbar] Selected text for optimization:', selectedText ? selectedText.substring(0, 50) + '...' : 'null');
            if (!selectedText) {
                console.error('[FloatingToolbar] No text selected for optimization after auth check.');
                return;
            }
            
            // 保存原始提示词，用于后续重新优化
            setOriginalPrompt(selectedText);
            
            console.log('[FloatingToolbar] Preparing to send OPTIMIZE_SELECTION for user:', userId);
            chrome.runtime.sendMessage({ 
                type: 'OPTIMIZE_SELECTION', 
                payload: { content: selectedText, userId: userId } 
            }, (optResponse) => {
                console.log('[FloatingToolbar] OPTIMIZE_SELECTION response received:', optResponse);
                if (chrome.runtime.lastError) {
                    console.error('[FloatingToolbar] Error sending OPTIMIZE_SELECTION message:', chrome.runtime.lastError);
                    alert('Optimization request failed. Please try again later.');
                    return;
                }
                
                if (optResponse && optResponse.success) {
                    console.log('[FloatingToolbar] OPTIMIZE_SELECTION message sent, backend accepted.');
                } else if (optResponse && optResponse.error) {
                    console.error('[FloatingToolbar] Optimization rejected by backend:', optResponse.error);
                    alert(`Optimization failed: ${optResponse.error.message}`);
                } else {
                    console.log('[FloatingToolbar] Optimization request encountered an unknown issue. Response:', optResponse);
                    alert('Optimization request encountered an unknown issue.');
                }
            });
            
            console.log('[FloatingToolbar] Showing optimization popup using rect:', buttonRectForPopup);
            showOptimizationPopup(buttonRectForPopup); // 使用回调前获取的按钮位置

        } else {
            console.log('[FloatingToolbar] User not authenticated, requesting sidebar open with login prompt.');
            chrome.runtime.sendMessage({ type: 'OPEN_SIDEBAR', payload: { promptLogin: true } });
            // 工具栏已隐藏，无需再次隐藏
        }
    });
}

/**
 * Handles the click event on the logo button.
 * TODO: Implement logic to open AetherFlow (e.g., extension popup or options page).
 */
function handleLogoClick(): void {
  console.log('Logo clicked - requesting sidebar open');
  // Send message to background script to open the side panel
  chrome.runtime.sendMessage({ type: 'OPEN_SIDEBAR' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error sending OPEN_SIDEBAR message:', chrome.runtime.lastError);
      // Maybe provide fallback feedback if messaging fails
    } else {
      console.log('OPEN_SIDEBAR message sent, response:', response);
    }
  });
  // Decide whether to hide the toolbar immediately or not.
  // Usually opening the sidebar doesn't require hiding the trigger.
  // hideFloatingToolbar();
}


/**
 * Creates or gets the floating toolbar DOM element.
 * @returns The floating toolbar element.
 */
function getOrCreateFloatingToolbar(): HTMLDivElement {
  if (!floatingToolbar) {
    floatingToolbar = document.createElement('div');
    floatingToolbar.className = 'aetherflow-capture-toolbar';
    floatingToolbar.innerHTML = ''; // Clear potential previous content

    // 1. Disable Button (Always visible, leftmost)
    const disableButton = document.createElement('button');
    disableButton.className = 'aetherflow-capture-disable-button';
    disableButton.title = 'Turn off AetherFlow on this site'; // Tooltip
    // X icon (Feather icons)
    disableButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
    `;
    disableButton.addEventListener('click', handleDisableSiteClick);
    floatingToolbar.appendChild(disableButton);

    // 2. Capture Button (Main action)
    const captureButton = document.createElement('button');
    captureButton.className = 'aetherflow-capture-action-button';
    captureButton.title = 'Capture to AetherFlow';
    // BookmarkPlus icon (Needs fill for new style)
    captureButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
        <line x1="12" x2="12" y1="7" y2="13" stroke="white" stroke-width="2"/>
        <line x1="9" x2="15" y1="10" y2="10" stroke="white" stroke-width="2"/>
      </svg>
    `;
    captureButton.addEventListener('click', handleCaptureClick);
    floatingToolbar.appendChild(captureButton);

    // 3. Optimize Button (New)
    const optimizeButton = document.createElement('button');
    optimizeButton.className = 'aetherflow-capture-optimize-button';
    optimizeButton.title = 'Optimize selection';
    // 使用星星图标作为优化按钮
    optimizeButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none" class="optimize-icon">
         <path d="M12 2l2.24 7.37L22 12l-7.37 2.24L12 22l-2.24-7.37L2 12l7.37-2.24L12 2z"/>
      </svg>
    `;
    optimizeButton.addEventListener('click', handleOptimizeClick);
    floatingToolbar.appendChild(optimizeButton);

    // 4. Logo Button (Rightmost)
    const logoButton = document.createElement('button');
    logoButton.className = 'aetherflow-capture-logo-button';
    logoButton.title = 'Open AetherFlow'; // Or just 'AetherFlow'
    // 使用新版P形logo
    logoButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 375 375" fill="#8b5cf6" stroke="none" class="logo-icon">
        <g fill="#8b5cf6">
          <path d="M 182.5625 -350.109375 C 202.226562 -350.109375 220.644531 -346.441406 237.8125 -339.109375 C 254.988281 -331.773438 270.160156 -321.601562 283.328125 -308.59375 C 296.503906 -295.59375 306.84375 -280.503906 314.34375 -263.328125 C 321.851562 -246.160156 325.609375 -227.738281 325.609375 -208.0625 C 325.609375 -188.726562 321.9375 -170.472656 314.59375 -153.296875 C 307.257812 -136.128906 297.085938 -121.039062 284.078125 -108.03125 C 271.078125 -95.03125 256.070312 -84.859375 239.0625 -77.515625 C 222.0625 -70.179688 203.726562 -66.515625 184.0625 -66.515625 L 184.0625 0 L 15 0 L 15 -350.109375 Z" transform="translate(27.953696, 359.759055)"/>
        </g>
        <path fill="#ffffff" d="M 593.433594 -31.90625 C 582.988281 -25.886719 558.664062 -50.234375 558.664062 -50.234375 C 558.664062 -50.234375 549.914062 -83.503906 560.378906 -89.511719 L 612.476562 -119.445312 C 590.066406 -134.105469 560.46875 -135.972656 535.691406 -121.742188 C 511.554688 -107.867188 498.277344 -82.367188 498.835938 -56.367188 C 414.484375 3.226562 324.761719 54.777344 230.792969 97.605469 C 208.636719 83.988281 179.902344 82.613281 155.757812 96.480469 C 130.960938 110.730469 117.6875 137.246094 119.046875 163.976562 L 171.136719 134.042969 C 181.601562 128.046875 205.917969 152.394531 205.917969 152.394531 C 205.917969 152.394531 214.667969 185.671875 204.214844 191.671875 L 152.121094 221.585938 C 174.507812 236.25 204.097656 238.148438 228.894531 223.898438 C 252.492188 210.359375 265.644531 185.691406 265.703125 160.316406 C 350.527344 100.316406 440.808594 48.488281 535.367188 5.429688 C 557.324219 18.15625 585.230469 19.21875 608.824219 5.6875 C 633.605469 -8.550781 646.902344 -35.078125 645.535156 -61.820312 Z" />
      </svg>
    `;
    logoButton.addEventListener('click', handleLogoClick);
    floatingToolbar.appendChild(logoButton);

    document.body.appendChild(floatingToolbar);
  }
  return floatingToolbar;
}

/**
 * Shows the floating toolbar near the selected text, positioned relative to mouseup event.
 * @param selection The current text Selection object.
 * @param event The triggering MouseEvent (for positioning) - 现在是可选参数.
 */
export function showFloatingToolbar(selection: Selection, event?: MouseEvent): void {
  const toolbar = getOrCreateFloatingToolbar();
  if (!toolbar) return; // Should not happen, but good practice

  // 添加频率限制检查，防止短时间内多次触发
  const currentTime = Date.now();
  if (currentTime - lastToolbarShowTime < TOOLBAR_SHOW_INTERVAL) {
    console.log('[FloatingToolbar] Skipping toolbar show due to frequency limit');
    return;
  }
  lastToolbarShowTime = currentTime;

  // --- Calculate Position --- //
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const toolbarHeight = toolbar.offsetHeight;
  const toolbarWidth = toolbar.offsetWidth;
  const margin = 5; // Small margin from selection/cursor

  // Get selection bounds for vertical positioning check
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  // --- Vertical Positioning --- 
  let top: number;
  const spaceAbove = rect.top; // Space between selection top and viewport top
  const spaceBelow = window.innerHeight - rect.bottom; // Space between selection bottom and viewport bottom

  if (spaceAbove >= toolbarHeight + margin) {
    // Prefer position above the *selection range*
    top = rect.top + scrollY - toolbarHeight - margin;
  } else if (spaceBelow >= toolbarHeight + margin) {
    // Place below the *selection range*
    top = rect.bottom + scrollY + margin;
  } else {
    // Fallback for keyboard selection (无鼠标事件) 或 selection spans whole screen height
    if (event && event.clientY >= toolbarHeight + margin) {
        // 如果有鼠标事件，使用鼠标位置
        top = event.clientY + scrollY - toolbarHeight - margin;
    } else {
        // 如果没有鼠标事件或鼠标位置不佳，使用选区位置
        // 尝试在选区中间位置显示
        top = (rect.top + rect.bottom) / 2 + scrollY - toolbarHeight / 2;
    }
  }
  // Ensure top position stays within vertical viewport bounds (considering scroll)
  top = Math.max(scrollY, top);
  top = Math.min(top, scrollY + window.innerHeight - toolbarHeight);

  // --- Horizontal Positioning --- 
  let left: number;
  if (event) {
    // 如果有鼠标事件，基于鼠标位置水平居中
    left = event.clientX + scrollX - toolbarWidth / 2;
  } else {
    // 如果是键盘选择（无鼠标事件），基于选区水平居中
    left = (rect.left + rect.right) / 2 + scrollX - toolbarWidth / 2;
  }

  // Ensure left position stays within horizontal viewport bounds
  const minLeft = scrollX;
  const maxLeft = scrollX + window.innerWidth - toolbarWidth;
  left = Math.max(minLeft, Math.min(left, maxLeft));

  // Apply styles
  toolbar.style.top = `${top}px`;
  toolbar.style.left = `${left}px`;
  toolbar.style.display = 'block';
  console.log('Showing toolbar at', { top, left }, event ? 'with mouse event' : 'from keyboard selection');
}

/**
 * Hides the floating toolbar.
 */
export function hideFloatingToolbar(): void {
  if (floatingToolbar) {
    floatingToolbar.style.display = 'none';
    console.log('Hiding toolbar');
  }
}

/**
 * 检查键盘选择并显示工具栏
 * 在键盘导航和选择完成后检查是否有文本被选中
 */
function checkKeyboardSelection(): void {
  const selection = window.getSelection();
  if (selection && !selection.isCollapsed && selection.toString().trim().length > 0) {
    console.log('[FloatingToolbar] Detected keyboard text selection');
    showFloatingToolbar(selection); // 不传递MouseEvent参数
  }
}

// 添加键盘事件监听器
document.addEventListener('keyup', (event) => {
  // 仅在可能引起选择变化的按键释放后检查
  // Shift + 方向键、Home、End、PageUp、PageDown 等常用于文本选择的组合键
  const selectionKeys = [
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'Home', 'End', 'PageUp', 'PageDown'
  ];
  
  // 检查是否是选择文本的常见组合键
  if (
    (event.shiftKey && selectionKeys.includes(event.key)) || 
    (event.ctrlKey && event.key === 'a') // Ctrl+A 全选
  ) {
    // 稍微延迟检查，确保选择已完成
    setTimeout(checkKeyboardSelection, 10);
  }
}); 
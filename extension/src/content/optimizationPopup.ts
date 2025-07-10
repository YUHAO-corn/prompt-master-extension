import { showToast } from './toast'; // Assuming toast is used for copy feedback

export let optimizePopupElement: HTMLDivElement | null = null;
// --- State variables for drag and pin ---
let isDragging = false;
let offsetX = 0;
let offsetY = 0;
let isPinned = false;
// --- State variable to store original prompt ---
let originalPrompt: string = '';

/** Helper function to check pin status */
export function isOptimizationPopupPinned(): boolean {
    return isPinned;
}

/** Helper function to set original prompt */
export function setOriginalPrompt(prompt: string): void {
    originalPrompt = prompt;
}

/** Helper function to get original prompt */
export function getOriginalPrompt(): string {
    return originalPrompt;
}

// --- Drag Handlers ---
function onDragMouseDown(event: MouseEvent): void {
    if (!optimizePopupElement || !(event.target as HTMLElement)?.classList.contains('aetherflow-optimize-popup-header')) {
        return; // Only drag by the header
    }
    isDragging = true;
    // Calculate offset from the top-left corner of the popup
    offsetX = event.clientX - optimizePopupElement.offsetLeft;
    offsetY = event.clientY - optimizePopupElement.offsetTop;
    optimizePopupElement.style.cursor = 'grabbing'; // Indicate dragging
    // Add listeners to the window to track mouse movement everywhere
    window.addEventListener('mousemove', onDragMouseMove, true);
    window.addEventListener('mouseup', onDragMouseUp, true);
    event.preventDefault(); // Prevent text selection while dragging header
    event.stopPropagation(); // Prevent triggering lower-level listeners like closing on click outside
}

function onDragMouseMove(event: MouseEvent): void {
    if (!isDragging || !optimizePopupElement) return;
    // Calculate new position
    let newLeft = event.clientX - offsetX;
    let newTop = event.clientY - offsetY;

    // --- Boundary checks (keep within viewport) ---
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const popupWidth = optimizePopupElement.offsetWidth;
    const popupHeight = optimizePopupElement.offsetHeight;
    const margin = 5; // Small margin

    newLeft = Math.max(margin, Math.min(newLeft, viewportWidth - popupWidth - margin));
    newTop = Math.max(margin, Math.min(newTop, viewportHeight - popupHeight - margin));

    optimizePopupElement.style.left = `${newLeft}px`;
    optimizePopupElement.style.top = `${newTop}px`;
}

function onDragMouseUp(): void {
    if (!isDragging || !optimizePopupElement) return;
    isDragging = false;
    optimizePopupElement.style.cursor = 'grab'; // Restore cursor
    // Remove global listeners
    window.removeEventListener('mousemove', onDragMouseMove, true);
    window.removeEventListener('mouseup', onDragMouseUp, true);
}

// --- Pin Handler ---
function togglePinOptimizationPopup(event: MouseEvent): void {
    isPinned = !isPinned;
    const pinButton = event.currentTarget as HTMLButtonElement;
    if (optimizePopupElement) {
        optimizePopupElement.classList.toggle('aetherflow-popup-pinned', isPinned);
    }
    // Update button appearance/title based on pin state
    pinButton.title = isPinned ? 'Unpin window' : 'Pin window';
    // Simple visual feedback: change icon slightly or background (CSS handles this better)
    console.log('Optimization Popup Pinned:', isPinned);
    event.stopPropagation(); // Prevent closing popup when clicking pin button
}

/**
 * Handles the re-optimization request by sending a message to the background script
 */
function handleReoptimizeRequest(event: MouseEvent): void {
    if (!originalPrompt) {
        console.error('[AetherFlow] Cannot reoptimize: No original prompt stored');
        return;
    }

    const reoptimizeButton = event.currentTarget as HTMLButtonElement;
    if (reoptimizeButton) {
        reoptimizeButton.disabled = true;
    }

    // Update UI to show loading state
    const popup = getOrCreateOptimizationPopup();
    showOptimizationLoadingState(popup);

    // Send message to background script to reoptimize
    chrome.runtime.sendMessage(
        {
            type: 'OPTIMIZATION_REQUEST',
            payload: {
                prompt: originalPrompt,
                isReoptimize: true
            }
        },
        (response) => {
            // Optional callback if needed
            console.log('[AetherFlow] Reoptimization request sent:', response);
            // Note: The actual result will be handled by the message listener
            // Button will be re-enabled when result arrives
        }
    );
}

/**
 * Helper function to show loading state in the popup
 */
function showOptimizationLoadingState(popup: HTMLDivElement): void {
    const contentElement = popup.querySelector<HTMLDivElement>('.aetherflow-optimize-popup-content');
    const copyButton = popup.querySelector<HTMLButtonElement>('.aetherflow-popup-copy-button');
    const reoptimizeButton = popup.querySelector<HTMLButtonElement>('.aetherflow-popup-reoptimize-button');

    if (contentElement) {
        // Clear existing content and add loading indicator
        contentElement.innerHTML = '';
        contentElement.classList.add('optimizing');
        
        // 创建加载容器
        const loadingContainer = document.createElement('div');
        loadingContainer.className = 'aetherflow-loading-container';
        
        // 创建加载指示器
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'aetherflow-loading-indicator';
        loadingContainer.appendChild(loadingIndicator);
        
        // 创建加载阶段指示器
        const loadingStages = document.createElement('div');
        loadingStages.className = 'aetherflow-loading-stages';
        
        // 添加4个阶段点
        for (let i = 0; i < 4; i++) {
            const stage = document.createElement('div');
            stage.className = 'aetherflow-loading-stage';
            if (i === 0) stage.classList.add('active'); // 第一个阶段默认激活
            loadingStages.appendChild(stage);
        }
        loadingContainer.appendChild(loadingStages);
        
        // 创建加载消息元素
        const loadingMessage = document.createElement('div');
        loadingMessage.className = 'aetherflow-loading-message';
        loadingMessage.textContent = 'Analyzing text...';
        loadingContainer.appendChild(loadingMessage);
        
        // 添加骨架屏
        const skeleton = document.createElement('div');
        skeleton.className = 'aetherflow-loading-skeleton';
        
        // 添加5条骨架线
        for (let i = 0; i < 5; i++) {
            const line = document.createElement('div');
            line.className = 'aetherflow-skeleton-line';
            skeleton.appendChild(line);
        }
        loadingContainer.appendChild(skeleton);
        
        contentElement.appendChild(loadingContainer);
        
        // 模拟阶段性进度
        simulateOptimizationStages(loadingStages, loadingMessage);
        
        contentElement.scrollTop = 0; // Reset scroll
    }

    // Disable buttons during optimization
    if (copyButton) copyButton.disabled = true;
    if (reoptimizeButton) reoptimizeButton.disabled = true;
}

/**
 * 模拟优化的阶段性进度
 */
function simulateOptimizationStages(stagesElement: HTMLDivElement, messageElement: HTMLDivElement): void {
    const stages = stagesElement.querySelectorAll('.aetherflow-loading-stage');
    const messages = [
        'Analyzing text...',
        'Extracting key information...',
        'Optimizing expression...',
        'Formatting final result...'
    ];
    
    let currentStage = 0;
    
    const interval = setInterval(() => {
        if (currentStage >= stages.length) {
            clearInterval(interval);
            return;
        }
        
        // 清除之前的激活状态
        stages.forEach(stage => stage.classList.remove('active'));
        
        // 激活当前阶段
        stages[currentStage].classList.add('active');
        
        // 更新消息
        messageElement.textContent = messages[currentStage];
        
        currentStage++;
        
        // 如果是最后一个阶段，不再继续
        if (currentStage >= stages.length) {
            clearInterval(interval);
        }
    }, 1200); // 每1.2秒更新一次阶段
}

// --- Message Listener --- 
// Listen for results from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'OPTIMIZATION_RESULT') {
        console.log('[AetherFlow Popup Listener] Received OPTIMIZATION_RESULT.');
        const optimizedContent = message.payload?.optimizedContent;
        const error = message.payload?.error; // 假设错误信息也在 payload 中
        
        // Ensure the popup exists
        const popup = getOrCreateOptimizationPopup(); 
        const contentElement = popup.querySelector<HTMLDivElement>('.aetherflow-optimize-popup-content');
        const copyButton = popup.querySelector<HTMLButtonElement>('.aetherflow-popup-copy-button');
        const reoptimizeButton = popup.querySelector<HTMLButtonElement>('.aetherflow-popup-reoptimize-button');
        
        // Log the state of the content element BEFORE trying to update
        console.log('[AetherFlow Popup Listener] Content element BEFORE update:', contentElement); 
        
        if (contentElement) {
            // Remove optimizing class and clear any loading indicators
            contentElement.classList.remove('optimizing');
            contentElement.innerHTML = '';
            
            if (error) {
                console.error('[AetherFlow Popup Listener] Optimization failed with error:', error);
                contentElement.textContent = `Optimization failed: ${error.message || 'Please try again later'}`;
                if (copyButton) copyButton.disabled = true; // 保持禁用复制按钮
                if (reoptimizeButton) reoptimizeButton.disabled = false; // 启用重新优化按钮
            } else if (optimizedContent) {
                console.log('[AetherFlow Popup Listener] Attempting to set textContent with new optimized content...');
                
                // 创建视图切换控件
                const viewToggle = document.createElement('div');
                viewToggle.className = 'aetherflow-view-toggle';
                
                const toggleLabel = document.createElement('span');
                toggleLabel.className = 'aetherflow-view-toggle-label';
                toggleLabel.textContent = 'View mode:';
                viewToggle.appendChild(toggleLabel);
                
                const toggleButtons = document.createElement('div');
                toggleButtons.className = 'aetherflow-view-toggle-buttons';
                
                const resultButton = document.createElement('button');
                resultButton.className = 'aetherflow-view-toggle-button active';
                resultButton.textContent = 'Result only';
                resultButton.dataset.view = 'result';
                
                const splitButton = document.createElement('button');
                splitButton.className = 'aetherflow-view-toggle-button';
                splitButton.textContent = 'Compare view';
                splitButton.dataset.view = 'split';
                
                toggleButtons.appendChild(resultButton);
                toggleButtons.appendChild(splitButton);
                viewToggle.appendChild(toggleButtons);
                
                // 创建内容包装器
                const contentWrapper = document.createElement('div');
                contentWrapper.className = 'aetherflow-optimize-content-wrapper';
                
                // 创建原始内容区域
                const originalContent = document.createElement('div');
                originalContent.className = 'aetherflow-optimize-original';
                originalContent.textContent = getOriginalPrompt();
                contentWrapper.appendChild(originalContent);
                
                // 创建优化结果区域
                const resultContent = document.createElement('div');
                resultContent.className = 'aetherflow-optimize-result';
                resultContent.textContent = optimizedContent;
                contentWrapper.appendChild(resultContent);
                
                // 添加视图切换控件和内容到主容器
                contentElement.appendChild(viewToggle);
                contentElement.appendChild(contentWrapper);
                
                // 添加视图切换按钮的点击事件
                const toggleView = (e: Event) => {
                    const target = e.target as HTMLButtonElement;
                    if (!target || !target.dataset.view) return;
                    
                    // 更新按钮状态
                    toggleButtons.querySelectorAll('button').forEach(btn => {
                        btn.classList.remove('active');
                    });
                    target.classList.add('active');
                    
                    // 更新视图
                    if (target.dataset.view === 'split') {
                        contentWrapper.classList.add('split-view');
                    } else {
                        contentWrapper.classList.remove('split-view');
                    }
                };
                
                toggleButtons.querySelectorAll('button').forEach(btn => {
                    btn.addEventListener('click', toggleView);
                });
                
                if (copyButton) copyButton.disabled = false; // 启用复制按钮
                if (reoptimizeButton) reoptimizeButton.disabled = false; // 启用重新优化按钮
                console.log('[AetherFlow Popup Listener] Set content and enabled buttons. Scroll top.');
                contentElement.scrollTop = 0;
            } else {
                console.warn('[AetherFlow Popup Listener] Received optimization result but content and error are missing or empty.');
                contentElement.textContent = 'Failed to retrieve optimization result. Please try again later.';
                if (copyButton) copyButton.disabled = true;
                if (reoptimizeButton) reoptimizeButton.disabled = false; // 启用重新优化按钮
            }
        } else {
            console.error('[AetherFlow Popup Listener] Cannot update content because content element (.aetherflow-optimize-popup-content) not found within popup!');
        }

        // --- New: Dynamic Popup Adjustment After Content Update ---
        if (popup && popup.style.display !== 'none') {
            // Ensure popup is visible before making calculations
            requestAnimationFrame(() => { // Use requestAnimationFrame for smoother rendering after DOM update
                const margin = 20; //Viewport margin
                let popupHeight = popup.offsetHeight;
                let popupWidth = popup.offsetWidth; // Though width is mostly fixed by CSS max-width

                // Set to bottom-right alignment first (in case it was dragged)
                popup.style.left = 'auto';
                popup.style.top = 'auto';
                popup.style.right = `${margin}px`;
                popup.style.bottom = `${margin}px`;

                // Recalculate height after forced reflow from style changes if necessary, though offsetHeight should be fine
                popupHeight = popup.offsetHeight;

                const viewportHeight = window.innerHeight;
                const viewportWidth = window.innerWidth;

                // Adjust if it overflows the top
                if (popup.offsetTop < margin) { // offsetTop is calculated relative to offsetParent or document body if fixed
                    popup.style.top = `${margin}px`;
                    // If it was anchored to bottom, and now top is also set, bottom might need to be 'auto'
                    popup.style.bottom = 'auto'; 
                    // And we might need to constrain its height if it's too tall for the viewport after top alignment
                    const availableHeight = viewportHeight - (2 * margin);
                    if (popupHeight > availableHeight) {
                        popup.style.maxHeight = `${availableHeight}px`; 
                        // Note: CSS already has max-height, this would be a dynamic override if needed
                        // Or, rely on CSS max-height and internal scrollbar of contentElement
                    }
                }
                // Adjust if it overflows the left (less likely with right-alignment and max-width)
                if (popup.offsetLeft < margin) {
                    popup.style.left = `${margin}px`;
                    popup.style.right = 'auto';
                }
            });
        }
        return true; // Indicates message handled
    }
    return false;
});

/**
 * 处理复制优化文本的功能
 */
function handleCopyOptimizedText(event: MouseEvent): void {
  const copyButton = event.currentTarget as HTMLButtonElement;
  if (!copyButton || !optimizePopupElement) return;

  const resultElement = optimizePopupElement.querySelector('.aetherflow-optimize-result');
  if (resultElement) {
    const originalButtonHTML = copyButton.innerHTML;
    const textToCopy = resultElement.textContent || '';

    navigator.clipboard.writeText(textToCopy).then(() => {
      console.log('Optimized text copied!');
      // Change button to checkmark
      copyButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>Copied!</span>`;
      copyButton.disabled = true;

      // Restore button after a delay
      setTimeout(() => {
        copyButton.innerHTML = originalButtonHTML;
        copyButton.disabled = false;
      }, 1500); 
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      alert('Failed to copy. Please try again.'); 
    });
  }
}

/**
 * Placeholder function to hide the optimization popup.
 * TODO: Implement hiding logic.
 */
export function hideOptimizationPopup(): void {
  if (optimizePopupElement) {
    optimizePopupElement.style.display = 'none';
    console.log('[Capture Script] Hiding optimization popup.');
    // 可选：当弹窗隐藏时，也重置其内容和状态，以防下次意外显示旧内容
    const contentElement = optimizePopupElement.querySelector<HTMLDivElement>('.aetherflow-optimize-popup-content');
    const copyButton = optimizePopupElement.querySelector<HTMLButtonElement>('.aetherflow-popup-copy-button'); 
    const reoptimizeButton = optimizePopupElement.querySelector<HTMLButtonElement>('.aetherflow-popup-reoptimize-button');
    
    if (contentElement) {
        contentElement.textContent = ''; // 清空内容
        contentElement.classList.remove('optimizing');
    }
    if (copyButton) {
        copyButton.disabled = true; // 禁用复制按钮
    }
    if (reoptimizeButton) {
        reoptimizeButton.disabled = true; // 禁用重新优化按钮
    }
    
    // 清除原始提示词，因为窗口已关闭
    originalPrompt = '';
    console.log('[Capture Script] Original prompt cleared on popup close.');
  }
}

/**
 * Shows the optimization popup near the specified button coordinates,
 * ensuring it stays within the viewport.
 * @param buttonRect The DOMRect of the button that triggered the popup.
 * @param isNewOptimizationRequest Indicates if this is for a brand new optimization, requiring UI reset.
 */
export function showOptimizationPopup(buttonRect: DOMRect, isNewOptimizationRequest: boolean = true): void {
    const popup = getOrCreateOptimizationPopup();
    if (!popup) return;

    console.log(`[AetherFlow Popup] showOptimizationPopup called. Is new request: ${isNewOptimizationRequest}`);

    if (isNewOptimizationRequest) {
        console.log('[AetherFlow Popup] New optimization request: Resetting UI and showing loading state.');
        showOptimizationLoadingState(popup);
    }

    // --- New Positioning Logic: Bottom-right with dynamic adjustment --- 
    popup.style.display = 'flex'; // Use flex as per CSS
    popup.style.opacity = '0'; // Start hidden for smooth transition
    popup.style.transition = 'opacity 0.2s ease-in-out, transform 0.2s ease-in-out';
    popup.style.transform = 'translateY(10px)'; // Initial transform for entry animation

    // Set initial position to bottom-right of viewport
    const margin = 20; // 20px margin from viewport edges
    popup.style.right = `${margin}px`;
    popup.style.bottom = `${margin}px`;
    popup.style.left = 'auto'; // Ensure left is not set from previous drag
    popup.style.top = 'auto';   // Ensure top is not set from previous drag

    // Allow CSS to define max-width and max-height initially
    // JS will adjust if needed after content loading if it would overflow top

    // Fade in and slide up animation
    setTimeout(() => {
        popup.style.opacity = '1';
        popup.style.transform = 'translateY(0)';
    }, 10); // Short delay to allow CSS transition to apply
}

/**
 * Creates or gets the optimization result popup DOM element.
 * @returns The popup DOM element.
 */
export function getOrCreateOptimizationPopup(): HTMLDivElement {
  if (!optimizePopupElement) {
    console.log('[Capture Script] Creating optimization result popup element.');
    optimizePopupElement = document.createElement('div');
    optimizePopupElement.className = 'aetherflow-optimize-popup';
    optimizePopupElement.style.position = 'fixed';
    optimizePopupElement.style.display = 'none'; // Hidden by default
    optimizePopupElement.style.zIndex = '10002'; // 确保在其他元素之上

    // Prevent clicks inside the popup from closing it via the global listener
    // This should NOT stop propagation for the header mousedown for dragging
    optimizePopupElement.addEventListener('mousedown', (e) => {
        // Only stop propagation if the click is NOT on the header itself
        if (!(e.target as HTMLElement)?.closest('.aetherflow-optimize-popup-header')) {
             e.stopPropagation();
        }
    });

    // --- Popup Header (Drag Handle & Controls) ---
    const header = document.createElement('div');
    header.className = 'aetherflow-optimize-popup-header';
    // 添加拖动标题提示
    const titleSpan = document.createElement('span');
    titleSpan.textContent = 'Optimization Result';
    titleSpan.style.marginRight = 'auto';
    titleSpan.style.fontWeight = '500';
    titleSpan.style.fontSize = '12px';
    titleSpan.style.opacity = '0.8';
    header.appendChild(titleSpan);
    
    header.addEventListener('mousedown', onDragMouseDown); // Add drag listener here

    // Header controls container (to keep pin/close buttons grouped)
    const controls = document.createElement('div');
    controls.className = 'aetherflow-optimize-popup-controls';


    // Add Pin Button
    const pinButton = document.createElement('button');
    pinButton.className = 'aetherflow-popup-pin-button aetherflow-modal-control-button';
    pinButton.title = 'Pin window';
    // Simple pin icon (e.g., from Lucide or similar) - Placeholder SVG
    pinButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
        </svg>`;
    pinButton.addEventListener('click', togglePinOptimizationPopup);
    controls.appendChild(pinButton); // Add pin button first

    const closeButton = document.createElement('button');
    closeButton.className = 'aetherflow-popup-close-button aetherflow-modal-control-button';
    closeButton.title = 'Close';
    // Use X icon
    closeButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>`;
    closeButton.addEventListener('click', hideOptimizationPopup);
    controls.appendChild(closeButton); // Add close button after pin

    header.appendChild(controls); // Add controls group to header
    optimizePopupElement.appendChild(header);

    // --- Popup Content Area ---
    const contentArea = document.createElement('div');
    contentArea.className = 'aetherflow-optimize-popup-content';
    optimizePopupElement.appendChild(contentArea);

    // --- Popup Footer (For buttons) ---
    const footer = document.createElement('div');
    footer.className = 'aetherflow-optimize-popup-footer';

    // Add Reoptimize Button (New)
    const reoptimizeButton = document.createElement('button');
    reoptimizeButton.className = 'aetherflow-popup-reoptimize-button aetherflow-popup-button';
    reoptimizeButton.title = 'Reoptimize with original prompt';
    reoptimizeButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 4v6h-6"></path>
            <path d="M1 20v-6h6"></path>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"></path>
            <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"></path>
        </svg>
        <span>Reoptimize</span>`;
    reoptimizeButton.addEventListener('click', handleReoptimizeRequest);
    footer.appendChild(reoptimizeButton);

    // Add Copy Button
    const copyButton = document.createElement('button');
    copyButton.className = 'aetherflow-popup-copy-button aetherflow-popup-button';
    copyButton.title = 'Copy optimized text';
    // Use Copy icon
    copyButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        <span>Copy</span>`; // Add text label for clarity
    copyButton.addEventListener('click', handleCopyOptimizedText);
    footer.appendChild(copyButton);
    
    optimizePopupElement.appendChild(footer);

    // Append to body once, hide/show using display style
    document.body.appendChild(optimizePopupElement);
  }
  return optimizePopupElement;
} 
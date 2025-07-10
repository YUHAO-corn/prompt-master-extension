import { showToastNotification } from './toastNotification';
import { CHECK_QUOTA, SAVE_PROMPT_CAPTURE } from '@/types/centralState';
import { safeLogger } from '@/utils/safeEnvironment';

// --- Interfaces & Types ---
interface PreviewModalState {
    modal: HTMLDivElement;
    header: HTMLDivElement;
    titleInput: HTMLInputElement;
    contentTextArea: HTMLTextAreaElement;
    optimizeLink: HTMLButtonElement;
    saveButton: HTMLButtonElement;
    pinButton: HTMLButtonElement;
    closeButton: HTMLButtonElement;
    titleSpinner: HTMLSpanElement;
    metadataContainer: HTMLDivElement;
    createdTimeElement: HTMLSpanElement;
    sourceElement: HTMLAnchorElement;
    isPinned: boolean;
    isDragging: boolean;
    offsetX: number;
    offsetY: number;
    sourceUrl?: string;
}

// --- Module State ---
export let previewModalState: PreviewModalState | null = null;

// --- DOM Creation ---
function createModalElements(): PreviewModalState {
    // 创建和添加样式
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .aetherflow-capture-modal {
            width: 300px; /* 固定更小的宽度 */
            max-width: 300px;
            min-width: 250px;
            height: 400px; /* 固定更小的高度 */
            max-height: 400px;
            min-height: 350px;
            display: flex;
            flex-direction: column;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            font-size: 13px; /* 整体字体缩小 */
        }
        
        .aetherflow-capture-modal-header {
            padding: 8px 10px;
        }
        
        .aetherflow-capture-modal-body {
            flex: 1;
            overflow-y: auto;
            padding: 8px 10px;
        }
        
        .aetherflow-capture-modal-footer {
            padding: 8px 10px;
        }
        
        .aetherflow-capture-title-area label,
        .aetherflow-capture-content-area label {
            margin-bottom: 4px;
            display: block;
        }
        
        .aetherflow-capture-metadata {
            font-size: 12px;
            margin: 5px 0;
        }
        
        .aetherflow-capture-content-area {
            display: flex;
            flex-direction: column;
            height: 100%;
        }
        
        .aetherflow-capture-content-area textarea {
            flex: 1;
            min-height: 100px;
            resize: none;
        }
        
        .aetherflow-capture-optimize-link span {
            font-size: 0.8em; /* 字体缩小 */
        }
        
        .aetherflow-capture-title-area,
        .aetherflow-capture-metadata {
            margin-bottom: 8px;
        }
        
        /* 响应式设计 */
        @media (max-width: 768px) {
            .aetherflow-capture-modal {
                width: 90vw;
                max-width: 300px;
                height: 80vh;
                max-height: 400px;
            }
        }
        
        @media (max-height: 600px) {
            .aetherflow-capture-modal {
                height: 90vh;
                max-height: 350px;
            }
        }
    `;
    document.head.appendChild(styleElement);

    const modal = document.createElement('div');
    modal.className = 'aetherflow-capture-modal';
    modal.style.display = 'none'; // Initially hidden

    // --- Header (Draggable) ---
    const header = document.createElement('div');
    header.className = 'aetherflow-capture-modal-header';

    const titleElement = document.createElement('h2');
    titleElement.className = 'aetherflow-capture-modal-title';
    titleElement.textContent = 'Save to AetherFlow';

    const controls = document.createElement('div');
    controls.className = 'aetherflow-capture-modal-controls';

    const pinButton = document.createElement('button');
    pinButton.className = 'aetherflow-capture-pin-button aetherflow-modal-control-button';
    pinButton.title = 'Pin window';
    pinButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
        </svg>`;

    const closeButton = document.createElement('button');
    closeButton.className = 'aetherflow-capture-close-button aetherflow-modal-control-button';
    closeButton.title = 'Close';
    closeButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>`;

    controls.appendChild(pinButton);
    controls.appendChild(closeButton);
    header.appendChild(titleElement);
    header.appendChild(controls);
    modal.appendChild(header);

    // --- Body ---
    const body = document.createElement('div');
    body.className = 'aetherflow-capture-modal-body';

    const titleArea = document.createElement('div');
    titleArea.className = 'aetherflow-capture-title-area';
    const titleLabel = document.createElement('label');
    titleLabel.htmlFor = 'aetherflow-capture-title';
    titleLabel.textContent = 'Title';
    const titleInputContainer = document.createElement('div');
    titleInputContainer.className = 'aetherflow-capture-title-input-container';
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.id = 'aetherflow-capture-title';
    titleInput.placeholder = 'Enter title (auto-generating...)';
    const titleSpinner = document.createElement('span');
    titleSpinner.className = 'aetherflow-capture-title-spinner';
    titleSpinner.style.display = 'none';
    titleSpinner.innerHTML = '⏳';
    titleInputContainer.appendChild(titleInput);
    titleInputContainer.appendChild(titleSpinner);
    titleArea.appendChild(titleLabel);
    titleArea.appendChild(titleInputContainer);

    // --- 新增元数据区域 (创建时间和来源) ---
    const metadataContainer = document.createElement('div');
    metadataContainer.className = 'aetherflow-capture-metadata';
    
    // 创建时间行
    const createdTimeRow = document.createElement('div');
    createdTimeRow.className = 'aetherflow-capture-metadata-row';
    const createdTimeLabel = document.createElement('span');
    createdTimeLabel.className = 'aetherflow-capture-metadata-label';
    createdTimeLabel.textContent = 'created';
    
    const createdTimeElement = document.createElement('span');
    createdTimeElement.className = 'aetherflow-capture-metadata-value';
    // 获取当前日期并格式化为 YYYY-MM-DD
    const currentDate = new Date();
    const formattedDate = currentDate.toISOString().split('T')[0]; // 格式为 YYYY-MM-DD
    createdTimeElement.textContent = formattedDate;
    
    createdTimeRow.appendChild(createdTimeLabel);
    createdTimeRow.appendChild(createdTimeElement);
    
    // 来源行
    const sourceRow = document.createElement('div');
    sourceRow.className = 'aetherflow-capture-metadata-row';
    const sourceLabel = document.createElement('span');
    sourceLabel.className = 'aetherflow-capture-metadata-label';
    sourceLabel.textContent = 'source';
    
    const sourceElement = document.createElement('a');
    sourceElement.className = 'aetherflow-capture-metadata-value aetherflow-capture-source-link';
    sourceElement.textContent = '';
    sourceElement.target = '_blank'; // 在新标签页打开
    
    sourceRow.appendChild(sourceLabel);
    sourceRow.appendChild(sourceElement);
    
    metadataContainer.appendChild(createdTimeRow);
    metadataContainer.appendChild(sourceRow);

    const contentArea = document.createElement('div');
    contentArea.className = 'aetherflow-capture-content-area';
    const contentLabel = document.createElement('label');
    contentLabel.htmlFor = 'aetherflow-capture-content';
    contentLabel.textContent = 'Content';
    const contentTextArea = document.createElement('textarea');
    contentTextArea.id = 'aetherflow-capture-content';
    contentTextArea.style.whiteSpace = 'pre-wrap';
    contentTextArea.style.wordWrap = 'break-word';
    contentTextArea.style.overflowWrap = 'break-word';
    contentTextArea.spellcheck = false; // 禁用拼写检查，保持文本样式一致
    contentArea.appendChild(contentLabel);
    contentArea.appendChild(contentTextArea);

    body.appendChild(titleArea);
    body.appendChild(metadataContainer); // 添加元数据区域
    body.appendChild(contentArea);
    modal.appendChild(body);

    // --- Footer ---
    const footer = document.createElement('div');
    footer.className = 'aetherflow-capture-modal-footer';

    const optimizeLink = document.createElement('button');
    optimizeLink.className = 'aetherflow-capture-optimize-link'; // Use link class
    optimizeLink.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" class="optimize-icon">
            <path d="M12 2l2.24 7.37L22 12l-7.37 2.24L12 22l-2.24-7.37L2 12l7.37-2.24L12 2z"/>
        </svg>
        <span>Optimize Content</span>
    `;
    optimizeLink.title = 'Optimize the current content'; // Add tooltip

    const saveButton = document.createElement('button');
    saveButton.className = 'aetherflow-capture-modal-save-button';
    saveButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>Save</span>
    `;

    footer.appendChild(optimizeLink);
    footer.appendChild(saveButton);
    modal.appendChild(footer);

    // --- 检测内容区域是否可滚动的辅助函数
    function checkScrollable() {
        if (!contentTextArea) return;
        
        const contentArea = contentTextArea.parentElement;
        if (!contentArea) return;
        
        // 如果内容高度大于容器高度，则添加可滚动标记
        if (contentTextArea.scrollHeight > contentTextArea.clientHeight) {
            contentArea.classList.add('scrollable');
        } else {
            contentArea.classList.remove('scrollable');
        }
    }

    // 添加文本区域内容变化的监听器
    contentTextArea.addEventListener('input', checkScrollable);
    // 添加文本区域滚动事件的监听器
    contentTextArea.addEventListener('scroll', function() {
        const contentArea = this.parentElement;
        if (!contentArea) return;
        
        // 当滚动到底部时隐藏阴影
        if (this.scrollHeight - this.scrollTop <= this.clientHeight + 10) {
            contentArea.classList.remove('scrollable');
        } else {
            contentArea.classList.add('scrollable');
        }
    });

    document.body.appendChild(modal);

    return {
        modal, header, titleInput, contentTextArea, optimizeLink, saveButton,
        pinButton, closeButton, titleSpinner, metadataContainer, createdTimeElement, sourceElement,
        isPinned: false, isDragging: false, offsetX: 0, offsetY: 0
    };
}

// --- Event Handlers ---

async function handleSaveClick(): Promise<void> {
    if (!previewModalState) return;
    const { titleInput, contentTextArea, saveButton } = previewModalState;
    const title = titleInput.value.trim();
    const content = contentTextArea.value.trim();

    if (!title || !content) {
        showToastNotification('Title and content cannot be empty.', 'error');
        return;
    }

    // Disable button during check/save
    saveButton.disabled = true;
    saveButton.classList.add('aetherflow-button-loading');

    try {
        safeLogger.log('[PreviewModal] Checking storage quota before saving capture...');
        const quotaResponse = await chrome.runtime.sendMessage({ type: CHECK_QUOTA, payload: { feature: 'storage' } });

        if (!(quotaResponse && typeof quotaResponse.allowed === 'boolean')) {
             safeLogger.error('[PreviewModal] Invalid response received for CHECK_QUOTA:', quotaResponse);
             showToastNotification('Failed to check quota. Please try again.', 'error');
             saveButton.disabled = false;
             saveButton.classList.remove('aetherflow-button-loading');
             return;
        }

        if (!quotaResponse.allowed) {
            safeLogger.warn('[PreviewModal] Storage quota exceeded (checked via background).');
            showToastNotification('Storage limit reached. Upgrade to Pro to save more.', 'error');
            saveButton.disabled = false;
             saveButton.classList.remove('aetherflow-button-loading');
            return;
        }

        safeLogger.log('[PreviewModal] Quota check passed. Sending SAVE_PROMPT_CAPTURE...');
        chrome.runtime.sendMessage({ 
            type: SAVE_PROMPT_CAPTURE, 
            payload: { 
                title, 
                content, 
                sourceUrl: previewModalState?.sourceUrl
            } 
        }, (response) => {
             saveButton.disabled = false;
             saveButton.classList.remove('aetherflow-button-loading');

            if (chrome.runtime.lastError) {
                safeLogger.error('Error sending save message:', chrome.runtime.lastError);
                showToastNotification(`Failed to save: ${chrome.runtime.lastError.message || 'Connection error'}`, 'error');
            } else if (response?.success) {
                safeLogger.log('Save successful response:', response);
                showToastNotification('Prompt saved successfully!', 'success');
                hidePreviewModal();
            } else {
                safeLogger.error('Save failed response:', response);
                showToastNotification(`Failed to save: ${response?.error || 'Unknown error'}`, 'error');
            }
        });

    } catch (error) {
        safeLogger.error('[PreviewModal] Error during quota check sendMessage:', error);
        showToastNotification('Error checking quota. Please try again.', 'error');
        saveButton.disabled = false;
        saveButton.classList.remove('aetherflow-button-loading');
    }
}

async function handleOptimizeModalContentClick(): Promise<void> {
    if (!previewModalState) return;
    const { modal, contentTextArea, optimizeLink } = previewModalState;
    const contentToOptimize = contentTextArea.value;

    if (!contentToOptimize.trim()) {
        safeLogger.warn('[PreviewModal] Content is empty, nothing to optimize.');
        showToastNotification('Content is empty, cannot optimize.', 'error');
        return;
    }

    optimizeLink.disabled = true;
    optimizeLink.classList.add('aetherflow-button-loading');
    modal.classList.remove('aetherflow-modal-loading');

    try {
        safeLogger.log('[PreviewModal] Checking optimization quota before optimizing content...');
        const quotaResponse = await chrome.runtime.sendMessage({ 
            type: CHECK_QUOTA, 
            payload: { feature: 'optimization' } 
        });

        if (!(quotaResponse && typeof quotaResponse.allowed === 'boolean')) {
            safeLogger.error('[PreviewModal] Invalid response received for CHECK_QUOTA (optimization):', quotaResponse);
            showToastNotification('Failed to check optimization quota. Please try again.', 'error');
            optimizeLink.disabled = false;
            optimizeLink.classList.remove('aetherflow-button-loading');
            return;
        }

        if (!quotaResponse.allowed) {
            safeLogger.warn('[PreviewModal] Optimization quota exceeded (checked via background).');
            showToastNotification('Optimization limit reached for today. Upgrade to Pro for more.', 'error');
            optimizeLink.disabled = false;
            optimizeLink.classList.remove('aetherflow-button-loading');
            return;
        }

        safeLogger.log('[PreviewModal] Optimization quota check passed. Sending OPTIMIZE_MODAL_CONTENT...');
        modal.classList.add('aetherflow-modal-loading');

        chrome.runtime.sendMessage({ type: 'OPTIMIZE_MODAL_CONTENT', payload: { content: contentToOptimize } }, (response) => {
            optimizeLink.disabled = false;
            optimizeLink.classList.remove('aetherflow-button-loading');

            if (chrome.runtime.lastError) {
                safeLogger.error('[PreviewModal] Error sending OPTIMIZE_MODAL_CONTENT message:', chrome.runtime.lastError);
                showToastNotification(`Optimization request failed: ${chrome.runtime.lastError.message || 'Connection error'}`, 'error');
                modal.classList.remove('aetherflow-modal-loading');
            } else if (response && !response.success) {
                safeLogger.error('[PreviewModal] Background failed to process OPTIMIZE_MODAL_CONTENT:', response.error);
                showToastNotification(`Optimization request failed: ${response.error?.message || 'Background error'}`, 'error');
                modal.classList.remove('aetherflow-modal-loading');
            } else {
                safeLogger.log('[PreviewModal] OPTIMIZE_MODAL_CONTENT message sent successfully.');
            }
        });

    } catch (error) {
        safeLogger.error('[PreviewModal] Error during optimization quota check sendMessage:', error);
        showToastNotification('Error checking optimization quota. Please try again.', 'error');
        optimizeLink.disabled = false;
        optimizeLink.classList.remove('aetherflow-button-loading');
    }
}

function togglePinModal(): void {
    if (!previewModalState) return;
    previewModalState.isPinned = !previewModalState.isPinned;
    const { modal, pinButton } = previewModalState;
    modal.classList.toggle('aetherflow-modal-pinned', previewModalState.isPinned);
    pinButton.classList.toggle('active', previewModalState.isPinned);
    pinButton.title = previewModalState.isPinned ? 'Unpin window' : 'Pin window';
    console.log('Modal pinned state:', previewModalState.isPinned);
}

function onDragMouseDown(event: MouseEvent): void {
    if (!previewModalState || !(event.target as HTMLElement)?.closest('.aetherflow-capture-modal-header')) {
        return; // Only drag by the header
    }
    const state = previewModalState;
    state.isDragging = true;
    state.offsetX = event.clientX - state.modal.offsetLeft;
    state.offsetY = event.clientY - state.modal.offsetTop;
    state.modal.style.cursor = 'grabbing';
    state.header.style.cursor = 'grabbing'; // Also set on header

    window.addEventListener('mousemove', onDragMouseMove, true);
    window.addEventListener('mouseup', onDragMouseUp, true);
    event.preventDefault();
}

function onDragMouseMove(event: MouseEvent): void {
    if (!previewModalState?.isDragging) return;
    const state = previewModalState;
    let newLeft = event.clientX - state.offsetX;
    let newTop = event.clientY - state.offsetY;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const modalWidth = state.modal.offsetWidth;
    const modalHeight = state.modal.offsetHeight;
    const margin = 5;

    newLeft = Math.max(margin, Math.min(newLeft, viewportWidth - modalWidth - margin));
    newTop = Math.max(margin, Math.min(newTop, viewportHeight - modalHeight - margin));

    state.modal.style.left = `${newLeft}px`;
    state.modal.style.top = `${newTop}px`;
    state.modal.style.transform = 'translate(0, 0)'; // Override the initial centering transform
}

function onDragMouseUp(): void {
    if (!previewModalState?.isDragging) return;
    const state = previewModalState;
    state.isDragging = false;
    state.modal.style.cursor = 'default';
    state.header.style.cursor = 'grab';

    window.removeEventListener('mousemove', onDragMouseMove, true);
    window.removeEventListener('mouseup', onDragMouseUp, true);
}

function handleTitleInput(): void {
    if (!previewModalState) return;
    previewModalState.titleInput.dataset.edited = 'true';
    previewModalState.titleInput.placeholder = 'Enter title';
}

// --- Message Listeners ---
function setupMessageListeners(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!previewModalState) return false; // Don't handle if modal not initialized

        const { modal, contentTextArea, titleInput, titleSpinner } = previewModalState;

        switch (message.type) {
            case 'MODAL_OPTIMIZATION_RESULT':
                console.log('[PreviewModal] Received MODAL_OPTIMIZATION_RESULT');
                modal.classList.remove('aetherflow-modal-loading');
                const optimizedContent = message.payload?.optimizedContent;
                if (optimizedContent !== undefined) {
                    contentTextArea.value = optimizedContent;
                } else if (message.payload?.error) {
                    console.error('[PreviewModal] Optimization failed:', message.payload.error);
                    showToastNotification(`Optimization failed: ${message.payload.error.message || 'Unknown error'}`, 'error');
                } else {
                    showToastNotification('Optimization failed to update content.', 'error');
                }
                return true; // Async handled

            case 'TITLE_GENERATED':
                console.log('[PreviewModal] Received generated title:', message.payload.title);
                titleSpinner.style.display = 'none';
                if (titleInput.dataset.edited === 'false') {
                    titleInput.value = message.payload.title;
                }
                 // Acknowledge receipt (can send simple success)
                 try {
                     sendResponse({ success: true });
                 } catch (e) {
                     console.warn('[PreviewModal] Could not send response for TITLE_GENERATED.', e);
                 }
                return true; // Indicate async if sendResponse might be called later, otherwise false

            default:
                return false; // Let other listeners handle
        }
    });
}

// --- Initialization and Control ---

function initializeModalState(): PreviewModalState {
    const elements = createModalElements();
    previewModalState = elements;

    // Add event listeners
    elements.saveButton.addEventListener('click', handleSaveClick);
    elements.optimizeLink.addEventListener('click', handleOptimizeModalContentClick);
    elements.pinButton.addEventListener('click', togglePinModal);
    elements.closeButton.addEventListener('click', hidePreviewModal);
    elements.header.addEventListener('mousedown', onDragMouseDown);
    elements.titleInput.addEventListener('input', handleTitleInput);

    // Stop propagation on modal clicks to prevent closing when clicking inside
    elements.modal.addEventListener('mousedown', (e) => {
        // Allow drag initiation on header
        if (!(e.target as HTMLElement)?.closest('.aetherflow-capture-modal-header')) {
            e.stopPropagation();
        }
    });

    setupMessageListeners(); // Setup listeners once
    return elements;
}

export function hidePreviewModal(): void {
    if (!previewModalState) return;
    const { modal, titleInput, contentTextArea, titleSpinner, sourceElement } = previewModalState;
    modal.style.display = 'none';
    // Reset fields and state
    titleInput.value = '';
    contentTextArea.value = '';
    titleSpinner.style.display = 'none';
    titleInput.dataset.edited = 'false';
    // 重置来源信息
    sourceElement.textContent = '';
    sourceElement.removeAttribute('href');
    // 清除过渡效果和样式
    modal.style.transition = '';
    modal.style.opacity = '';
    modal.style.transform = '';

    console.log('Hiding preview modal');
}

export function showPreviewModal(selectedText: string, sourceUrl?: string): void {
    if (!previewModalState) {
        previewModalState = initializeModalState();
    }
    const { modal, titleInput, contentTextArea, titleSpinner, pinButton, sourceElement } = previewModalState;

    // Reset state on show
    previewModalState.isPinned = false;
    modal.classList.remove('aetherflow-modal-pinned', 'aetherflow-modal-loading');
    pinButton.classList.remove('active');
    pinButton.title = 'Pin window';

    // 优化定位逻辑：根据屏幕大小计算合适的位置
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 20; // 20px边距

    // 在小屏幕上居中显示，在大屏幕上右下角显示
    if (viewportWidth < 768) {
        // 小屏幕居中
        modal.style.left = '50%';
        modal.style.top = '50%';
        modal.style.right = 'auto';
        modal.style.bottom = 'auto';
        modal.style.transform = 'translate(-50%, -50%)';
    } else {
        // 大屏幕右下角
        modal.style.right = `${margin}px`;
        modal.style.bottom = `${margin}px`;
        modal.style.left = 'auto';
        modal.style.top = 'auto';
        modal.style.transform = 'none';
    }

    modal.style.cursor = 'default';
    previewModalState.header.style.cursor = 'grab';

    // 添加平滑过渡效果
    modal.style.opacity = '0';
    modal.style.transition = 'opacity 0.2s ease-in-out, transform 0.2s ease-in-out';
    
    // 根据屏幕大小调整动画效果
    if (viewportWidth < 768) {
        modal.style.transform = 'translate(-50%, -50%) scale(0.95)';
    } else {
        modal.style.transform = 'translateY(10px)';
    }

    // Populate content
    contentTextArea.value = selectedText;

    // 设置来源URL
    if (sourceUrl) {
        // 显示域名部分作为可读文本
        try {
            const url = new URL(sourceUrl);
            sourceElement.textContent = url.hostname;
            sourceElement.href = sourceUrl;
            sourceElement.title = sourceUrl; // 完整URL作为悬停提示
        } catch (e) {
            // 如果URL解析失败，直接使用原始URL
            sourceElement.textContent = sourceUrl;
            sourceElement.href = sourceUrl;
        }
    } else {
        sourceElement.textContent = 'Unknown source';
        sourceElement.removeAttribute('href');
    }

    // Set temporary title and prepare for auto-generation
    const tempTitle = selectedText.substring(0, 50).trim().replace(/\n/g, ' ') + (selectedText.length > 50 ? '...' : '');
    titleInput.value = tempTitle;
    titleInput.placeholder = 'Generating title...';
    titleInput.dataset.edited = 'false';

    // Show spinner and request title generation
    titleSpinner.style.display = 'inline-block';
    console.log('[PreviewModal] Requesting title generation...');
    chrome.runtime.sendMessage({ type: 'GENERATE_TITLE', payload: { content: selectedText } }, (response) => {
        if (chrome.runtime.lastError) {
            console.error('[PreviewModal] Error sending GENERATE_TITLE message:', chrome.runtime.lastError);
            titleSpinner.style.display = 'none';
            titleInput.placeholder = 'Enter title';
        } else {
            console.log('[PreviewModal] GENERATE_TITLE message sent, response:', response);
            // Result handled by listener
        }
    });

    // Show the modal
    modal.style.display = 'flex';
    previewModalState.sourceUrl = sourceUrl;
    
    // 应用淡入动画
    setTimeout(() => {
        modal.style.opacity = '1';
        if (viewportWidth < 768) {
            modal.style.transform = 'translate(-50%, -50%) scale(1)';
        } else {
            modal.style.transform = 'translateY(0)';
        }
        // 动画结束后聚焦标题输入框
        setTimeout(() => {
            titleInput.focus();
            titleInput.select();
            
            // 检查内容是否可滚动
            const contentArea = contentTextArea.parentElement;
            if (contentArea && contentTextArea.scrollHeight > contentTextArea.clientHeight) {
                contentArea.classList.add('scrollable');
            }
        }, 200);
    }, 10);
    
    console.log('Showing preview modal');
}

// Note: The global listener in capture.ts (handleMouseDown) still handles closing the modal
// when clicking outside, checking previewModalState.isPinned. 
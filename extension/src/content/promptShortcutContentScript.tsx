import React from 'react';
import ReactDOM from 'react-dom/client';
import PromptShortcutOverlay from '@/components/promptshortcut/PromptShortcutOverlay';
// 导入Floating UI
import { computePosition, flip, shift, offset } from '@floating-ui/dom';
// 注意：我们不直接import searchPrompts，因为内容脚本不应该直接访问Storage
// 而是通过消息机制与Service Worker通信
import { FeatureType, featureUsageService } from '../services/featureUsage';

// 添加类型定义，与promptHandler.ts中的类型保持一致
type Suggestion = {
    id: string;
    title: string;
    content: string;
    createdAt?: number; // 可选的时间戳，用于排序
};

// --- 核心变量 ---
let activeInputTarget: HTMLInputElement | HTMLTextAreaElement | HTMLElement | null = null;
let shadowHost: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let reactRoot: ReactDOM.Root | null = null;
let isOverlayVisible = false;

const AETHERFLOW_PROMPT_SHORTCUT_HOST_ID = 'aetherflow-prompt-shortcut-host';
// CSS文件路径 - 使用runtime.getURL获取路径
const PROMPTSHORTCUT_STYLES_PATH = 'styles/promptShortcut.css';

// --- DOM 操作与UI管理 ---

/**
 * 创建或获取用于承载 Shadow DOM 的宿主元素。
 */
function getOrCreateShadowHost(): HTMLElement {
    if (shadowHost && document.body.contains(shadowHost)) {
        return shadowHost;
    }

    let existingHost = document.getElementById(AETHERFLOW_PROMPT_SHORTCUT_HOST_ID);
    if (existingHost) {
        shadowHost = existingHost;
    } else {
        shadowHost = document.createElement('div');
        shadowHost.id = AETHERFLOW_PROMPT_SHORTCUT_HOST_ID;
        shadowHost.style.position = 'absolute'; // 使用absolute以便精确定位
        shadowHost.style.zIndex = '2147483647'; // 确保在最上层
        document.body.appendChild(shadowHost);
    }
    return shadowHost;
}

/**
 * 将CSS样式注入到Shadow DOM中
 * @param root Shadow DOM根节点
 */
function injectStyles(root: ShadowRoot) {
    try {
        // 使用chrome.runtime.getURL获取完整URL
        const cssUrl = chrome.runtime.getURL(PROMPTSHORTCUT_STYLES_PATH);
        console.log('[PromptShortcut] 样式文件URL:', cssUrl);
        
        // 创建style元素，通过fetch加载CSS内容
        const style = document.createElement('style');
        
        // 获取CSS文件内容并注入
        fetch(cssUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to load CSS: ${response.status} ${response.statusText}`);
                }
                return response.text();
            })
            .then(cssText => {
                style.textContent = cssText;
                console.log('[PromptShortcut] 样式已通过fetch加载并注入');
            })
            .catch(error => {
                console.error('[PromptShortcut] 加载外部CSS失败，使用备用样式:', error);
                // 备用内联样式 - 更新为浅色主题
                style.textContent = `
                    /* 基础样式 - 浅色主题 */
                    .bg-magic-800 { background-color: white; border: 1px solid #e2e8f0; border-radius: 6px; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); }
                    .p-2 { padding: 0.25rem; }
                    .rounded-lg { border-radius: 6px; }
                    .shadow-xl { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.06); }
                    .w-80 { width: 250px; }
                    .text-magic-100 { color: #1e293b; }
                    .flex { display: flex; }
                    .flex-col { flex-direction: column; }
                    
                    /* 输入框和列表的基本样式 */
                    .w-full { width: 100%; }
                    .bg-magic-700 { background-color: white; border: 1px solid #e2e8f0; color: #1e293b; }
                    .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
                    .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
                    .focus\\:outline-none:focus { outline: none; }
                    .focus\\:ring-1:focus { box-shadow: 0 0 0 1px rgb(139, 92, 246); }
                    .focus\\:ring-brand-blue:focus { box-shadow: 0 0 0 1px rgb(139, 92, 246); }
                    
                    /* 其他关键样式 */
                    .mt-2 { margin-top: 0.25rem; }
                    .cursor-pointer { cursor: pointer; }
                    .text-sm { font-size: 0.75rem; line-height: 1.25rem; }
                    .text-center { text-align: center; }
                    .text-magic-300 { color: #64748b; font-size: 0.75rem; }
                    .italic { font-style: italic; }
                    .bg-brand-blue { background-color: rgb(139, 92, 246); color: white; }
                    
                    /* 添加滚动条样式 */
                    .max-h-60 { max-height: 180px; }
                    .overflow-auto { overflow: auto; }
                    .scrollbar-thin::-webkit-scrollbar { width: 4px; height: 4px; }
                    .scrollbar-thin::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.05); }
                    .scrollbar-thin::-webkit-scrollbar-thumb { background-color: rgba(167, 139, 250, 0.5); border-radius: 2px; }
                    
                    /* 高亮和悬停样式 */
                    .bg-magic-700 { background-color: rgba(139, 92, 246, 0.08); }
                    .hover\\:bg-magic-700:hover { background-color: rgba(139, 92, 246, 0.12); }
                    .text-brand-blue { color: rgb(139, 92, 246); }
                `;
            });
        
        // 立即添加style元素，CSS内容会在fetch完成后填充
        root.appendChild(style);
    } catch (error) {
        console.error('[PromptShortcut] 样式注入失败:', error);
        
        // 立即使用内联样式作为兜底方案
        const fallbackStyle = document.createElement('style');
        fallbackStyle.textContent = `
            /* 基础样式 - 简化浅色版 */
            .bg-magic-800 { background-color: white; border: 1px solid #e2e8f0; }
            .text-magic-100 { color: #1e293b; }
            /* 更多基础样式... */
        `;
        root.appendChild(fallbackStyle);
        console.log('[PromptShortcut] 已使用兜底内联样式');
    }
}

/**
 * 初始化 Shadow DOM 和 React 根节点。
 */
function initShadowDomAndReactRoot() {
    if (!shadowHost || !shadowHost.shadowRoot) {
        const host = getOrCreateShadowHost();
        shadowRoot = host.attachShadow({ mode: 'open' });

        // 注入CSS样式到Shadow DOM
        injectStyles(shadowRoot);

        // 在 Shadow DOM 内部创建一个 div 作为 React 组件的挂载点
        const appContainer = document.createElement('div');
        appContainer.id = 'prompt-shortcut-react-root';
        // 确保React根节点没有任何可能导致圆形裁剪的样式
        appContainer.style.borderRadius = '0';
        appContainer.style.overflow = 'visible';
        shadowRoot.appendChild(appContainer);
        reactRoot = ReactDOM.createRoot(appContainer);
        console.log('[PromptShortcut] 已创建Shadow DOM和React根节点');
    } else if (!reactRoot && shadowRoot) {
        // 如果 Shadow DOM 存在但 React Root 未创建 (例如在某些HMR场景下)
        const appContainer = shadowRoot.getElementById('prompt-shortcut-react-root');
        if (appContainer) {
            // 确保React根节点没有任何可能导致圆形裁剪的样式
            appContainer.style.borderRadius = '0';
            appContainer.style.overflow = 'visible';
            reactRoot = ReactDOM.createRoot(appContainer);
            console.log('[PromptShortcut] 已重新创建React根节点');
        } else {
            // eslint-disable-next-line no-console
            console.error('[PromptShortcut] React root container未在Shadow DOM中找到');
            return;
        }
    }
}

/**
 * 更新浮层位置，使其显示在光标位置
 * 使用更准确的方法获取contenteditable元素光标位置
 * @param target 触发功能的输入框元素
 * @param host Shadow DOM宿主元素
 */
async function updateOverlayPosition(target: HTMLElement, host: HTMLElement) {
    try {
        console.log('[PromptShortcut] 开始计算浮层位置');

        // 存储计算得到的光标位置
        let cursorX = 0;
        let cursorY = 0;
        let lineHeight = 0;
        let spaceBelow = 0;
        let spaceAbove = 0;

        // 对不同类型的输入元素使用不同的方法获取光标位置
        if (document.activeElement === target) {
            // 处理标准input和textarea元素
            if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
                // 对于input和textarea使用标准方法
                const rect = target.getBoundingClientRect();
                lineHeight = parseInt(getComputedStyle(target).lineHeight) || parseInt(getComputedStyle(target).fontSize) || 16;
                
                // 创建一个临时span来获取当前光标位置的精确坐标
                const span = document.createElement('span');
                span.textContent = '|'; // 使用竖线作为光标标记
                
                // 创建一个Div元素来复制textarea的样式
                const div = document.createElement('div');
                const computed = window.getComputedStyle(target);
                
                // 复制所有计算样式到div
                for (let prop of Array.from(computed)) {
                    div.style[prop as any] = computed.getPropertyValue(prop);
                }
                
                // 设置div的位置和尺寸
                div.style.position = 'absolute';
                div.style.top = '-9999px';
                div.style.left = '-9999px';
                div.style.height = 'auto';
                div.style.whiteSpace = 'pre-wrap';
                
                // 获取光标前的文本
                const value = target.value;
                const selectionStart = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement 
                    ? target.selectionStart || 0
                    : 0;
                
                // 填充div并添加定位span
                const textBefore = value.substring(0, selectionStart);
                div.textContent = textBefore;
                div.appendChild(span);
                document.body.appendChild(div);
                
                // 获取span的位置
                const spanRect = span.getBoundingClientRect();
                cursorX = spanRect.left + window.scrollX;
                cursorY = spanRect.top + window.scrollY;
                
                // 清理临时元素
                document.body.removeChild(div);
                
                // 如果没有获取到有效坐标，使用输入元素的位置
                if (cursorX <= 0 || cursorY <= 0) {
                    cursorX = rect.left;
                    cursorY = rect.top + lineHeight;
                }
                
                // 计算可用空间
                spaceBelow = window.innerHeight - cursorY;
                spaceAbove = cursorY - lineHeight;
            } 
            // 处理contenteditable元素
            else if (target.isContentEditable) {
                // 使用Selection API获取精确光标位置
                const selection = window.getSelection();
                
                if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    let rect: DOMRect;
                    
                    // 尝试使用范围获取位置
                    if (range.getClientRects().length > 0) {
                        rect = range.getClientRects()[0];
                        lineHeight = rect.height;
                        
                        // 为空范围创建临时内容获取位置
                        if (range.collapsed) {
                            // 保存原始范围
                            const originalRange = range.cloneRange();
                            
                            // 插入临时span元素
                            const tempSpan = document.createElement('span');
                            tempSpan.textContent = '\u200b'; // 零宽空格
                            range.insertNode(tempSpan);
                            
                            // 获取span位置
                            const spanRect = tempSpan.getBoundingClientRect();
                            cursorX = spanRect.left;
                            cursorY = spanRect.bottom;
                            
                            // 删除临时span并恢复原始范围
                            tempSpan.parentNode?.removeChild(tempSpan);
                            selection.removeAllRanges();
                            selection.addRange(originalRange);
                        } else {
                            // 对于非空范围使用范围客户端位置
                            cursorX = rect.left;
                            cursorY = rect.bottom;
                        }
                    } else {
                        // 回退到使用元素位置
                        const targetRect = target.getBoundingClientRect();
                        lineHeight = parseInt(getComputedStyle(target).lineHeight) || parseInt(getComputedStyle(target).fontSize) || 16;
                        cursorX = targetRect.left;
                        cursorY = targetRect.top + lineHeight;
                    }
                    
                    // 计算可用空间
                    spaceBelow = window.innerHeight - cursorY;
                    spaceAbove = cursorY - lineHeight;
                } else {
                    // 无法获取选择，回退到元素位置
                    const rect = target.getBoundingClientRect();
                    lineHeight = parseInt(getComputedStyle(target).lineHeight) || parseInt(getComputedStyle(target).fontSize) || 16;
                    cursorX = rect.left;
                    cursorY = rect.top + lineHeight;
                    spaceBelow = window.innerHeight - cursorY;
                    spaceAbove = cursorY - lineHeight;
                }
            } else {
                // 其他元素类型回退到使用元素位置
                const rect = target.getBoundingClientRect();
                lineHeight = parseInt(getComputedStyle(target).lineHeight) || parseInt(getComputedStyle(target).fontSize) || 16;
                cursorX = rect.left;
                cursorY = rect.bottom;
                spaceBelow = window.innerHeight - rect.bottom;
                spaceAbove = rect.top;
            }
        } else {
            // 目标元素没有焦点，使用元素位置
            const rect = target.getBoundingClientRect();
            lineHeight = parseInt(getComputedStyle(target).lineHeight) || parseInt(getComputedStyle(target).fontSize) || 16;
            cursorX = rect.left;
            cursorY = rect.bottom;
            spaceBelow = window.innerHeight - rect.bottom;
            spaceAbove = rect.top;
        }

        // 记录找到的光标位置
        console.log('[PromptShortcut] 已计算光标位置:', { cursorX, cursorY, spaceBelow, spaceAbove });
        
        // 如果获取到(0,0)或负值，可能是光标位置计算错误，使用元素位置代替
        if (cursorX <= 0 || cursorY <= 0) {
            console.log('[PromptShortcut] 光标位置可能有误，使用元素位置代替');
            const rect = target.getBoundingClientRect();
            cursorX = rect.left;
            cursorY = rect.bottom;
            spaceBelow = window.innerHeight - rect.bottom;
            spaceAbove = rect.top;
        }

        // ===== 改进的浮层位置计算逻辑 =====
        
        // 1. 获取浮层实际高度，或使用预估高度
        // 等待React渲染完成，才能获取准确高度
        await new Promise(resolve => setTimeout(resolve, 0));
        
        // 预估每个建议项高度约为36px，搜索框高度约为40px，还有间隔和边距
        // 通过Chrome存储获取搜索结果数量计算高度
        let estimatedItemCount = 5; // 默认假设最多有5个建议项
        let estimatedHeight = 40 + (estimatedItemCount * 36) + 16; // 搜索框 + 项目 + 间距
        
        // 实际高度优先，如果无法获取则使用估计值
        const actualHeight = host.offsetHeight;
        const overlayHeight = actualHeight > 0 ? actualHeight : estimatedHeight;
        
        // 打印高度信息用于调试
        console.log('[PromptShortcut] 浮层高度计算:', {
            actual: actualHeight,
            estimated: estimatedHeight,
            used: overlayHeight
        });

        // 2. 检查位置并设置
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        
        // 重新计算空间
        spaceBelow = viewportHeight - cursorY;
        spaceAbove = cursorY - lineHeight;
        
        // 判断是否应显示在上方还是下方
        const showAbove = spaceBelow < overlayHeight && spaceAbove > overlayHeight;
        
        if (showAbove) {
            // 显示在上方
            host.style.top = `${window.scrollY + cursorY - overlayHeight}px`;
            host.style.left = `${window.scrollX + cursorX}px`;
            host.style.transformOrigin = 'bottom left';
            console.log('[PromptShortcut] 浮层位置已设置 - 在光标上方');
        } else {
            // 显示在下方
            // 计算底部位置，确保不超出视口
            const bottomEdge = cursorY + overlayHeight;
            const exceedsBottom = bottomEdge > viewportHeight;
            
            if (exceedsBottom) {
                // 超出底部时，尝试上移
                const adjustment = Math.min(bottomEdge - viewportHeight + 10, cursorY - 40); // 至少保留搜索框
                host.style.top = `${window.scrollY + cursorY - adjustment}px`;
                console.log('[PromptShortcut] 浮层上移以避免超出底部:', adjustment);
            } else {
                // 正常显示在下方
                host.style.top = `${window.scrollY + cursorY + 5}px`; // 添加5px的偏移
            }
            
            host.style.left = `${window.scrollX + cursorX}px`;
            host.style.transformOrigin = 'top left';
            console.log('[PromptShortcut] 浮层位置已设置 - 在光标下方');
        }
        
        // 3. 水平方向调整
        // 防止浮层超出视口右侧
        const rightEdge = cursorX + host.offsetWidth;
        if (rightEdge > viewportWidth) {
            const adjustment = rightEdge - viewportWidth + 10; // 添加10px边距
            host.style.left = `${window.scrollX + cursorX - adjustment}px`;
            console.log('[PromptShortcut] 浮层左侧位置已调整，防止超出视口右侧');
        }
        
        // 防止浮层超出视口左侧
        if (cursorX < 10) {
            host.style.left = `${window.scrollX + 10}px`; // 10px左边距
            console.log('[PromptShortcut] 浮层左侧位置已调整，防止超出视口左侧');
        }
    } catch (error) {
        console.error('[PromptShortcut] 计算浮层位置出错', error);
        
        // 出错时使用输入元素位置
        const rect = target.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;
        
        // 根据可用空间决定浮层位置
        if (spaceBelow < 250 && spaceAbove > spaceBelow) {
            // 显示在上方
            host.style.top = `${window.scrollY + rect.top - 10 - host.offsetHeight}px`;
            host.style.left = `${window.scrollX + rect.left}px`;
            host.style.transformOrigin = 'bottom left';
            console.log('[PromptShortcut] 使用兜底方案定位浮层 - 在输入框上方');
        } else {
            // 显示在下方
            host.style.top = `${window.scrollY + rect.bottom + 10}px`;
            host.style.left = `${window.scrollX + rect.left}px`;
            host.style.transformOrigin = 'top left';
            console.log('[PromptShortcut] 使用兜底方案定位浮层 - 在输入框下方');
        }
    }
}

/**
 * 显示并渲染 PromptShortcutOverlay 组件。
 * @param targetElement 触发功能的输入框元素。
 */
function showPromptShortcut(targetElement: HTMLInputElement | HTMLTextAreaElement | HTMLElement) {
    console.log('[PromptShortcut] 开始显示提示词浮层');
    activeInputTarget = targetElement;
    if (!shadowRoot || !reactRoot) {
        initShadowDomAndReactRoot();
    }

    if (!reactRoot || !shadowRoot) {
        // eslint-disable-next-line no-console
        console.error("[PromptShortcut] 初始化React根节点或Shadow DOM失败");
        return;
    }

    // 更新浮层位置
    if (shadowHost && activeInputTarget instanceof HTMLElement) {
        updateOverlayPosition(activeInputTarget, shadowHost);
        
        // 添加全局位置更新函数，供React组件调用
        window.promptShortcutUpdatePosition = () => {
            if (shadowHost && activeInputTarget instanceof HTMLElement && document.body.contains(activeInputTarget)) {
                updateOverlayPosition(activeInputTarget, shadowHost);
            }
        };
    }

    // 无需获取初始提示词，PromptShortcutOverlay组件会在用户输入搜索词时自行处理
    reactRoot.render(
        React.createElement(PromptShortcutOverlay, {
            onSelectPrompt: handlePromptSelect,
            onClose: hidePromptShortcut,
        })
    );
    isOverlayVisible = true;
    console.log('[PromptShortcut] 提示词浮层已显示');
    
    // 设置输入元素观察器，在输入元素从DOM移除时关闭浮层
    setupInputTargetObserver();
}

/**
 * 处理用户选择提示词的事件。
 * @param promptContent 选中的提示词内容。
 */
function handlePromptSelect(promptContent: string) {
    featureUsageService.trackFeature(
        FeatureType.PROMPT_SHORTCUT_INSERT,
        async () => {
            console.log('[PromptShortcut] 用户选择了提示词，准备插入内容');
            if (activeInputTarget) {
                try {
                    // 插入到输入框
                    if (activeInputTarget instanceof HTMLInputElement || activeInputTarget instanceof HTMLTextAreaElement) {
                        const currentValue = activeInputTarget.value;
                        
                        // 插入提示词
                        activeInputTarget.value = promptContent + currentValue;
                        
                        // 聚焦元素
                        activeInputTarget.focus();
                        
                        // 设置光标到插入内容之后
                        activeInputTarget.setSelectionRange(promptContent.length, promptContent.length);
                        
                        // 模拟输入事件，以便某些依赖input事件的网页能够响应
                        const event = new Event('input', { bubbles: true, cancelable: true });
                        activeInputTarget.dispatchEvent(event);
                        console.log('[PromptShortcut] 已将内容插入到输入框/文本区域并设置光标位置');

                    } else if (activeInputTarget.isContentEditable) {
                        // 对于 contentEditable 元素，插入会复杂一些
                        try {
                            // 清空任何现有选择
                            const selection = window.getSelection();
                            if (!selection) {
                                throw new Error("无法获取window.getSelection()");
                            }
                            
                            // 创建一个范围，指向目标元素的开始位置
                            const range = document.createRange();
                            if (activeInputTarget.firstChild) {
                                range.setStart(activeInputTarget.firstChild, 0);
                                range.collapse(true);
                            } else {
                                range.selectNodeContents(activeInputTarget);
                                range.collapse(true);
                            }
                            
                            // 使用范围创建一个文本节点并插入
                            selection.removeAllRanges();
                            selection.addRange(range);
                            const textNode = document.createTextNode(promptContent);
                            range.insertNode(textNode);
                            
                            // 更新selection到文本节点后
                            range.setStartAfter(textNode);
                            range.collapse(true);
                            selection.removeAllRanges();
                            selection.addRange(range);
                            
                            // 确保元素获得焦点
                            activeInputTarget.focus();
                            
                            // 模拟输入事件
                            const event = new Event('input', { bubbles: true, cancelable: true });
                            activeInputTarget.dispatchEvent(event);
                            console.log('[PromptShortcut] 已将内容插入到可编辑元素');
                        } catch (error) {
                            console.error('[PromptShortcut] 插入到contentEditable元素失败:', error);
                            // 回退方案：简单替换内容
                            activeInputTarget.textContent = promptContent + (activeInputTarget.textContent || '');
                            activeInputTarget.focus();
                            console.log('[PromptShortcut] 使用回退方案插入内容到可编辑元素');
                        }
                    }
                    
                    return { success: true };
                } catch (error) {
                    console.error('[PromptShortcut] 插入内容时出错:', error);
                    throw error;
                }
            } else {
                throw new Error('没有活跃的输入目标元素');
            }
        },
        {
            metadata: {
                contentLength: promptContent.length,
                hasNewlines: promptContent.includes('\n'),
                targetType: activeInputTarget instanceof HTMLInputElement ? 'input' :
                           activeInputTarget instanceof HTMLTextAreaElement ? 'textarea' :
                           activeInputTarget?.isContentEditable ? 'contenteditable' : 'unknown',
                domain: window.location.hostname
            }
        }
    ).catch(error => {
        console.error('[PromptShortcut] 快捷输入追踪失败:', error);
    }).finally(() => {
        hidePromptShortcut();
    });
}

/**
 * 隐藏并卸载 PromptShortcutOverlay 组件。
 */
function hidePromptShortcut() {
    console.log('[PromptShortcut] 开始隐藏提示词浮层');
    if (reactRoot && isOverlayVisible) {
        reactRoot.render(null); // 卸载组件
    }
    if (shadowHost) {
        // 可以选择隐藏宿主元素，或者在不需要时移除
        // shadowHost.style.display = 'none';
    }
    
    // 清除全局更新函数
    if (window.promptShortcutUpdatePosition) {
        window.promptShortcutUpdatePosition = undefined;
    }
    
    // 在隐藏浮层后，确保焦点回到原始输入元素
    if (activeInputTarget) {
        try {
            // 重新聚焦原始输入元素
            activeInputTarget.focus();
            
            // 对于输入框和文本区域，尝试设置光标位置到开头
            if (activeInputTarget instanceof HTMLInputElement || activeInputTarget instanceof HTMLTextAreaElement) {
                // 设置光标到开头
                activeInputTarget.setSelectionRange(0, 0);
            } else if (activeInputTarget.isContentEditable) {
                // 对于contentEditable元素，使用Selection API设置光标
                const selection = window.getSelection();
                if (selection) {
                    const range = document.createRange();
                    
                    // 尝试将光标设置到元素的开始位置
                    if (activeInputTarget.firstChild) {
                        range.setStart(activeInputTarget.firstChild, 0);
                    } else {
                        range.setStart(activeInputTarget, 0);
                    }
                    
                    range.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            }
            
            console.log('[PromptShortcut] 焦点已返回到原始输入元素');
        } catch (error) {
            console.error('[PromptShortcut] 返回焦点到原始输入元素时出错:', error);
        }
    }
    
    isOverlayVisible = false;
    activeInputTarget = null;
    console.log('[PromptShortcut] 提示词浮层已隐藏');
}

// --- 事件监听 ---

/**
 * 处理键盘按下事件，主要用于捕获 '/' 触发。
 * @param event 键盘事件。
 */
function handleKeyDown(event: KeyboardEvent) {
    const target = event.target;
    
    // 增加键盘事件日志，但仅在按下/时输出
    if (event.key === '/') {
        console.log('[PromptShortcut][DEBUG] 键盘事件触发 - 按键:', event.key, '修饰键:', {
            shift: event.shiftKey,
            ctrl: event.ctrlKey,
            alt: event.altKey,
            meta: event.metaKey
        });
        console.log('[PromptShortcut][DEBUG] 事件目标:', target);
    }

    // 检查目标元素类型
    const isInput = target instanceof HTMLInputElement;
    const isTextArea = target instanceof HTMLTextAreaElement;
    const isContentEditable = target instanceof HTMLElement && target.isContentEditable;
    
    if (!(isInput || isTextArea || isContentEditable)) {
        if (event.key === '/') {
            console.log('[PromptShortcut][警告] 目标不是有效的输入元素, 类型:', target instanceof HTMLElement ? target.tagName : typeof target);
        }
        return; // 非目标输入区域，直接返回
    }
    
    // 输出目标元素类型
    if (event.key === '/') {
        if (isInput) console.log('[PromptShortcut][DEBUG] 目标是输入框(INPUT)');
        if (isTextArea) console.log('[PromptShortcut][DEBUG] 目标是文本区域(TEXTAREA)');
        if (isContentEditable) console.log('[PromptShortcut][DEBUG] 目标是可编辑内容(contentEditable)');
    }
    
    // 如果浮层已经显示，则将键盘事件交由浮层处理 (由浮层内部的 SearchInput 捕获)
    if (isOverlayVisible) {
        // 注意：这里我们不阻止事件冒泡，因为浮层内的输入框需要接收这些事件
        // 浮层内部会有自己的事件处理，如 Escape, Tab, Enter, ArrowUp, ArrowDown
        return;
    }

    // 核心触发逻辑：仅当用户键入单个 '/' 时
    if (event.key === '/' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
        // 检查是否是独立输入 `/`，而不是在已有内容中或组合键
        // 只要是单独的 `/` 按下，就尝试触发
        console.log('[PromptShortcut] 检测到"/"键，触发提示词浮层');
        event.preventDefault(); // 阻止 '/' 字符实际输入到页面输入框
        event.stopPropagation(); // 阻止事件冒泡，避免页面上其他监听器响应

        // 确保 Shadow DOM 和 React Root 已初始化
        initShadowDomAndReactRoot(); 
        showPromptShortcut(target as HTMLInputElement | HTMLTextAreaElement | HTMLElement);
    }
}

/**
 * 处理点击事件，用于实现点击外部关闭浮层。
 */
function handleClickOutside(event: MouseEvent) {
    if (isOverlayVisible && shadowHost && !shadowHost.contains(event.target as Node)) {
        // 点击发生在浮层外部
        // 根据需求1.1.2：浮层仍然保持显示，但键盘焦点会转移到被点击的页面元素上。
        // 如果用户再次点击浮层内的输入区域或联想列表，焦点应恢复到浮层。
        // Esc 键仍可关闭浮层。
        console.log("[PromptShortcut] 点击了浮层外部元素，保持浮层显示");
    }
}

// --- 监听浮层相关元素是否从DOM移除 --- 

/**
 * 创建一个MutationObserver，监视activeInputTarget是否从DOM中移除
 * 如果被移除，自动关闭浮层
 */
let inputTargetObserver: MutationObserver | null = null;

function setupInputTargetObserver() {
    if (!activeInputTarget) return;
    
    // 如果已有observer，先断开
    if (inputTargetObserver) {
        inputTargetObserver.disconnect();
    }
    
    // 创建新的observer
    inputTargetObserver = new MutationObserver((mutations) => {
        // 检查当前activeInputTarget是否还在DOM中
        if (activeInputTarget && !document.body.contains(activeInputTarget)) {
            console.log('[PromptShortcut] 输入目标元素已从DOM中移除，关闭浮层');
            hidePromptShortcut();
        }
    });
    
    // 监视document.body的子节点移除
    inputTargetObserver.observe(document.body, { 
        childList: true,
        subtree: true
    });
    console.log('[PromptShortcut] 已设置输入元素DOM移除观察器');
}

// --- 初始化与销毁 ---

/**
 * 初始化内容脚本，附加事件监听器。
 */
function init() {
    console.log('[PromptShortcut][重要] PromptShortcut功能初始化开始 ==========');
    console.log('[PromptShortcut] 当前页面:', window.location.href);
    // 优先使用 keydown 来捕获并阻止 '/' 的默认行为
    document.addEventListener('keydown', handleKeyDown, true); // 使用捕获阶段确保优先处理
    
    // 监听点击事件，处理点击外部
    document.addEventListener('click', handleClickOutside, true);
    
    // 考虑增加监听窗口resize事件，以便在窗口尺寸变化时更新浮层位置
    window.addEventListener('resize', () => {
        if (isOverlayVisible && shadowHost && activeInputTarget) {
            updateOverlayPosition(activeInputTarget, shadowHost);
        }
    });
    
    // 监听页面滚动事件，更新浮层位置
    window.addEventListener('scroll', () => {
        if (isOverlayVisible && shadowHost && activeInputTarget) {
            updateOverlayPosition(activeInputTarget, shadowHost);
        }
    }, { passive: true });

    console.log('[PromptShortcut][重要] PromptShortcut功能初始化完成 ==========');
}

/**
 * 清理函数，移除事件监听器。
 */
function cleanup() {
    document.removeEventListener('keydown', handleKeyDown, true);
    document.removeEventListener('click', handleClickOutside, true);
    window.removeEventListener('resize', () => {});
    window.removeEventListener('scroll', () => {});
    
    if (inputTargetObserver) {
        inputTargetObserver.disconnect();
        inputTargetObserver = null;
    }
    
    hidePromptShortcut();
}

// --- 初始化 ---
init();

// 监听unload事件，执行清理
window.addEventListener('unload', cleanup);

// --- 导出，供HMR使用 ---
export { init, cleanup }; 
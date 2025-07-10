/**
 * Displays a short-lived toast notification on the page.
 * @param message The message to display.
 * @param type The type of notification ('success' or 'error').
 */
export function showToastNotification(message: string, type: 'success' | 'error'): void {
  // Remove any existing toast first
  const existingToast = document.querySelector('.aetherflow-toast-notification');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.className = `aetherflow-toast-notification ${type}`;
  
  // 确保样式已加载
  ensureToastStylesLoaded();

  // 显式设置位置为右下角
  toast.style.position = 'fixed';
  toast.style.bottom = '20px';
  toast.style.right = '20px';
  toast.style.left = 'auto';
  toast.style.top = 'auto';
  toast.style.zIndex = '2147483647'; // 最高层级

  // Simple icon based on type
  const icon = type === 'success' ? '✓' : '✗';
  toast.textContent = `${icon} ${message}`;

  document.body.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
  });

  // Auto dismiss after 3 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    // Remove from DOM after animation
    toast.addEventListener('transitionend', () => {
      if (toast.parentNode) {
        toast.remove();
      }
    });
  }, 3000);
}

/**
 * 确保toast样式已加载
 * 这个函数解决了样式可能未被正确应用的问题
 */
function ensureToastStylesLoaded(): void {
  // 检查是否已存在样式元素
  const styleLink = document.getElementById('aetherflow-toast-styles');
  if (!styleLink) {
    const link = document.createElement('link');
    link.id = 'aetherflow-toast-styles';
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('styles/toast.css');
    document.head.appendChild(link);
    
    // 添加内联样式作为备份，确保通知总是显示在右下角
    const style = document.createElement('style');
    style.textContent = `
      .aetherflow-toast-notification {
        position: fixed !important;
        bottom: 20px !important;
        right: 20px !important;
        left: auto !important;
        top: auto !important;
        z-index: 2147483647 !important;
        opacity: 0;
        transform: translateY(20px);
        transition: opacity 0.3s ease, transform 0.3s ease;
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 3px 6px rgba(0, 0, 0, 0.16);
        max-width: 300px;
      }
      .aetherflow-toast-notification.success {
        background-color: #4CAF50;
        color: white;
      }
      .aetherflow-toast-notification.error {
        background-color: #F44336;
        color: white;
      }
    `;
    document.head.appendChild(style);
  }
} 
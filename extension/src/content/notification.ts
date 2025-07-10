// 显示通知
export function showNotification(message: string, type: 'success' | 'error' | 'info' = 'success'): void {
  // 获取CSS变量
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    :root {
      --content-z-notification: 10600;
    }
  `;
  document.head.appendChild(styleElement);

  // 创建通知容器
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 24px;
    border-radius: 4px;
    font-size: 14px;
    z-index: var(--content-z-notification);
    transition: all 0.3s ease;
    opacity: 0;
    transform: translateY(-20px);
  `;

  // 根据类型设置样式
  switch (type) {
    case 'success':
      container.style.backgroundColor = '#4caf50';
      container.style.color = '#fff';
      break;
    case 'error':
      container.style.backgroundColor = '#f44336';
      container.style.color = '#fff';
      break;
    case 'info':
      container.style.backgroundColor = '#2196f3';
      container.style.color = '#fff';
      break;
  }

  // 设置消息内容
  container.textContent = message;

  // 添加到页面
  document.body.appendChild(container);

  // 触发动画
  setTimeout(() => {
    container.style.opacity = '1';
    container.style.transform = 'translateY(0)';
  }, 10);

  // 3秒后移除
  setTimeout(() => {
    container.style.opacity = '0';
    container.style.transform = 'translateY(-20px)';
    setTimeout(() => {
      document.body.removeChild(container);
      // 清理style元素
      if (document.head.contains(styleElement)) {
        document.head.removeChild(styleElement);
      }
    }, 300);
  }, 3000);
}

// 显示可操作的通知
export function showActionableNotification(
  message: string, 
  actionText: string, 
  actionCallback: () => void,
  type: 'error' | 'warning' = 'error'
): void {
  // 获取CSS变量
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    :root {
      --content-z-notification: 10600;
    }
  `;
  document.head.appendChild(styleElement);

  // 创建通知容器
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px;
    border-radius: 4px;
    font-size: 14px;
    z-index: var(--content-z-notification);
    display: flex;
    align-items: center;
    gap: 12px;
    background-color: ${type === 'error' ? '#f44336' : '#ff9800'};
    color: white;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    transition: all 0.3s ease;
    opacity: 0;
    transform: translateY(-20px);
  `;

  // 消息文本
  const messageText = document.createElement('span');
  messageText.textContent = message;
  container.appendChild(messageText);

  // 操作按钮
  const button = document.createElement('button');
  button.textContent = actionText;
  button.style.cssText = `
    padding: 4px 8px;
    border: none;
    border-radius: 2px;
    background-color: white;
    color: ${type === 'error' ? '#f44336' : '#ff9800'};
    cursor: pointer;
    font-weight: bold;
    transition: background-color 0.2s;
  `;
  
  button.addEventListener('mouseover', () => {
    button.style.backgroundColor = '#f5f5f5';
  });
  
  button.addEventListener('mouseout', () => {
    button.style.backgroundColor = 'white';
  });
  
  button.addEventListener('click', () => {
    actionCallback();
    document.body.removeChild(container);
    // 清理style元素
    if (document.head.contains(styleElement)) {
      document.head.removeChild(styleElement);
    }
  });
  
  container.appendChild(button);

  // 添加到页面
  document.body.appendChild(container);

  // 触发动画
  setTimeout(() => {
    container.style.opacity = '1';
    container.style.transform = 'translateY(0)';
  }, 10);

  // 10秒后自动移除
  setTimeout(() => {
    if (document.body.contains(container)) {
      container.style.opacity = '0';
      container.style.transform = 'translateY(-20px)';
      setTimeout(() => {
        if (document.body.contains(container)) {
          document.body.removeChild(container);
        }
        // 清理style元素
        if (document.head.contains(styleElement)) {
          document.head.removeChild(styleElement);
        }
      }, 300);
    }
  }, 10000);
} 
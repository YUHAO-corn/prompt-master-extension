import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Rocket } from 'lucide-react';

// 引入类型
// !! 修改: 不再需要 FullQuotaInfo !!
import { MembershipQuota } from '../../services/membership';
// 引入认证服务
import { authService } from '../../services/auth';

interface ProPlanCardProps {
  // 显示位置参考元素
  anchorEl: HTMLElement | null;
  // 是否显示卡片
  isVisible: boolean;
  // 关闭卡片的回调
  onClose: () => void;
  // 点击升级按钮回调
  onUpgradeClick?: () => void;
  // 附加类名
  className?: string;
  // 是否显示促销标签
  showPromotion?: boolean;
  // 促销折扣百分比
  promotionPercent?: number;
}

/**
 * 会员计划预览卡片组件
 * 当用户悬停在ProBadge或升级按钮上时显示的会员计划预览卡片
 */
export const ProPlanCard: React.FC<ProPlanCardProps> = ({
  anchorEl,
  isVisible,
  onClose,
  onUpgradeClick,
  className = '',
  showPromotion = true,
  promotionPercent = 30
}) => {
  const [position, setPosition] = useState({ top: 0, left: 0, direction: 'down' });
  const cardRef = useRef<HTMLDivElement>(null);
  
  // 处理升级按钮点击 (修改后)
  const handleUpgradeClick = useCallback(async () => {
    console.log('[ProPlanCard Debug] handleUpgradeClick called.');

    if (onUpgradeClick) {
      onUpgradeClick();
    } else {
      try {
        // 新增：尝试获取带认证令牌的URL
        const targetPath = '/pricing.html';
        const params = { source: 'plan_card' }; 
        console.log('[ProPlanCard] 用户点击升级按钮，尝试生成认证URL');
        console.log('[ProPlanCard Debug] Calling generateWebsiteAuthUrl with targetPath:', targetPath, 'and params:', params);
        const authUrl = await authService.generateWebsiteAuthUrl(targetPath, params);
        console.log('[ProPlanCard Debug] generateWebsiteAuthUrl returned:', authUrl);
        console.log('[ProPlanCard Debug] Opening window with URL:', authUrl);
        window.open(authUrl, '_blank');
      } catch (error) {
        console.error('[ProPlanCard] 生成认证URL失败，跳转普通URL:', error);
        // MODIFIED: Use environment variable for fallback URL
        const fallbackBaseUrl = process.env.PAYMENT_PAGE_BASE_URL;
        const fallbackUrl = `${fallbackBaseUrl}/pricing.html?source=plan_card`; // Construct URL using env var
        console.error('[ProPlanCard Debug] Opening fallback window with URL:', fallbackUrl);
        window.open(fallbackUrl, '_blank');
      }
    }
    onClose();
  }, [onUpgradeClick, onClose]);
  
  // 处理查看所有计划链接点击 (修改后，同样使用认证URL)
  const handleViewAllPlans = useCallback(async () => {
    console.log('[ProPlanCard Debug] handleViewAllPlans called.');

    try {
      const targetPath = '/pricing.html';
      const params = { source: 'view_all_plans' };
      console.log('[ProPlanCard] 用户点击查看所有计划，尝试生成认证URL');
      console.log('[ProPlanCard Debug] Calling generateWebsiteAuthUrl with targetPath:', targetPath, 'and params:', params);
      const authUrl = await authService.generateWebsiteAuthUrl(targetPath, params);
      console.log('[ProPlanCard Debug] generateWebsiteAuthUrl returned:', authUrl);
      console.log('[ProPlanCard Debug] Opening window with URL:', authUrl);
      window.open(authUrl, '_blank');
    } catch (error) {
      console.error('[ProPlanCard] 生成认证URL失败，跳转普通URL:', error);
      // MODIFIED: Use environment variable for fallback URL
      const fallbackBaseUrl = process.env.PAYMENT_PAGE_BASE_URL;
      const fallbackUrl = `${fallbackBaseUrl}/pricing.html?source=view_all_plans`; // Construct URL using env var
      console.error('[ProPlanCard Debug] Opening fallback window with URL:', fallbackUrl);
      window.open(fallbackUrl, '_blank');
    }
    onClose();
  }, [onClose]);
  
  // 计算卡片位置 - 优化位置计算逻辑，考虑Portal渲染
  useEffect(() => {
    if (anchorEl && isVisible && cardRef.current) {
      // 获取锚点元素的位置和尺寸（相对于视口）
      const anchorRect = anchorEl.getBoundingClientRect();
      
      // 获取卡片尺寸
      const cardRect = cardRef.current.getBoundingClientRect();
      
      // 获取窗口高度和宽度
      const windowHeight = window.innerHeight;
      const windowWidth = window.innerWidth;
      
      // 检查锚点是在页面左侧还是右侧
      const isAnchorOnLeftSide = anchorRect.left < windowWidth / 2;
      
      // 确定水平位置 - 考虑锚点位置和卡片宽度
      let left = 0;
      
      // 如果锚点在页面左侧，则卡片向右展开
      if (isAnchorOnLeftSide) {
        left = anchorRect.left;
      } else {
        // 如果锚点在页面右侧，确保卡片显示在锚点左侧不超出屏幕
        left = Math.max(0, anchorRect.right - cardRect.width);
      }
      
      // 确保卡片不超出屏幕
      const maxLeft = windowWidth - cardRect.width - 8;
      left = Math.min(Math.max(8, left), maxLeft);
      
      // 判断是否有足够空间向下展示
      const spaceBelow = windowHeight - anchorRect.bottom;
      const spaceAbove = anchorRect.top;
      
      let top = 0;
      let direction: 'up' | 'down';
      
      // 如果下方空间足够或比上方空间大，则向下展示
      if (spaceBelow >= cardRect.height || spaceBelow >= spaceAbove) {
        top = anchorRect.bottom + 8;
        direction = 'down';
      } else {
        // 否则向上展示
        top = anchorRect.top - cardRect.height - 8;
        direction = 'up';
      }
      
      // 确保卡片不超出屏幕顶部或底部
      if (top < 8) {
        top = 8;
      } else if (top + cardRect.height > windowHeight - 8) {
        top = windowHeight - cardRect.height - 8;
      }
      
      // 使用固定定位，位置相对于视口
      setPosition({ top, left, direction });
    }
  }, [anchorEl, isVisible]);
  
  // 如果不可见，不渲染内容
  if (!isVisible) return null;
  
  // 动画类
  const animationClass = position.direction === 'down' 
    ? 'animate-slide-in-down' 
    : 'animate-slide-in-up';
  
  // 基础样式类
  const baseClasses = `
    fixed z-[9999] bg-gradient-to-br from-purple-50 to-white
    shadow-xl rounded-xl p-4 w-[300px] 
    overflow-hidden transition-opacity duration-200
    ${animationClass} ${className}
  `;
  
  return (
    <div
      ref={cardRef}
      className={baseClasses}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        position: 'fixed', // 使用固定定位，相对于视口
        pointerEvents: 'auto' // 确保卡片可以接收鼠标事件
      }}
      onClick={(e) => e.stopPropagation()} // 防止点击卡片时触发外部点击事件
    >
      {/* 促销标签 */}
      {showPromotion && (
        <div className="absolute top-0 right-0 bg-purple-600 text-white px-3 py-1 rounded-bl-lg rounded-tr-lg text-xs font-bold">
          {promotionPercent}% OFF
        </div>
      )}
      
      {/* 标题和图标 */}
      <div className="flex items-start mb-4">
        <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-2 rounded-lg mr-3">
          <Rocket className="text-white" size={20} />
        </div>
        <h3 className="text-lg font-bold text-gray-800 leading-tight">
          your best AI conversations, always at your fingertips
        </h3>
      </div>
      
      {/* 权益列表 */}
      <ul className="space-y-2 mb-5">
        <li className="flex items-start text-sm text-gray-700">
          <span className="text-green-500 mr-2">✓</span>
          <span>Store up to 100 prompts (Free: 5)</span>
        </li>
        <li className="flex items-start text-sm text-gray-700">
          <span className="text-green-500 mr-2">✓</span>
          <span>50 optimizations daily (Free: 3)</span>
        </li>
        <li className="flex items-start text-sm text-gray-700">
          <span className="text-green-500 mr-2">✓</span>
          <span>Multi-device sync & export</span>
        </li>
        <li className="flex items-start text-sm text-gray-700">
          <span className="text-green-500 mr-2">✓</span>
          <span>Early access to new features</span>
        </li>
      </ul>
      
      {/* 按钮区域 */}
      <div className="space-y-2">
        <button
          onClick={handleUpgradeClick}
          className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors duration-200"
        >
          Upgrade Now
        </button>
        
        <div className="text-center">
          <button
            onClick={handleViewAllPlans}
            className="text-xs text-purple-600 hover:text-purple-800 font-medium"
          >
            View all plans &gt;
          </button>
        </div>
      </div>
    </div>
  );
}; 
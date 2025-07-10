import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ProPlanCard } from './ProPlanCard';
import { useMembership } from '../../hooks/useMembership';
import { authService } from '../../services/auth';

interface PlanCardConnectorProps {
  children: React.ReactElement;
  triggerType: 'hover' | 'click' | 'both';
  source?: string;
}

/**
 * 计划卡片连接器组件
 * 负责管理ProPlanCard的显示状态，连接触发元素和预览卡片
 */
export const PlanCardConnector: React.FC<PlanCardConnectorProps> = ({
  children,
  triggerType = 'hover',
  source = 'default'
}) => {
  const [isCardVisible, setIsCardVisible] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<number | null>(null);
  const { isProMember } = useMembership();
  
  // 处理鼠标悬停事件
  const handleMouseEnter = useCallback(() => {
    if (triggerType === 'hover' || triggerType === 'both') {
      // 清除任何现有的超时
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      
      // 设置一个短暂的延迟，防止意外触发
      hoverTimeoutRef.current = window.setTimeout(() => {
        if (triggerRef.current) {
          setAnchorEl(triggerRef.current);
          setIsCardVisible(true);
        }
      }, 200);
    }
  }, [triggerType]);
  
  // 处理鼠标离开事件
  const handleMouseLeave = useCallback((e: React.MouseEvent) => {
    if (triggerType === 'hover' || triggerType === 'both') {
      // 清除打开超时
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      
      // 检查鼠标是否移动到卡片上
      // 如果是，则不隐藏卡片
      if (cardRef.current && cardRef.current.contains(e.relatedTarget as Node)) {
        return;
      }
      
      // 设置关闭延迟，防止用户意外离开触发区域
      // 增加延迟时间，给用户更多时间移动到卡片上
      hoverTimeoutRef.current = window.setTimeout(() => {
        setIsCardVisible(false);
      }, 500); // 增加延迟到500ms
    }
  }, [triggerType]);
  
  // 卡片鼠标进入处理
  const handleCardMouseEnter = useCallback(() => {
    // 当鼠标进入卡片区域时，清除任何可能关闭卡片的计时器
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
  }, []);
  
  // 卡片鼠标离开处理
  const handleCardMouseLeave = useCallback((e: React.MouseEvent) => {
    // 如果鼠标回到触发元素，不关闭卡片
    if (triggerRef.current && triggerRef.current.contains(e.relatedTarget as Node)) {
      return;
    }
    
    // 设置关闭延迟
    hoverTimeoutRef.current = window.setTimeout(() => {
      setIsCardVisible(false);
    }, 300);
  }, []);
  
  // 处理点击事件，确保同时处理子组件的原始点击事件
  const handleClick = useCallback((e: React.MouseEvent) => {
    // 为了防止事件冒泡导致触发其他事件处理函数，我们不使用stopPropagation
    // 如果子组件有自己的点击处理函数，仍然可以正常工作
    
    // 仅在triggerType为click或both时处理卡片显示逻辑
    if (triggerType === 'click' || triggerType === 'both') {
      if (triggerRef.current) {
        setAnchorEl(triggerRef.current);
        setIsCardVisible((prev) => !prev);
      }
    }
    
    // 不阻止事件继续传播，这样子组件的onClick也能被触发
  }, [triggerType]);
  
  // 处理卡片关闭
  const handleCloseCard = useCallback(() => {
    setIsCardVisible(false);
  }, []);
  
  // 处理升级按钮点击
  const handleUpgradeClick = useCallback(async () => {
    console.log('[PlanCardConnector Debug] handleUpgradeClick called.');

    try {
      const targetPath = '/pricing.html';
      const params = { source: `${source}_card` }; 
      console.log('[PlanCardConnector] 用户点击升级按钮，尝试生成认证URL');
      console.log('[PlanCardConnector Debug] Calling generateWebsiteAuthUrl with targetPath:', targetPath, 'and params:', params);
      const authUrl = await authService.generateWebsiteAuthUrl(targetPath, params);
      console.log('[PlanCardConnector Debug] generateWebsiteAuthUrl returned:', authUrl);
      console.log('[PlanCardConnector Debug] Opening window with URL:', authUrl);
      window.open(authUrl, '_blank');
    } catch (error) {
      console.error('[PlanCardConnector] 生成认证URL失败，跳转普通URL:', error);
      // Use environment variable for fallback URL in case of error
      const fallbackBaseUrl = process.env.PAYMENT_PAGE_BASE_URL;
      // ADD: Log the fallback base URL
      console.error('[PlanCardConnector Debug] Fallback base URL from env:', fallbackBaseUrl);

      // Ensure fallbackBaseUrl is available, otherwise use a sensible default or throw
      // For now, assuming fallbackBaseUrl will be available via env.
      const targetPath = '/pricing.html'; // Need to redeclare if accessed only in catch
      const params = { source: `${source}_card` }; // Need to redeclare if accessed only in catch

      let fallbackUrl = `${fallbackBaseUrl}${targetPath}`;
      if (params) {
        const urlParams = new URLSearchParams(params);
        fallbackUrl = `${fallbackUrl}?${urlParams.toString()}`;
      }
      console.error('[PlanCardConnector Debug] Opening fallback window with URL:', fallbackUrl);
      window.open(fallbackUrl, '_blank');
    }
    
    setIsCardVisible(false);
  }, [source]);
  
  // 清理超时
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);
  
  // 点击其他地方关闭卡片
  useEffect(() => {
    if (!isCardVisible) return;
    
    const handleOutsideClick = (e: MouseEvent) => {
      // 检查点击是否在触发元素或卡片内
      const isInTrigger = triggerRef.current && triggerRef.current.contains(e.target as Node);
      const isInCard = cardRef.current && cardRef.current.contains(e.target as Node);
      
      if (!isInTrigger && !isInCard) {
        setIsCardVisible(false);
      }
    };
    
    document.addEventListener('mousedown', handleOutsideClick);
    
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isCardVisible]);
  
  // 通过React.cloneElement复制原始子组件并添加连接器的事件处理器
  // 同时保留子组件自己的事件处理器
  const childrenWithProps = React.cloneElement(children, {
    // 保留原有的onClick事件，不覆盖
    // 不直接在这里添加onClick事件，以避免覆盖原有的处理函数
  });
  
  // 创建卡片的Portal，将卡片渲染到body最后，确保不会被其他元素遮挡
  const renderCardPortal = () => {
    if (!isCardVisible) return null;
    
    return createPortal(
      <div
        ref={cardRef}
        onMouseEnter={handleCardMouseEnter}
        onMouseLeave={handleCardMouseLeave}
        className="z-[9999]" // 使用非常高的z-index确保在最顶层
        style={{position: 'relative'}}
      >
        <ProPlanCard
          anchorEl={anchorEl}
          isVisible={isCardVisible}
          onClose={handleCloseCard}
          onUpgradeClick={handleUpgradeClick}
          showPromotion={true}
          promotionPercent={30}
        />
      </div>,
      document.body // 渲染到body元素中，而不是组件的直接父元素
    );
  };
  
  // 在这里改为条件渲染，确保所有钩子函数都被正确调用
  if (isProMember) {
    // 如果是Pro会员，只渲染子元素，不添加事件处理
    return <>{children}</>;
  }
  
  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className="inline-block"
      >
        {childrenWithProps}
      </div>
      
      {/* 使用Portal渲染卡片，确保始终在最顶层 */}
      {renderCardPortal()}
    </>
  );
}; 
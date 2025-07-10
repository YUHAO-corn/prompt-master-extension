import React, { useCallback } from 'react';
import { Rocket, Zap } from 'lucide-react';
import { authService } from '../../services/auth';

interface UpgradeButtonProps {
  // 来源标识(用于跟踪)
  source?: string;
  
  // 是否为Pro会员
  isProMember: boolean;
  
  // 按钮文本(默认为"Upgrade")，仅在非Pro状态显示
  label?: string;
  
  // 点击处理函数
  onClick?: () => void;
  
  // 按钮变体: 'primary', 'text', 'icon'
  variant?: 'primary' | 'text' | 'icon';
  
  // 附加类名
  className?: string;
}

/**
 * 升级按钮组件
 * 显示在侧边栏左下角，用于引导用户升级到Pro版本
 */
export const UpgradeButton: React.FC<UpgradeButtonProps> = ({
  source = 'sidebar',
  isProMember,
  label = 'Upgrade',
  onClick,
  variant = 'primary',
  className = ''
}) => {
  // 处理按钮点击，附加来源信息
  const handleClick = useCallback(async () => {
    console.log('[UpgradeButton Debug] handleClick called.');

    if (onClick) {
      onClick();
    } else {
      // Define targetPath and params outside try/catch
      const targetPath = '/pricing.html';
      const params = { 
        source: source,
        // Only include sensitive info if user is logged in
        // The currentUser check will be done inside the try block
        // ...(currentUser ? { uid: currentUser.uid, email: currentUser.email || '' } : {})
      };

      try {
        console.log('[UpgradeButton Debug] Checking current user state...');
        const currentUser = await authService.getCurrentUser();
        console.log('[UpgradeButton Debug] Current user:', currentUser ? currentUser.uid : 'null');

        // Refine params after checking currentUser
        const refinedParams = {
             ...params, // Include base params (source)
            ...(currentUser ? { uid: currentUser.uid, email: currentUser.email || '' } : {})
        };

        if (currentUser) {
          console.log('[UpgradeButton Debug] User logged in. Attempting to generate authenticated URL.');
          // 用户已登录，生成带认证令牌的URL并跳转到定价页面
          console.log('[UpgradeButton Debug] Calling generateWebsiteAuthUrl with targetPath:', targetPath, 'and params:', refinedParams);
          const authUrl = await authService.generateWebsiteAuthUrl(targetPath, refinedParams);
          console.log('[UpgradeButton Debug] generateWebsiteAuthUrl returned:', authUrl);
          // ADD: Log the URL before opening window
          console.log('[UpgradeButton Debug] Opening window with authenticated URL:', authUrl);
          window.open(authUrl, '_blank');
        } else {
          console.log('[UpgradeButton Debug] User not logged in. Using non-authenticated fallback URL.');
          // 用户未登录，直接跳转到定价页面，不显示弹窗
          // ADD: Use PAYMENT_PAGE_BASE_URL from env for fallback
          const fallbackBaseUrl = process.env.PAYMENT_PAGE_BASE_URL;
           // ADD: Log the fallback URL being constructed
          const nonAuthUrl = `${fallbackBaseUrl}${targetPath}?source=${source}`;
          console.log('[UpgradeButton Debug] Opening window with non-authenticated URL:', nonAuthUrl);
          window.open(nonAuthUrl, '_blank');
        }
      } catch (error) {
        console.error('[UpgradeButton] 跳转到升级页面失败:', error);
        // 降级：如果生成认证URL失败或发生其他错误，使用普通URL
         // ADD: Use PAYMENT_PAGE_BASE_URL from env for error fallback
        const fallbackBaseUrl = process.env.PAYMENT_PAGE_BASE_URL;
         // ADD: Log the error fallback URL being constructed
        const errorFallbackUrl = `${fallbackBaseUrl}${targetPath}?source=${source}`;
        console.error('[UpgradeButton Debug] Opening window with error fallback URL:', errorFallbackUrl);
        window.open(errorFallbackUrl, '_blank');
      }
    }
  }, [onClick, source]);
  
  // 根据会员状态和变体确定样式
  const getButtonClasses = () => {
    // 基础样式
    let baseClasses = 'flex items-center transition-all duration-300 rounded-md';
    
    // Pro会员样式(闪电按钮)
    if (isProMember) {
      return `${baseClasses} text-purple-400 hover:text-purple-300 p-1.5 ${className}`;
    }
    
    // 非Pro会员样式
    switch (variant) {
      case 'primary':
        return `${baseClasses} text-brand-blue hover:text-brand-blue-dark py-1.5 px-3 ${className}`;
      case 'text':
        return `${baseClasses} text-magic-400 hover:text-magic-300 ${className}`;
      case 'icon':
        return `${baseClasses} text-brand-blue hover:text-brand-blue-dark ${className}`;
      default:
        return `${baseClasses} ${className}`;
    }
  };
  
  return (
    <button
      className={getButtonClasses()}
      onClick={handleClick}
      aria-label={isProMember ? 'Pro Membership Activated' : 'Upgrade to Pro Version'}
      title={isProMember ? 'Pro Membership Activated' : 'Upgrade to Pro Version'}
    >
      {isProMember ? (
        <Zap size={14} />
      ) : (
        <>
          {variant !== 'text' && <Rocket size={14} className="mr-1.5" />}
          {variant !== 'icon' && <span>{label}</span>}
        </>
      )}
    </button>
  );
}; 
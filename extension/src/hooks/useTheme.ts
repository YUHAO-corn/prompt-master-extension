import { useState, useEffect } from 'react';

// 定义主题类型
export type Theme = 'light' | 'dark' | 'system';

// 存储主题设置的键名
const THEME_STORAGE_KEY = 'aetherflow_theme_preference';

/**
 * 主题管理Hook，用于切换浅色/深色主题
 */
export function useTheme() {
  // 从本地存储读取初始主题设置，默认为'light'
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      return (savedTheme as Theme) || 'light';
    } catch (error) {
      console.error('Failed to read theme from localStorage:', error);
      return 'light';
    }
  });

  // 获取系统主题偏好
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // 设置主题并保存到本地存储
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      console.log(`Theme set to ${newTheme} and saved to localStorage`);
    } catch (error) {
      console.error('Failed to save theme to localStorage:', error);
    }
  };

  // 监听系统主题变化
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };
    
    // 现代浏览器使用addEventListener，旧版Safari使用addListener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // @ts-ignore: 旧版Safari API
      mediaQuery.addListener(handleChange);
    }
    
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        // @ts-ignore: 旧版Safari API
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  // 初始化时应用主题
  useEffect(() => {
    // 确保仅在组件首次加载时执行一次，立即应用保存的主题
    const initialTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme || 'light';
    
    // 立即更新DOM，不等待状态更新
    applyThemeToDOM(initialTheme, window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    // 如果存储的值与状态不同，更新状态
    if (initialTheme !== theme) {
      setThemeState(initialTheme);
    }
    
    // 记录初始主题设置日志
    console.log(`Initial theme applied: ${initialTheme}`);
  }, []);  // 空依赖数组确保仅执行一次

  // 根据主题设置应用相应的CSS类
  useEffect(() => {
    // 应用主题到DOM
    applyThemeToDOM(theme, systemTheme === 'dark');
    
    // 记录当前主题状态，方便调试
    console.log(`Theme updated: ${theme}, System theme: ${systemTheme}`);
    console.log(`Body classes: ${document.body.className}`);
    console.log(`HTML classes: ${document.documentElement.className}`);
    
  }, [theme, systemTheme]);

  // 辅助函数：应用主题到DOM
  const applyThemeToDOM = (currentTheme: Theme, systemPrefersDark: boolean) => {
    // 移除所有主题相关类名
    document.body.classList.remove('system-theme', 'dark');
    document.documentElement.classList.remove('dark');
    
    if (currentTheme === 'system') {
      // 使用系统主题
      document.body.classList.add('system-theme');
      
      // 如果系统是深色，同时在html和body上应用dark类
      if (systemPrefersDark) {
        document.body.classList.add('dark');
        document.documentElement.classList.add('dark');
      }
    } else if (currentTheme === 'dark') {
      // 使用深色主题，同时在html和body上应用dark类
      document.body.classList.add('dark');
      document.documentElement.classList.add('dark');
    }
    // 浅色主题是默认的，无需添加特殊类名
  };

  return {
    theme,
    setTheme,
    systemTheme
  };
} 
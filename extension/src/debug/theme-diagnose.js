/**
 * 主题诊断工具
 * 在浏览器控制台中运行此工具以诊断主题切换问题
 */

(function() {
  console.group('🔍 AetherFlow 主题诊断');
  
  // 1. 检查 localStorage 中的主题设置
  const storedTheme = localStorage.getItem('aetherflow_theme_preference');
  console.log(`1. localStorage 中的主题设置: ${storedTheme || '未设置 (默认为 light)'}`);
  
  // 2. 检查 HTML 和 BODY 元素上的类
  console.log(`2. HTML 元素类: "${document.documentElement.className}"`);
  console.log(`   BODY 元素类: "${document.body.className}"`);
  
  // 3. 检查系统主题偏好
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  console.log(`3. 系统偏好深色主题: ${systemPrefersDark}`);
  
  // 4. 测试类添加删除
  console.log('4. 测试 DOM 类操作:');
  try {
    // 保存原始类
    const originalHtmlClass = document.documentElement.className;
    const originalBodyClass = document.body.className;
    
    // 测试添加和删除 dark 类
    document.documentElement.classList.add('test-class');
    document.body.classList.add('test-class');
    
    console.log(`   测试类添加: ${document.documentElement.classList.contains('test-class') ? '成功' : '失败'}`);
    
    // 恢复原始类
    document.documentElement.className = originalHtmlClass;
    document.body.className = originalBodyClass;
    
    console.log('   DOM 类操作测试完成');
  } catch (error) {
    console.error('   DOM 类操作测试失败:', error);
  }
  
  // 5. 检查 Tailwind 深色模式检测
  console.log('5. Tailwind 深色模式状态:');
  const isDarkModeActive = document.documentElement.classList.contains('dark');
  console.log(`   当前是否处于深色模式: ${isDarkModeActive}`);
  
  // 6. 检查应用的 CSS 变量
  console.log('6. 当前应用的 CSS 变量:');
  const styles = getComputedStyle(document.documentElement);
  const relevantProperties = [
    'background-color',
    'color',
    '--tw-bg-opacity',
    '--tw-text-opacity'
  ];
  
  relevantProperties.forEach(prop => {
    console.log(`   ${prop}: ${styles.getPropertyValue(prop)}`);
  });
  
  // 7. 提供修复建议
  console.log('7. 修复建议:');
  console.log('   a. 确保 tailwind.config.js 中设置了 darkMode: "class"');
  console.log('   b. 尝试手动强制切换主题:');
  console.log('      window.aetherflow.themeDebug.forceThemeSwitch("dark")');
  console.log('   c. 检查 useTheme.ts 中是否正确应用了 dark 类');
  
  console.groupEnd();
  
  // 提供主题切换函数
  window.fixTheme = function(theme) {
    if (!['light', 'dark', 'system'].includes(theme)) {
      console.error('无效的主题。请使用 "light"、"dark" 或 "system"');
      return;
    }
    
    // 保存到 localStorage
    localStorage.setItem('aetherflow_theme_preference', theme);
    
    // 移除所有主题相关类
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('system-theme', 'dark');
    
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else if (theme === 'system') {
      document.body.classList.add('system-theme');
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
      }
    }
    
    console.log(`已将主题切换为: ${theme}`);
    console.log('请刷新页面查看效果');
  };
  
  console.log('🔧 使用 window.fixTheme("dark") 或 window.fixTheme("light") 切换主题');
})(); 
import { TitleGenerator, generateTitle } from './title-generator';

describe('TitleGenerator', () => {
  // 暴露私有方法以便测试
  const privateMethods = (TitleGenerator as any);
  
  describe('字节计算', () => {
    test('应正确计算字节长度（中文2字节，英文1字节）', () => {
      expect(privateMethods.calculateByteLength('abc')).toBe(3);
      expect(privateMethods.calculateByteLength('中文')).toBe(4);
      expect(privateMethods.calculateByteLength('中文abc')).toBe(7);
      expect(privateMethods.calculateByteLength('')).toBe(0);
    });
  });
  
  describe('智能截断', () => {
    test('不超过字节限制的标题应保持不变', () => {
      const title = 'Short title';
      expect(privateMethods.smartTruncate(title, 30)).toBe(title);
    });
    
    test('超过字节限制的标题应被智能截断', () => {
      const longTitle = 'This is a very long title that should be truncated properly';
      const truncated = privateMethods.smartTruncate(longTitle, 30);
      expect(privateMethods.calculateByteLength(truncated)).toBeLessThanOrEqual(30);
      expect(truncated.endsWith('...')).toBe(true);
    });
    
    test('含有中文的标题应正确截断', () => {
      const mixedTitle = '中文和English混合标题测试';
      const truncated = privateMethods.smartTruncate(mixedTitle, 30);
      expect(privateMethods.calculateByteLength(truncated)).toBeLessThanOrEqual(30);
      expect(truncated.endsWith('...')).toBe(true);
    });
    
    test('应避免在单词中间截断', () => {
      const title = 'Testing word breaking truncation';
      const truncated = privateMethods.smartTruncate(title, 15);
      // 确保不在单词中间截断
      expect(truncated).not.toMatch(/\w\.\.\.$/);
    });
  });
  
  describe('标题生成', () => {
    test('应为空内容生成默认标题', async () => {
      const title = await generateTitle('');
      expect(title).toBe('未命名提示词');
    });
    
    test('所有生成的标题都应该在字节限制内', async () => {
      const testCases = [
        '2023年诺贝尔文学奖公布，挪威作家约翰·福瑟获奖，代表作《晨与夜》。',
        '苹果iPhone15系列正式发布，搭载A16芯片，起售价6999元，新增钛金属材质与USB-C接口',
        '如何使用React Hooks实现状态管理？本教程详细介绍useState和useContext的用法与最佳实践',
        'function calculateTotal(items) { return items.reduce((sum, item) => sum + item.price, 0); }',
        '# 学习笔记\n\n## JavaScript基础\n\n变量声明使用let和const，避免使用var。'
      ];
      
      for (const testCase of testCases) {
        const title = await generateTitle(testCase);
        const byteLength = privateMethods.calculateByteLength(title);
        expect(byteLength).toBeLessThanOrEqual(30);
      }
    });
    
    test('应根据内容类型生成不同风格的标题', async () => {
      // 问题类型
      const questionTitle = await generateTitle('如何使用React Router实现页面导航？');
      expect(questionTitle).toContain('React');
      
      // 代码类型
      const codeTitle = await generateTitle('function sum(a, b) { return a + b; }');
      expect(codeTitle).toContain('函数');
      
      // Markdown类型
      const markdownTitle = await generateTitle('# Git使用指南\n\n## 基本命令');
      expect(markdownTitle).toContain('Git');
    });
  });
}); 
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LibraryTab } from './LibraryTab';
import { usePromptsData } from '../../../hooks/usePromptsData';

// 模拟usePromptsData hook
jest.mock('../../../hooks/usePromptsData', () => ({
  usePromptsData: jest.fn()
}));

// 模拟stringUtils中的方法
jest.mock('../../../utils/stringUtils', () => ({
  calculateByteLength: (str: string): number => str.length,
  smartTruncate: (str: string): string => str // 模拟不进行截断，返回原字符串
}));

describe('LibraryTab component', () => {
  const mockPrompts = [
    {
      id: '1',
      title: 'SEO & Engagement Boosters for [Game Name] - This is a very long title that should be displayed completely without truncation',
      content: 'Test content 1',
      isFavorite: true,
      favorite: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      useCount: 5,
      lastUsed: Date.now(),
      tags: [],
      source: 'user',
      isActive: true
    },
    {
      id: '2',
      title: 'Is [Game Name] Worth Your Time Pros & Cons Analysis for Serious Gamers and Casual Players Alike',
      content: 'Test content 2',
      isFavorite: true,
      favorite: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      useCount: 3,
      lastUsed: Date.now(),
      tags: [],
      source: 'user',
      isActive: true
    }
  ];

  beforeEach(() => {
    // 设置usePromptsData的模拟返回值
    (usePromptsData as jest.Mock).mockReturnValue({
      loading: false,
      prompts: mockPrompts,
      incrementUseCount: jest.fn(),
      deletePrompt: jest.fn(),
      toggleFavorite: jest.fn(),
      searchPrompts: jest.fn().mockResolvedValue(mockPrompts)
    });
  });

  test('renders long titles completely without truncation', async () => {
    render(<LibraryTab />);
    
    // 等待组件完成加载
    await screen.findByText(mockPrompts[0].title);
    
    // 验证长标题是否完整显示
    expect(screen.getByText(mockPrompts[0].title)).toBeInTheDocument();
    expect(screen.getByText(mockPrompts[1].title)).toBeInTheDocument();
    
    // 验证标题元素是否使用了正确的CSS类（不包含文本截断相关的类）
    const titleElements = screen.getAllByText(/SEO|Is \[Game Name\]/);
    titleElements.forEach(element => {
      expect(element).toHaveClass('text-xs', 'font-medium', 'text-magic-300', 'w-full', 'break-words');
      expect(element).not.toHaveClass('overflow-hidden', 'text-ellipsis');
    });
  });
}); 
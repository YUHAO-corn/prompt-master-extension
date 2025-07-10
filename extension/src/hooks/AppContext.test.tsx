import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AppProvider, useAppContext } from './AppContext';

// 模拟Chrome存储API
jest.mock('../services/storage', () => ({
  syncStorage: {
    get: jest.fn(),
    set: jest.fn(),
  },
  localStorage: {
    get: jest.fn(),
    set: jest.fn(),
  }
}));

// 导入模拟的存储服务
import { syncStorage } from '../services/storage';

describe('AppContext', () => {
  // 每个测试前重置模拟
  beforeEach(() => {
    jest.clearAllMocks();
    (syncStorage.get as jest.Mock).mockResolvedValue([]);
    (syncStorage.set as jest.Mock).mockResolvedValue(undefined);
  });

  test('初始状态正确', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AppProvider>{children}</AppProvider>
    );
    
    const { result } = renderHook(() => useAppContext(), { wrapper });
    
    // 初始加载状态为true
    expect(result.current.state.isLoading).toBe(true);
    
    // 等待异步加载完成
    await waitFor(() => expect(result.current.state.isLoading).toBe(false));
    
    // 期望已调用storage.get获取提示词
    expect(syncStorage.get).toHaveBeenCalledWith('prompts');
    
    // 期望加载完成后状态正确
    expect(result.current.state.isLoading).toBe(false);
    expect(result.current.state.activeTab).toBe('library');
    expect(result.current.state.magicianLevel).toBe(1);
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.prompts).toEqual([]);
    expect(result.current.state.currentOptimizationInput).toBe('');
    expect(result.current.state.optimizationVersions).toEqual([]);
  });

  test('切换活动标签', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AppProvider>{children}</AppProvider>
    );
    
    const { result } = renderHook(() => useAppContext(), { wrapper });
    
    // 等待初始加载完成
    await waitFor(() => expect(result.current.state.isLoading).toBe(false));
    
    // 切换到optimize标签
    act(() => {
      result.current.setActiveTab('optimize');
    });
    
    // 检查状态是否更新
    expect(result.current.state.activeTab).toBe('optimize');
    
    // 切换回library标签
    act(() => {
      result.current.setActiveTab('library');
    });
    
    // 检查状态是否更新
    expect(result.current.state.activeTab).toBe('library');
  });

  test('添加提示词', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AppProvider>{children}</AppProvider>
    );
    
    const { result } = renderHook(() => useAppContext(), { wrapper });
    
    // 等待初始加载完成
    await waitFor(() => expect(result.current.state.isLoading).toBe(false));
    
    // 模拟添加提示词
    const newPrompt = {
      title: '测试提示词',
      content: '测试内容',
      isFavorite: false,
      isActive: true,
      useCount: 0,
      lastUsed: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    await act(async () => {
      await result.current.addPrompt(newPrompt);
    });
    
    // 检查提示词是否添加成功
    expect(result.current.state.prompts).toHaveLength(1);
    expect(result.current.state.prompts[0].title).toBe('测试提示词');
    expect(result.current.state.prompts[0].content).toBe('测试内容');
    expect(result.current.state.prompts[0].isFavorite).toBe(false);
    
    // 检查是否调用了storage.set
    expect(syncStorage.set).toHaveBeenCalledWith('prompts', result.current.state.prompts);
  });

  test('提示词收藏状态切换', async () => {
    // 模拟已有提示词数据
    const mockPrompt = {
      id: 'test-id',
      title: '测试提示词',
      content: '测试内容',
      isFavorite: false,
      useCount: 0
    };
    
    (syncStorage.get as jest.Mock).mockResolvedValue([mockPrompt]);
    
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AppProvider>{children}</AppProvider>
    );
    
    const { result } = renderHook(() => useAppContext(), { wrapper });
    
    // 等待初始加载完成
    await waitFor(() => expect(result.current.state.isLoading).toBe(false));
    
    // 确认初始状态
    expect(result.current.state.prompts[0].isFavorite).toBe(false);
    
    // 切换收藏状态
    await act(async () => {
      await result.current.toggleFavorite('test-id');
    });
    
    // 检查收藏状态是否切换
    expect(result.current.state.prompts[0].isFavorite).toBe(true);
    
    // 检查是否调用了storage.set
    expect(syncStorage.set).toHaveBeenCalled();
  });
}); 
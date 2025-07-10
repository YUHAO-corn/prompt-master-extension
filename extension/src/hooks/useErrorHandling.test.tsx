import { renderHook, act } from '@testing-library/react';
import { useErrorHandling } from './useErrorHandling';
import { AppProvider } from './AppContext';
import React from 'react';

// 模拟AppContext
jest.mock('./AppContext', () => ({
  ...jest.requireActual('./AppContext'),
  useAppContext: () => ({
    setError: jest.fn(),
    setIsLoading: jest.fn(),
  }),
}));

describe('useErrorHandling Hook', () => {
  test('withErrorHandling 成功处理异步操作', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AppProvider>{children}</AppProvider>
    );
    
    const { result } = renderHook(() => useErrorHandling(), { wrapper });
    
    const mockSuccessFn = jest.fn().mockResolvedValue('success');
    const wrappedFn = result.current.withErrorHandling(
      mockSuccessFn,
      '操作失败'
    );
    
    let returnValue;
    await act(async () => {
      returnValue = await wrappedFn();
    });
    
    expect(mockSuccessFn).toHaveBeenCalledTimes(1);
    expect(returnValue).toBe('success');
  });
  
  test('withErrorHandling 处理异步操作失败', async () => {
    const mockSetError = jest.fn();
    const mockSetIsLoading = jest.fn();
    
    // 覆盖模拟实现
    jest.mock('./AppContext', () => ({
      ...jest.requireActual('./AppContext'),
      useAppContext: () => ({
        setError: mockSetError,
        setIsLoading: mockSetIsLoading,
      }),
    }));
    
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AppProvider>{children}</AppProvider>
    );
    
    const { result } = renderHook(() => useErrorHandling(), { wrapper });
    
    const mockErrorFn = jest.fn().mockRejectedValue(new Error('测试错误'));
    const wrappedFn = result.current.withErrorHandling(
      mockErrorFn,
      '操作失败'
    );
    
    let returnValue;
    await act(async () => {
      returnValue = await wrappedFn();
    });
    
    expect(mockErrorFn).toHaveBeenCalledTimes(1);
    expect(returnValue).toBeNull();
    expect(mockSetError).toHaveBeenCalledWith('操作失败');
  });
  
  test('handleNetworkError 处理不同类型的网络错误', () => {
    const mockSetError = jest.fn();
    
    // 模拟AppContext
    jest.mock('./AppContext', () => ({
      ...jest.requireActual('./AppContext'),
      useAppContext: () => ({
        setError: mockSetError,
        setIsLoading: jest.fn(),
      })
    }));
    
    const { result } = renderHook(() => useErrorHandling());
    
    // 测试网络连接失败
    act(() => {
      result.current.handleError(new Error('Failed to fetch'), '网络连接失败，请检查您的网络连接');
    });
    
    expect(mockSetError).toHaveBeenCalledWith('网络连接失败，请检查您的网络连接');
    
    // 测试请求超时
    act(() => {
      result.current.handleError(new Error('timeout'), '请求超时，请稍后重试');
    });
    
    expect(mockSetError).toHaveBeenCalledWith('请求超时，请稍后重试');
    
    // 测试其他类型的网络错误
    act(() => {
      result.current.handleError(new Error('其他错误'), '其他错误');
    });
    
    expect(mockSetError).toHaveBeenCalledWith('其他错误');
    
    // 测试默认消息
    act(() => {
      result.current.handleError({ message: undefined }, '默认消息');
    });
    
    expect(mockSetError).toHaveBeenCalledWith('默认消息');
  });
}); 
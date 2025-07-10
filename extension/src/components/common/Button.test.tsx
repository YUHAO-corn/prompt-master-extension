import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button组件', () => {
  test('渲染按钮文本', () => {
    render(<Button>测试按钮</Button>);
    expect(screen.getByText('测试按钮')).toBeInTheDocument();
  });

  test('点击按钮触发onClick事件', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>点击我</Button>);
    
    fireEvent.click(screen.getByText('点击我'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test('禁用状态下按钮不可点击', () => {
    const handleClick = jest.fn();
    render(
      <Button onClick={handleClick} disabled>
        禁用按钮
      </Button>
    );
    
    fireEvent.click(screen.getByText('禁用按钮'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  test('加载状态下显示加载图标', () => {
    render(<Button loading>加载中</Button>);
    expect(screen.getByText('加载中')).toBeInTheDocument();
    // 检查是否存在类名包含animate-spin的元素
    const spinnerElement = document.querySelector('.animate-spin');
    expect(spinnerElement).toBeInTheDocument();
  });

  test('使用图标渲染按钮', () => {
    const TestIcon = () => <span data-testid="test-icon">图标</span>;
    render(<Button icon={<TestIcon />}>带图标的按钮</Button>);
    
    expect(screen.getByText('带图标的按钮')).toBeInTheDocument();
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  test('使用不同变体渲染按钮', () => {
    const { rerender } = render(<Button variant="primary">主要按钮</Button>);
    expect(screen.getByText('主要按钮')).toHaveClass('bg-magic-600');
    
    rerender(<Button variant="secondary">次要按钮</Button>);
    expect(screen.getByText('次要按钮')).toHaveClass('bg-magic-700/30');
  });
}); 
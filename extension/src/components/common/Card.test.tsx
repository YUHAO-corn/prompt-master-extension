import React from 'react';
import { render, screen } from '@testing-library/react';
import { Card } from './Card';

describe('Card组件', () => {
  test('渲染子内容', () => {
    render(
      <Card>
        <p>测试内容</p>
      </Card>
    );
    expect(screen.getByText('测试内容')).toBeInTheDocument();
  });

  test('渲染操作按钮', () => {
    const TestAction = () => <button data-testid="test-action">操作按钮</button>;
    
    render(
      <Card actions={<TestAction />}>
        <p>测试内容</p>
      </Card>
    );
    
    expect(screen.getByText('测试内容')).toBeInTheDocument();
    expect(screen.getByTestId('test-action')).toBeInTheDocument();
    expect(screen.getByText('操作按钮')).toBeInTheDocument();
  });

  test('应用自定义className', () => {
    render(
      <Card className="test-class">
        <p>测试内容</p>
      </Card>
    );
    
    const cardElement = screen.getByText('测试内容').closest('div');
    expect(cardElement).toHaveClass('test-class');
  });
}); 
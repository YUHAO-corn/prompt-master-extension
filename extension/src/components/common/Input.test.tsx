import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from './Input';
import { Search } from 'lucide-react';

describe('Input组件', () => {
  test('渲染输入框', () => {
    render(<Input placeholder="测试占位符" />);
    expect(screen.getByPlaceholderText('测试占位符')).toBeInTheDocument();
  });

  test('处理输入变化', () => {
    const handleChange = jest.fn();
    render(<Input onChange={handleChange} />);
    
    const inputElement = screen.getByRole('textbox');
    fireEvent.change(inputElement, { target: { value: '测试输入' } });
    
    expect(handleChange).toHaveBeenCalled();
  });

  test('使用图标渲染', () => {
    render(<Input icon={<Search data-testid="search-icon" />} />);
    expect(screen.getByTestId('search-icon')).toBeInTheDocument();
  });

  test('应用自定义className', () => {
    render(<Input className="test-class" />);
    const inputContainer = screen.getByRole('textbox').closest('div');
    expect(inputContainer).toHaveClass('test-class');
  });

  test('禁用状态', () => {
    render(<Input disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  test('传递其他props到输入框', () => {
    render(<Input type="password" maxLength={10} />);
    const inputElement = screen.getByRole('textbox');
    expect(inputElement).toHaveAttribute('type', 'password');
    expect(inputElement).toHaveAttribute('maxLength', '10');
  });
}); 
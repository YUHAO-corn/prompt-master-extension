/**
 * 错误边界组件 - 捕获并优雅处理React渲染错误
 * 
 * @note 此组件当前未在项目中主动使用，但保留作为通用组件库的一部分
 * 推荐在顶层组件中使用此组件包裹，以捕获渲染错误
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * 错误边界组件：捕获子组件树中的 JavaScript 错误
 * 并渲染备用 UI 而不是让整个应用崩溃
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // 更新 state 以在下次渲染时显示错误 UI
    return { 
      hasError: true,
      error 
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // 记录错误信息
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // 如果提供了自定义的fallback UI就使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      // 默认错误UI
      return (
        <div className="p-4 flex flex-col items-center justify-center min-h-[200px] text-center bg-magic-800/50 border border-red-800/50 rounded-lg">
          <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-lg font-medium text-magic-200 mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-magic-400 mb-4">
            The application encountered an error. Please try refreshing the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-magic-700 hover:bg-magic-600 text-magic-200 rounded-md transition-colors"
          >
            Refresh page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
} 
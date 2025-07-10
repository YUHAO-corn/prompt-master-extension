/**
 * Toast通知组件 - 显示临时通知消息
 * 
 * @note 此组件当前未在项目中主动使用，但保留作为通用组件库的一部分
 * 可用于任何需要显示临时通知的场景
 */

import React, { useEffect } from 'react';
import { CheckCircle, AlertTriangle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  show: boolean;
  onClose: () => void;
  duration?: number; // Optional duration in ms
}

export function Toast({ 
  message, 
  type = 'success', 
  show, 
  onClose,
  duration = 3000 
}: ToastProps) {
  
  useEffect(() => {
    if (show && duration) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration, onClose]);

  const bgColor = type === 'success' 
    ? 'bg-green-700/80 border-green-600/50' 
    : 'bg-red-800/80 border-red-700/50';
  const textColor = type === 'success' ? 'text-green-100' : 'text-red-100';
  const Icon = type === 'success' ? CheckCircle : AlertTriangle;

  return (
    <div 
      className={`fixed bottom-5 left-1/2 transform -translate-x-1/2 z-toast-container
                  transition-all duration-300 ease-in-out
                  ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
                  ${show ? 'pointer-events-auto' : 'pointer-events-none'}`}
    >
      <div 
        className={`flex items-center justify-between max-w-md w-full p-3 rounded-lg shadow-lg border backdrop-blur-sm ${bgColor}`}
      >
        <div className="flex items-center">
          <Icon size={18} className={`mr-2 ${textColor}`} />
          <span className={`text-sm font-medium ${textColor}`}>{message}</span>
        </div>
        <button onClick={onClose} className={`ml-4 p-0.5 rounded-full hover:bg-black/20 ${textColor}`}>
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

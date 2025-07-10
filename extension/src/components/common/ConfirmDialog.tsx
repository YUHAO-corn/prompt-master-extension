import React, { useEffect } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
  onClose?: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'danger' | 'primary';
  fastAnimation?: boolean;
}

/**
 * 确认对话框组件
 * 
 * 用于显示需要用户确认的操作对话框
 * 
 * @example
 * ```jsx
 * const [isConfirmOpen, setIsConfirmOpen] = useState(false);
 * 
 * // 在组件中
 * <ConfirmDialog
 *   isOpen={isConfirmOpen}
 *   onConfirm={handleConfirmAction}
 *   onCancel={() => setIsConfirmOpen(false)}
 *   title="确认删除"
 *   message="你确定要删除这个提示词吗？此操作不可撤销。"
 *   confirmText="删除"
 *   confirmVariant="danger"
 * />
 * ```
 */
export function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  onClose,
  title = "",
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'primary',
  fastAnimation = false
}: ConfirmDialogProps) {
  const handleCancel = () => {
    if (onClose) {
      onClose();
    }
    if (onCancel) {
      onCancel();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen) {
        if (e.key === 'Escape') {
          handleCancel();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          onConfirm();
        }
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleCancel, onConfirm]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-magic-900/80 backdrop-blur-sm z-modal-backdrop flex items-center justify-center p-4">
      <div className={`bg-white dark:bg-gradient-to-br dark:from-magic-800 dark:to-magic-900 rounded-lg shadow-xl border border-gray-200 dark:border-magic-700/30 w-full max-w-md ${fastAnimation ? 'animate-magic-reveal-fast' : 'animate-magic-reveal'}`}>
        <div className="p-5">
          {title && <h3 className="text-lg font-semibold text-gray-800 dark:text-magic-200 mb-2">{title}</h3>}
          <p className="text-gray-600 dark:text-magic-300 text-sm">{message}</p>
        </div>
        
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-magic-700/30">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-transparent dark:hover:bg-magic-700/50 text-gray-700 dark:text-magic-300 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              confirmVariant === 'danger'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-purple-600 hover:bg-purple-700 dark:bg-magic-600 dark:hover:bg-magic-500 text-white'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
} 
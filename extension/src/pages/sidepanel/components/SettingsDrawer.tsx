import React, { useState, useRef, useEffect } from 'react';
import { X, Download, Check, Cloud, LogOut, HardDrive, Loader2, Keyboard, Paintbrush } from 'lucide-react';
import { useExport } from '../../../hooks/useExport';
import { useAuth } from '../../../hooks/useAuth';
import { authService } from '../../../services/auth';
import { useMembership } from '../../../hooks/useMembership';
import { Toast } from '../../../components/common/Toast';
import { ThemeToggle } from '../../../components/common/ThemeToggle';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsDrawer({ isOpen, onClose }: SettingsDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const { exportToCSV, loading, success, error } = useExport();
  const { user, logout } = useAuth();
  const { isProMember } = useMembership();
  const [isLoadingStorage, setIsLoadingStorage] = useState(false);
  const [useCloudStorage, setUseCloudStorage] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const triggerToast = (message: string, type: 'success' | 'error' = 'error') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
  };
  
  const openShortcutsPage = () => {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  };
  
  useEffect(() => {
    setUseCloudStorage(true);
  }, [user]);

  const toggleCloudStorage = async () => {
    const newState = !useCloudStorage;
    setUseCloudStorage(newState);
    await handleStorageChange(newState);
  };

  const handleStorageChange = async (useCloud: boolean) => {
    setIsLoadingStorage(true);
    try {
      alert('功能暂时禁用：存储模式切换功能当前不可用。请继续使用当前存储模式。');
      onClose();
    } catch (error) {
      console.error('切换存储模式失败:', error);
      alert('切换存储模式失败，请稍后重试。');
    } finally {
      setIsLoadingStorage(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
    } else {
      const timer = setTimeout(() => {
        setMounted(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(event.target as Node) && isOpen) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    function handleEscKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    }

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  if (!mounted) return null;

  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/50 z-drawer-backdrop transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      
      <div 
        ref={drawerRef}
        className={`fixed inset-y-0 right-0 w-80 bg-gradient-to-br from-magic-50 to-white dark:from-magic-800 dark:to-magic-900 border-l border-magic-200/50 dark:border-magic-700/30 shadow-xl z-drawer-container transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between p-4 border-b border-magic-200/70 dark:border-magic-700/30">
          <h3 className="text-lg font-semibold text-magic-700 dark:text-magic-200 truncate">Settings</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-magic-100 dark:hover:bg-magic-700/50 rounded-full transition-colors"
            aria-label="Close Settings"
          >
            <X className="w-5 h-5 text-magic-500 dark:text-magic-400" />
          </button>
        </div>
        
        <div className="p-4 space-y-6 overflow-y-auto max-h-[calc(100vh-60px)]">
          {/* 主题设置部分 */}
          <div>
            <h4 className="text-md font-bold text-magic-700 dark:text-magic-200 mb-4 flex items-center">
              <Paintbrush className="w-5 h-5 mr-2 text-magic-500 dark:text-magic-400" />
              Appearance
            </h4>
            <ThemeToggle />
          </div>

          <div>
          <h4 className="text-md font-bold text-magic-700 dark:text-magic-200 mb-4 flex items-center">
            <Cloud className="w-5 h-5 mr-2 text-magic-500 dark:text-magic-400" />
            Cloud Sync
          </h4>
            <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Cloud className="w-5 h-5 text-magic-500 dark:text-magic-400 mr-2" />
                <span className="text-magic-600 dark:text-magic-300">Enable Cloud Sync</span>
              </div>
              <button 
                onClick={toggleCloudStorage}
                disabled={!user}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  useCloudStorage ? 'bg-magic-500' : 'bg-magic-300 dark:bg-magic-700'
                } ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span 
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform ${
                    useCloudStorage ? 'translate-x-6' : 'translate-x-1'
                  }`} 
                />
              </button>
            </div>
            {!user && (
              <div className="text-sm text-amber-500 dark:text-amber-400 pl-7">
                Login required to use cloud sync
              </div>
            )}
            {user && (
              <div className="text-xs text-magic-500 dark:text-magic-400 pl-7">
                Your prompts will be synced across all your devices when you are logged in
              </div>
            )}
            </div>
          </div>
          
          <div>
          <h4 className="text-md font-bold text-magic-700 dark:text-magic-200 mb-4 flex items-center">
            <Download className="w-5 h-5 mr-2 text-magic-500 dark:text-magic-400" />
            Data Management
          </h4>
          <div className="space-y-4">
            <button
              onClick={() => {
                if (isProMember) {
                  exportToCSV();
                } else {
                  triggerToast(
                    "Exporting prompts requires a Pro membership.",
                    "error"
                  );
                }
              }}
              disabled={loading}
              className={`flex items-center justify-center px-4 py-2 ${
                success && isProMember ? 'bg-green-600' : 
                loading ? 'bg-magic-200 dark:bg-magic-700 cursor-not-allowed' : 
                'bg-magic-600 hover:bg-magic-500'
              } rounded-md text-white transition-colors w-full ${!isProMember && !loading ? 'opacity-70 cursor-help' : ''}`}
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Exporting...
                </span>
              ) : success && isProMember ? (
                <>
                  <Check className="w-4 h-4 mr-2" /> Export Successful
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" /> Export Prompts (CSV)
                </>
              )}
            </button>
          </div>
          
          {error && (
            <div className="mt-2 text-sm text-red-500 dark:text-red-400">
              <p>{error}</p>
            </div>
          )}
          
          <div className="mt-6 text-sm text-magic-500 dark:text-magic-400">
            <p>The CSV file will include all your prompts, including title, content, creation time, and usage count information.</p>
          </div>
          </div>

          <div>
            <h4 className="text-md font-bold text-magic-700 dark:text-magic-200 mb-4 flex items-center">
              <Keyboard className="w-5 h-5 mr-2 text-magic-500 dark:text-magic-400" />
              Keyboard Shortcuts
            </h4>
            <div className="space-y-3 text-magic-600 dark:text-magic-300">
              <p>Default shortcuts (can be customized):</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>
                  <span className="font-mono bg-magic-100 dark:bg-magic-700 px-1.5 py-0.5 rounded">Shift + Ctrl + F</span>: Toggle Sidebar
                </li>
                <li>
                  <span className="font-mono bg-magic-100 dark:bg-magic-700 px-1.5 py-0.5 rounded">Shift + Ctrl + H</span>: Open Capture Window
                </li>
              </ul>
              <p className="text-xs text-magic-500 dark:text-magic-400">
                (On macOS, <span className="font-mono bg-magic-100 dark:bg-magic-700 px-1 py-0.5 rounded">Ctrl</span> is typically replaced by <span className="font-mono bg-magic-100 dark:bg-magic-700 px-1 py-0.5 rounded">Command ⌘</span>)
              </p>
              <button
                onClick={openShortcutsPage}
                className="flex items-center justify-center px-4 py-2 mt-4 bg-magic-600 hover:bg-magic-500 rounded-md text-white transition-colors w-full"
              >
                <Keyboard className="w-4 h-4 mr-2" /> Customize Shortcuts in Chrome
              </button>
            </div>
          </div>

          <Toast 
            message={toastMessage}
            type={toastType}
            show={showToast}
            onClose={() => setShowToast(false)} 
          />
        </div>
      </div>
    </>
  );
} 
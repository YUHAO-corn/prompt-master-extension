import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, User } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';
import { useAuth } from '../../../hooks/useAuth';
import { useAppContext } from '../../../hooks/AppContext';

interface AuthDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthTab = 'login' | 'register' | 'reset';

const AuthDrawer: React.FC<AuthDrawerProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<AuthTab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const { 
    login, 
    register, 
    loginWithGoogle, 
    resetPassword, 
    loading, 
    error,
    loadingMessage
  } = useAuth();
  
  // Get authPromptMessage from AppContext
  const { state: appState } = useAppContext();
  const { authPromptMessage } = appState;
  
  // Reset form when drawer opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab('login');
      setFormError(null);
      setSuccessMessage(null);
    }
  }, [isOpen]);

  // Handle ESC key to close drawer
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);
  
  // Switch tabs
  const switchTab = (tab: AuthTab) => {
    setActiveTab(tab);
    setFormError(null);
    setSuccessMessage(null);
  };
  
  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    
    // Validate form
    if (!email || !password) {
      setFormError('Please fill in all required fields');
      return;
    }
    
    try {
      await login({ email, password });
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Login failed, please check your credentials');
    }
  };
  
  // Handle registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    
    // Validate form
    if (!email || !password || !confirmPassword) {
      setFormError('Please fill in all required fields');
      return;
    }
    
    if (password !== confirmPassword) {
      setFormError('Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      setFormError('Password must be at least 6 characters long');
      return;
    }
    
    try {
      await register({ email, password, displayName });
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Registration failed, please try again');
    }
  };
  
  // Handle password reset
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);
    
    if (!email) {
      setFormError('Please enter your email address');
      return;
    }
    
    try {
      await resetPassword(email);
      setSuccessMessage('Password reset link has been sent to your email');
    } catch (err: any) {
      setFormError(err.message || 'Password reset failed, please try again');
    }
  };
  
  // Handle Google login
  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Google login failed, please try again');
    }
  };
  
  return (
    <>
      {/* Drawer backdrop */}
      <div 
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 z-drawer-backdrop ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      ></div>
      
      {/* Drawer container */}
      <div
        className={`fixed inset-y-0 right-0 w-80 bg-gradient-to-b from-gray-50 to-white dark:from-magic-800 dark:to-magic-900 shadow-xl border-l border-gray-200 dark:border-magic-700/30 transform transition-transform duration-300 ease-in-out z-drawer-container ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-magic-700/30">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-magic-100">
            {activeTab === 'login' ? 'Log In' : activeTab === 'register' ? 'Register' : 'Reset Password'}
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 dark:text-magic-400 dark:hover:text-magic-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex flex-col h-[calc(100%-60px)] overflow-y-auto">
          {/* Tab switching */}
          <div className="flex border-b border-gray-200 dark:border-magic-700/30">
            <button
              onClick={() => switchTab('login')}
              className={`flex-1 py-3 text-sm font-medium transition-all ${
                activeTab === 'login'
                  ? 'text-gray-800 dark:text-magic-200 border-b-2 border-purple-500'
                  : 'text-gray-500 dark:text-magic-400 hover:text-gray-700 dark:hover:text-magic-300'
              }`}
            >
              Log In
            </button>
            <button
              onClick={() => switchTab('register')}
              className={`flex-1 py-3 text-sm font-medium transition-all ${
                activeTab === 'register'
                  ? 'text-gray-800 dark:text-magic-200 border-b-2 border-purple-500'
                  : 'text-gray-500 dark:text-magic-400 hover:text-gray-700 dark:hover:text-magic-300'
              }`}
            >
              Register
            </button>
          </div>
          
          {/* Loading Message (takes precedence over error) */}
          {loadingMessage && (
            <div className="bg-blue-500/20 text-blue-700 dark:text-blue-200 px-4 py-2 text-sm animate-pulse">
              {loadingMessage}
            </div>
          )}
          
          {/* Error alerts (only shown if loadingMessage is not present) */}
          {!loadingMessage && (formError || error) && (
            <div className="bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-200 px-4 py-2 text-sm">
              {formError || error}
            </div>
          )}
          
          {/* Success alerts */}
          {successMessage && (
            <div className="bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-200 px-4 py-2 text-sm">
              {successMessage}
            </div>
          )}
          
          {/* Prompt message from AppContext (shown when no loading message) */}
          {!loadingMessage && authPromptMessage && (
            <div className="bg-yellow-100/80 dark:bg-yellow-500/30 text-yellow-700 dark:text-yellow-100 border border-yellow-300 dark:border-yellow-600 px-4 py-3 text-sm my-3 rounded-md shadow-sm">
              {authPromptMessage}
            </div>
          )}
          
          {/* Form content */}
          <div className="p-6 flex-1">
            {activeTab === 'login' && (
              <form onSubmit={handleLogin}>
                <div className="space-y-4">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <Mail size={16} className="text-gray-400 dark:text-magic-500" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email"
                      className="w-full pl-10 pr-4 py-2 bg-white dark:bg-magic-700 border border-gray-300 dark:border-magic-600 rounded-md text-gray-800 dark:text-magic-200 placeholder-gray-400 dark:placeholder-magic-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={loading}
                    />
                  </div>
                  
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <Lock size={16} className="text-gray-400 dark:text-magic-500" />
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      className="w-full pl-10 pr-4 py-2 bg-white dark:bg-magic-700 border border-gray-300 dark:border-magic-600 rounded-md text-gray-800 dark:text-magic-200 placeholder-gray-400 dark:placeholder-magic-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={loading}
                    />
                  </div>
                  
                  <button
                    type="submit"
                    className="w-full py-2 px-4 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 dark:from-magic-600 dark:to-magic-500 dark:hover:from-magic-700 dark:hover:to-magic-600 text-white font-medium rounded-md shadow transition-all disabled:opacity-50"
                    disabled={loading}
                  >
                    {loading ? 'Logging in...' : 'Log In'}
                  </button>
                  
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => switchTab('reset')}
                      className="text-sm text-gray-500 hover:text-gray-700 dark:text-magic-400 dark:hover:text-magic-300"
                    >
                      Forgot Password?
                    </button>
                  </div>
                </div>
              </form>
            )}
            
            {activeTab === 'register' && (
              <form onSubmit={handleRegister}>
                <div className="space-y-4">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <Mail size={16} className="text-gray-400 dark:text-magic-500" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email"
                      className="w-full pl-10 pr-4 py-2 bg-white dark:bg-magic-700 border border-gray-300 dark:border-magic-600 rounded-lg text-gray-800 dark:text-magic-200 placeholder-gray-400 dark:placeholder-magic-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={loading}
                    />
                  </div>
                  
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <User size={16} className="text-gray-400 dark:text-magic-500" />
                    </div>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Display Name (optional)"
                      className="w-full pl-10 pr-4 py-2 bg-white dark:bg-magic-700 border border-gray-300 dark:border-magic-600 rounded-lg text-gray-800 dark:text-magic-200 placeholder-gray-400 dark:placeholder-magic-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={loading}
                    />
                  </div>
                  
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <Lock size={16} className="text-gray-400 dark:text-magic-500" />
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      className="w-full pl-10 pr-4 py-2 bg-white dark:bg-magic-700 border border-gray-300 dark:border-magic-600 rounded-lg text-gray-800 dark:text-magic-200 placeholder-gray-400 dark:placeholder-magic-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={loading}
                    />
                  </div>
                  
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <Lock size={16} className="text-gray-400 dark:text-magic-500" />
                    </div>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm Password"
                      className="w-full pl-10 pr-4 py-2 bg-white dark:bg-magic-700 border border-gray-300 dark:border-magic-600 rounded-lg text-gray-800 dark:text-magic-200 placeholder-gray-400 dark:placeholder-magic-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={loading}
                    />
                  </div>
                  
                  <button
                    type="submit"
                    className="w-full py-2 px-4 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 dark:from-magic-600 dark:to-magic-500 dark:hover:from-magic-700 dark:hover:to-magic-600 text-white font-medium rounded-md shadow transition-all disabled:opacity-50"
                    disabled={loading}
                  >
                    {loading ? 'Registering...' : 'Register'}
                  </button>
                </div>
              </form>
            )}
            
            {activeTab === 'reset' && (
              <form onSubmit={handleResetPassword}>
                <div className="space-y-4">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <Mail size={16} className="text-gray-400 dark:text-magic-500" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email"
                      className="w-full pl-10 pr-4 py-2 bg-white dark:bg-magic-700 border border-gray-300 dark:border-magic-600 rounded-lg text-gray-800 dark:text-magic-200 placeholder-gray-400 dark:placeholder-magic-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={loading}
                    />
                  </div>
                  
                  <button
                    type="submit"
                    className="w-full py-2 px-4 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 dark:from-magic-600 dark:to-magic-500 dark:hover:from-magic-700 dark:hover:to-magic-600 text-white font-medium rounded-md shadow transition-all disabled:opacity-50"
                    disabled={loading}
                  >
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                  
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => switchTab('login')}
                      className="text-sm text-gray-500 hover:text-gray-700 dark:text-magic-400 dark:hover:text-magic-300"
                    >
                      Back to Login
                    </button>
                  </div>
                </div>
              </form>
            )}
            
            {/* Social login */}
            {activeTab !== 'reset' && (
              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300 dark:border-magic-600"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-gradient-to-b from-gray-50 to-white dark:from-magic-800 dark:to-magic-900 text-gray-500 dark:text-magic-500">
                      or
                    </span>
                  </div>
                </div>
                
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="w-full flex items-center justify-center py-2 px-4 border border-gray-300 dark:border-magic-600 rounded-md shadow-sm text-gray-700 dark:text-magic-200 bg-white dark:bg-magic-700 hover:bg-gray-50 dark:hover:bg-magic-600 transition-all"
                    disabled={loading}
                  >
                    <FcGoogle className="w-4 h-4 mr-2" />
                    <span>Sign in with Google</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default AuthDrawer; 
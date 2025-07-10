import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  error?: string;
}

export function Input({ icon, error, className = '', ...props }: InputProps) {
  return (
    <div className="relative">
      {icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-magic-400">{icon}</div>
      )}
      <input
        className={`w-full ${
          icon ? 'pl-10' : 'pl-4'
        } pr-4 py-2 bg-white dark:bg-magic-800/30 border border-gray-300 dark:border-magic-700/50 rounded-lg text-sm text-gray-700 dark:text-magic-200 placeholder-gray-400 dark:placeholder-magic-500 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-magic-500 focus:border-transparent transition-all duration-300 ${
          error ? 'border-red-500 focus:ring-red-500' : ''
        } ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

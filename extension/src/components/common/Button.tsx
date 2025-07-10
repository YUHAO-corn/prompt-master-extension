import React from 'react';
import { Loader2 } from 'lucide-react';
import { Shimmer } from './Shimmer';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export function Button({
  children,
  variant = 'primary',
  loading = false,
  icon,
  fullWidth = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles =
    'relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center justify-center space-x-2 group overflow-hidden';
  const variantStyles = {
    primary: 'bg-magic-600 text-white hover:bg-magic-500 disabled:bg-magic-800/50',
    secondary: 'bg-magic-700/30 text-magic-200 hover:bg-magic-600/50',
  };
  const widthStyles = fullWidth ? 'w-full' : '';
  const disabledStyles = disabled || loading ? 'cursor-not-allowed opacity-50' : '';

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${widthStyles} ${disabledStyles} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : icon ? (
        <span className="group-hover:scale-110 transition-transform">{icon}</span>
      ) : null}
      <span>{children}</span>
      <Shimmer />
    </button>
  );
}

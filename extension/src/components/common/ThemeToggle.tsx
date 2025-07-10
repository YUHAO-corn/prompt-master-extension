import React, { useEffect } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme, Theme } from '../../hooks/useTheme';

interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
  const { theme, setTheme } = useTheme();

  const options: Array<{
    value: Theme;
    label: string;
    icon: React.ReactNode;
    description: string;
  }> = [
    {
      value: 'light',
      label: 'Light',
      icon: <Sun className="w-4 h-4 text-amber-500" />,
      description: 'Bright interface theme'
    },
    {
      value: 'dark',
      label: 'Dark',
      icon: <Moon className="w-4 h-4 text-indigo-400" />,
      description: 'Dark interface theme'
    },
    {
      value: 'system',
      label: 'System',
      icon: <Monitor className="w-4 h-4 text-gray-500 dark:text-magic-400" />,
      description: 'Follow system settings'
    }
  ];

  useEffect(() => {
    console.log(`ThemeToggle: Current theme is ${theme}`);
  }, [theme]);

  const handleThemeChange = (newTheme: Theme) => {
    if (newTheme === theme) return;

    console.log(`ThemeToggle: Changing theme from ${theme} to ${newTheme}`);

    document.body.classList.remove('system-theme', 'dark');
    document.documentElement.classList.remove('dark');
    
    if (newTheme === 'system') {
      document.body.classList.add('system-theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.body.classList.add('dark');
        document.documentElement.classList.add('dark');
      }
    } else if (newTheme === 'dark') {
      document.body.classList.add('dark');
      document.documentElement.classList.add('dark');
    }

    setTheme(newTheme);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {options.map(option => (
        <div
          key={option.value}
          className={`flex items-center p-3 rounded-md cursor-pointer transition-colors ${
            theme === option.value 
              ? 'bg-purple-100 dark:bg-magic-700/30 border border-purple-200 dark:border-magic-500/30' 
              : 'hover:bg-gray-100 dark:hover:bg-magic-800/50'
          }`}
          onClick={() => handleThemeChange(option.value)}
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-magic-700/30 mr-3">
            {option.icon}
          </div>
          <div className="flex-1">
            <div className="text-gray-800 dark:text-magic-200 font-medium">
              {option.label}
            </div>
            <div className="text-xs text-gray-600 dark:text-magic-400">
              {option.description}
            </div>
          </div>
          {theme === option.value && (
            <div className="w-2 h-2 rounded-full bg-purple-500 mr-1"></div>
          )}
        </div>
      ))}
    </div>
  );
}; 
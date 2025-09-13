import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const ThemeToggle: React.FC = () => {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const toggleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  const getIcon = () => {
    if (theme === 'system') {
      return <Monitor className="h-4 w-4" />;
    }
    return resolvedTheme === 'dark' ? 
      <Moon className="h-4 w-4" /> : 
      <Sun className="h-4 w-4" />;
  };

  const getTooltipText = () => {
    switch (theme) {
      case 'light': return 'ライトモード';
      case 'dark': return 'ダークモード';
      case 'system': return 'システム設定';
      default: return '';
    }
  };

  return (
    <div className="relative group">
      <button
        onClick={toggleTheme}
        className={`
          relative flex items-center justify-center
          w-10 h-10 rounded-full
          transition-all duration-300 ease-in-out
          hover:scale-110 active:scale-95
          ${resolvedTheme === 'dark' 
            ? 'bg-secondary-800 hover:bg-secondary-700 text-secondary-200' 
            : 'bg-secondary-100 hover:bg-secondary-200 text-secondary-700'
          }
          border-2 border-transparent hover:border-primary-500/20
          shadow-soft hover:shadow-medium
        `}
        aria-label={getTooltipText()}
      >
        <div className="transform transition-transform duration-300 ease-in-out">
          {getIcon()}
        </div>
        
        {/* 背景のグラデーション効果 */}
        <div className={`
          absolute inset-0 rounded-full opacity-0 transition-opacity duration-300
          ${resolvedTheme === 'dark' 
            ? 'bg-gradient-to-r from-blue-500/10 to-purple-500/10' 
            : 'bg-gradient-to-r from-yellow-400/10 to-orange-400/10'
          }
          group-hover:opacity-100
        `} />
      </button>

      {/* ツールチップ */}
      <div className={`
        absolute -bottom-10 left-1/2 transform -translate-x-1/2
        px-2 py-1 text-xs font-medium rounded-md
        opacity-0 group-hover:opacity-100
        transition-all duration-200 ease-in-out
        pointer-events-none
        ${resolvedTheme === 'dark' 
          ? 'bg-secondary-800 text-secondary-200 border border-secondary-700' 
          : 'bg-secondary-900 text-white'
        }
        shadow-medium
      `}>
        {getTooltipText()}
        <div className={`
          absolute -top-1 left-1/2 transform -translate-x-1/2
          w-2 h-2 rotate-45
          ${resolvedTheme === 'dark' ? 'bg-secondary-800' : 'bg-secondary-900'}
        `} />
      </div>

      {/* アクティブ状態のインジケーター */}
      {theme !== 'system' && (
        <div className={`
          absolute -top-1 -right-1 w-3 h-3 rounded-full
          ${theme === 'dark' ? 'bg-blue-500' : 'bg-yellow-500'}
          animate-pulse
        `} />
      )}
    </div>
  );
};

export default ThemeToggle; 
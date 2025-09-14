import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, Database, Home, TrendingUp, LogOut, User } from 'lucide-react';
import ThemeToggle from '../ui/ThemeToggle';
import { useAuth } from '../../contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    if (confirm('ログアウトしますか？')) {
      logout();
    }
  };

  const navigation = [
    { name: 'ホーム', href: '/', icon: Home },
    { name: '過去のレポート', href: '/reports', icon: FileText },
    { name: 'ニュース管理', href: '/news-manager', icon: Database },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white/80 dark:bg-secondary-900/80 backdrop-blur-xl border-b border-secondary-200/50 dark:border-secondary-700/50 sticky top-0 z-50 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2 sm:space-x-3 group min-w-0">
              <div className="p-1.5 sm:p-2 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl shadow-medium group-hover:shadow-strong transition-all duration-200 flex-shrink-0">
                <TrendingUp className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-xl font-bold text-secondary-900 dark:text-secondary-100 font-display transition-colors duration-300 truncate">
                  President Office Weekly Brief
                </h1>
                <p className="text-xs text-secondary-500 dark:text-secondary-400 -mt-0.5 transition-colors duration-300 hidden sm:block">
                  週次役員向けブリーフィング
                </p>
              </div>
            </Link>

            {/* Navigation & Theme Toggle */}
            <div className="flex items-center space-x-1 sm:space-x-4">
              <nav className="flex space-x-0.5 sm:space-x-1">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href;
                  const Icon = item.icon;
                  
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`
                        relative px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all duration-200
                        ${isActive 
                          ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30' 
                          : 'text-secondary-600 dark:text-secondary-300 hover:text-secondary-900 dark:hover:text-secondary-100 hover:bg-secondary-50 dark:hover:bg-secondary-800/50'
                        }
                      `}
                    >
                      <div className="flex items-center space-x-1 sm:space-x-2">
                        <Icon className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                        <span className="hidden lg:inline">{item.name}</span>
                      </div>
                      
                      {isActive && (
                        <motion.div
                          layoutId="activeTab"
                          className="absolute inset-0 bg-primary-100 dark:bg-primary-900/30 rounded-lg sm:rounded-xl -z-10 transition-colors duration-300"
                          initial={false}
                          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                        />
                      )}
                    </Link>
                  );
                })}
              </nav>
              
              {/* User Info & Controls */}
              <div className="flex items-center space-x-1 sm:space-x-3">
                {/* User Display - hidden on mobile */}
                <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 bg-secondary-50 dark:bg-secondary-800/50 rounded-lg">
                  <User className="h-4 w-4 text-secondary-500 dark:text-secondary-400" />
                  <span className="text-sm font-medium text-secondary-700 dark:text-secondary-300">
                    {user?.uid || 'Guest'}
                  </span>
                </div>

                {/* Theme Toggle */}
                <ThemeToggle />
                
                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-secondary-600 dark:text-secondary-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200"
                  title="ログアウト"
                >
                  <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">ログアウト</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white/50 dark:bg-secondary-900/50 backdrop-blur-sm border-t border-secondary-200/30 dark:border-secondary-700/30 mt-20 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-secondary-500 dark:text-secondary-400 text-sm transition-colors duration-300">
            <p>&copy; 2025 President Office Weekly Brief. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout; 
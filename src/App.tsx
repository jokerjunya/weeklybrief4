import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { motion } from 'framer-motion';
import HomePage from './pages/HomePage';
import ReportPage from './pages/ReportPage';
import ReportsListPage from './pages/ReportsListPage';
import NewsManagerPage from './pages/NewsManagerPage';
import SoukeReportPage from './pages/SoukeReportPage';
import ZentaiMonitoringPage from './pages/ZentaiMonitoringPage';
import LoginPage from './pages/LoginPage';
import Layout from './components/layout/Layout';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="min-h-screen bg-gradient-to-br from-secondary-50 via-white to-primary-50/30 dark:from-secondary-900 dark:via-secondary-800 dark:to-secondary-900 transition-colors duration-300">
          <Routes>
            {/* パブリックなルート（認証不要） */}
            <Route path="/login" element={<LoginPage />} />
            
            {/* プロテクトされたルート（認証必要） */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5 }}
                      className="animate-fade-in"
                    >
                      <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/report/:id" element={<ReportPage />} />
                        <Route path="/reports" element={<ReportsListPage />} />
                        <Route path="/news-manager" element={<NewsManagerPage />} />
                        <Route path="/souke-report" element={<SoukeReportPage />} />
                        <Route path="/zentai-monitoring" element={<ZentaiMonitoringPage />} />
                      </Routes>
                    </motion.div>
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App; 
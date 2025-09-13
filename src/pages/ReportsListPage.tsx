import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Clock, FileText, Search, Filter, ArrowRight } from 'lucide-react';
import { WeeklyReport } from '../types/report';
import { getAllReports } from '../utils/reportUtils';

const ReportsListPage: React.FC = () => {
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredReports, setFilteredReports] = useState<WeeklyReport[]>([]);

  useEffect(() => {
    const loadReports = async () => {
      try {
        const allReports = await getAllReports();
        setReports(allReports);
        setFilteredReports(allReports);
      } catch (error) {
        console.error('Failed to load reports:', error);
      } finally {
        setLoading(false);
      }
    };

    loadReports();
  }, []);

  useEffect(() => {
    const filtered = reports.filter(report =>
      report.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.weekOf.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredReports(filtered);
  }, [searchTerm, reports]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-secondary-600">レポートを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-12"
      >
        <h1 className="text-4xl font-bold text-secondary-900 mb-4 font-display">
          過去のレポート
        </h1>
        <p className="text-xl text-secondary-600 max-w-2xl mx-auto">
          これまでに作成された週次レポートの一覧です
        </p>
      </motion.div>

      {/* Search and Filter */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mb-8"
      >
        <div className="card p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-secondary-400" />
              <input
                type="text"
                placeholder="レポートを検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-secondary-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
              />
            </div>
            <button className="btn-secondary">
              <Filter className="h-4 w-4 mr-2" />
              フィルター
            </button>
          </div>
        </div>
      </motion.div>

      {/* Reports Grid */}
      {filteredReports.length > 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filteredReports.map((report, index) => (
            <motion.div
              key={report.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 * index }}
              className="group"
            >
              <Link
                to={`/report/${report.id}`}
                className="block card p-6 h-full hover:shadow-strong transition-all duration-300 group-hover:-translate-y-1"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-primary-100 rounded-xl">
                    <FileText className="h-6 w-6 text-primary-600" />
                  </div>
                  <div className="text-sm text-secondary-500">
                    {report.sections.length} セクション
                  </div>
                </div>

                <h3 className="text-xl font-semibold text-secondary-900 mb-3 group-hover:text-primary-600 transition-colors duration-200">
                  {report.title}
                </h3>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-secondary-600">
                    <Calendar className="h-4 w-4 mr-2" />
                    <span className="text-sm font-medium">{report.weekOf}</span>
                  </div>
                  <div className="flex items-center text-secondary-500">
                    <Clock className="h-4 w-4 mr-2" />
                    <span className="text-sm">{report.createdAt}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-secondary-100">
                  <span className="text-sm text-secondary-600">
                    詳細を表示
                  </span>
                  <ArrowRight className="h-4 w-4 text-secondary-400 group-hover:text-primary-500 group-hover:translate-x-1 transition-all duration-200" />
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center py-16"
        >
          <div className="card p-12">
            <FileText className="h-16 w-16 text-secondary-400 mx-auto mb-6" />
            <h3 className="text-2xl font-semibold text-secondary-900 mb-4">
              {reports.length === 0 ? 'レポートが見つかりません' : '検索結果がありません'}
            </h3>
            <p className="text-secondary-600 mb-8">
              {reports.length === 0 
                ? 'まだ週次レポートが作成されていません。'
                : '検索条件に一致するレポートが見つかりませんでした。'
              }
            </p>
            {reports.length === 0 && (
              <Link to="/" className="btn-primary">
                ホームに戻る
              </Link>
            )}
          </div>
        </motion.div>
      )}

      {/* Back to Home */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.8 }}
        className="text-center mt-16"
      >
        <Link to="/" className="btn-secondary">
          ホームに戻る
        </Link>
      </motion.div>
    </div>
  );
};

export default ReportsListPage; 
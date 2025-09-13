import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Clock, Download, Share2 } from 'lucide-react';
import { WeeklyReport } from '../types/report';
import { getReportById } from '../utils/reportUtils';
import { subscribeToReportNews } from '../firebase/database';
import SectionRenderer from '../components/report/SectionRenderer';

const ReportPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadReport = async () => {
      if (!id) {
        setError('レポートIDが指定されていません');
        setLoading(false);
        return;
      }

      try {
        const reportData = await getReportById(id);
        setReport(reportData);
      } catch (err) {
        console.error('Failed to load report:', err);
        setError('レポートの読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    };

    loadReport();

    // リアルタイム同期の設定: 特定レポートのニュース変更を監視
    if (id) {
      console.log('🔄 Setting up real-time news sync for report:', id);
      
      const unsubscribe = subscribeToReportNews(id, (updatedNews) => {
        console.log('📡 Report news updated:', updatedNews.length, 'items');
        
        // レポートデータのニュースセクションを更新
        setReport(prevReport => {
          if (!prevReport) return prevReport;
          
          const updatedReport = { ...prevReport };
          const newsSection = updatedReport.sections.find(section => section.type === 'ai-news');
          
          if (newsSection) {
            console.log('🔄 Updating report news section with', updatedNews.length, 'items');
            newsSection.data = updatedNews;
          }
          
          return updatedReport;
        });
      });

      // クリーンアップ
      return () => {
        console.log('🧹 Cleaning up real-time subscription');
        if (unsubscribe) {
          unsubscribe();
        }
      };
    }
  }, [id]);

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

  if (error || !report) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center py-16">
          <div className="card p-12">
            <div className="text-red-500 text-6xl mb-6">⚠️</div>
            <h2 className="text-2xl font-semibold text-secondary-900 mb-4">
              レポートが見つかりません
            </h2>
            <p className="text-secondary-600 mb-8">
              {error || '指定されたレポートは存在しないか、削除された可能性があります。'}
            </p>
            <Link to="/" className="btn-primary">
              ホームに戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Navigation */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <Link
          to="/"
          className="inline-flex items-center text-secondary-600 hover:text-secondary-900 transition-colors duration-200"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          ホームに戻る
        </Link>
      </motion.nav>

      {/* Report Header */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="card p-4 sm:p-6 lg:p-8 mb-6 sm:mb-8"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 sm:gap-6">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-secondary-900 mb-3 sm:mb-4 font-display break-words">
              {report.title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-secondary-600">
              <div className="flex items-center">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                <span className="font-medium text-sm sm:text-base">{report.weekOf}</span>
              </div>
              <div className="flex items-center">
                <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                <span className="text-xs sm:text-sm">{report.createdAt}</span>
              </div>
              <div className="text-xs sm:text-sm text-secondary-500">
                {report.sections.length} セクション
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button className="btn-secondary text-xs sm:text-sm px-3 py-2">
              <Share2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              共有
            </button>
            <button className="btn-primary text-xs sm:text-sm px-3 py-2">
              <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              エクスポート
            </button>
          </div>
        </div>
      </motion.div>

      {/* Report Sections */}
      <div className="space-y-8">
        {/* セクション */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
          {report.sections.map((section) => (
            <motion.div 
              key={section.id}
              className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-gray-200/50 dark:border-gray-700/50 shadow-soft min-w-0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <SectionRenderer section={section} reportId={report.id} />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Navigation to other reports */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.8 }}
        className="mt-16 text-center"
      >
        <div className="inline-flex items-center gap-4">
          <Link
            to="/reports"
            className="btn-secondary"
          >
            他のレポートを表示
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default ReportPage; 
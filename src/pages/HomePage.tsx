import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Clock, Calendar, FileText, Database, Upload } from 'lucide-react';
import { WeeklyReport } from '../types/report';
import { getLatestReport } from '../utils/reportUtils';
import { subscribeToReportNews } from '../firebase/database';
import SectionRenderer from '../components/report/SectionRenderer';
import { migrateStaticSchedulesToFirebase } from '../utils/scheduleUtils';

const HomePage: React.FC = () => {
  const [latestReport, setLatestReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [migrationLoading, setMigrationLoading] = useState(false);

  useEffect(() => {
    const loadLatestReport = async () => {
      try {
        const report = await getLatestReport();
        setLatestReport(report);
      } catch (error) {
        console.error('Failed to load latest report:', error);
      } finally {
        setLoading(false);
      }
    };

    loadLatestReport();
  }, []);

  // 最新レポートのニュースをリアルタイム同期
  useEffect(() => {
    if (!latestReport?.id) return;

    console.log('🔄 Setting up real-time news sync for latest report:', latestReport.id);
    
    const unsubscribe = subscribeToReportNews(latestReport.id, (updatedNews) => {
      console.log('📡 Latest report news updated:', updatedNews.length, 'items');
      
      // 最新レポートのニュースセクションを更新
      setLatestReport(prevReport => {
        if (!prevReport) return prevReport;
        
        const updatedReport = { ...prevReport };
        const newsSection = updatedReport.sections.find(section => section.type === 'ai-news');
        
        if (newsSection) {
          console.log('🔄 Updating homepage news section with', updatedNews.length, 'items');
          newsSection.data = updatedNews;
        }
        
        return updatedReport;
      });
    });

    // クリーンアップ
    return () => {
      console.log('🧹 Cleaning up homepage real-time subscription');
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [latestReport?.id]);

  // スケジュール移行を実行
  const handleMigration = async () => {
    if (!window.confirm('静的スケジュールデータをFirebaseに移行しますか？')) {
      return;
    }

    setMigrationLoading(true);
    try {
      await migrateStaticSchedulesToFirebase();
      alert('✅ スケジュールデータの移行が完了しました！');
    } catch (error) {
      console.error('Migration failed:', error);
      alert('❌ 移行に失敗しました。コンソールでエラーを確認してください。');
    } finally {
      setMigrationLoading(false);
    }
  };

  // 開発モードかどうかを判定
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* 開発モード: 移行ボタン */}
      {isDevelopment && (
        <div className="fixed top-4 right-4 z-50">
          <button
            onClick={handleMigration}
            disabled={migrationLoading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white 
                     bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 
                     rounded-md shadow-sm transition-colors"
          >
            {migrationLoading ? (
              <Upload className="w-4 h-4 animate-spin" />
            ) : (
              <Database className="w-4 h-4" />
            )}
            {migrationLoading ? '移行中...' : 'スケジュール移行'}
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">

        {/* Latest Report Section */}
        {latestReport ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {/* Ultra Compact Report Header */}
            <div className="card p-2 mb-2">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-secondary-900 mb-1 font-display">
                    {latestReport.title}
                  </h2>
                  <div className="flex items-center text-secondary-600 text-xs">
                    <Calendar className="h-3 w-3 mr-1" />
                    <span className="font-medium">{latestReport.weekOf}</span>
                    <span className="mx-2">•</span>
                    <Clock className="h-3 w-3 mr-1" />
                    <span>{new Date(latestReport.createdAt).toLocaleDateString('ja-JP')}</span>
                  </div>
                </div>
                
                <Link
                  to={`/report/${latestReport.id}`}
                  className="inline-flex items-center px-3 py-1.5 bg-primary-600 text-white rounded-lg font-medium text-xs hover:bg-primary-700 transition-colors duration-200"
                >
                  詳細を表示
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </div>
            </div>

            {/* Ultra Compact Sections Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-1.5 sm:gap-2">
              {latestReport.sections.map((section, index) => {
                // レイアウトの最適化：音声サマリーは2列スパン、その他は1列
                let gridClass = '';
                if (section.type === 'audio-summary') {
                  gridClass = 'xl:col-span-2';
                } else {
                  gridClass = 'xl:col-span-1';
                }
                
                return (
                  <motion.div
                    key={section.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.05 * index }}
                    className={gridClass}
                  >
                    <div className="card p-1.5 sm:p-2 h-full min-w-0">
                      <SectionRenderer section={section} reportId={latestReport.id} />
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Bottom Action */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="text-center mt-2"
            >
              <Link
                to={`/report/${latestReport.id}`}
                className="inline-flex items-center text-primary-600 hover:text-primary-700 font-medium transition-colors duration-200 text-xs"
              >
                すべてのセクションを表示
                <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-center py-12"
          >
            <div className="card p-8">
              <FileText className="h-12 w-12 text-secondary-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-secondary-900 mb-3">
                レポートが見つかりません
              </h3>
              <p className="text-secondary-600 mb-6">
                まだ週次レポートが作成されていません。
              </p>
              <Link
                to="/news-manager"
                className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors duration-200"
              >
                レポートの作成を開始
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default HomePage; 
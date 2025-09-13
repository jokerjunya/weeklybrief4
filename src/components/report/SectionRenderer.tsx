import React, { useState, useEffect, useRef } from 'react';
import { ReportSection, BusinessPerformanceData, StockMovementData, ScheduleItem, NewsItem, AudioSummaryData, WeeklySchedule, CompetitorReport } from '../../types/report';
import { TrendingUp, TrendingDown, Calendar, ExternalLink, Play, Pause, FileText, Building2, DollarSign, Edit2, AlertCircle, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getScheduleByReportId, subscribeToScheduleUpdates } from '../../firebase/database';
import ScheduleEditor from '../schedule/ScheduleEditor';
import NewsModal from '../news/NewsModal';

// 日本語の数値フォーマット関数
const formatJapaneseNumber = (num: number): string => {
  if (num >= 100000000) {
    // 億単位
    const oku = Math.floor(num / 100000000);
    const man = Math.floor((num % 100000000) / 10000);
    if (man > 0) {
      return `${oku}億${man}万円`;
    } else {
      return `${oku}億円`;
    }
  } else if (num >= 10000) {
    // 万単位
    const man = Math.floor(num / 10000);
    const remainder = num % 10000;
    if (remainder > 0) {
      const sen = Math.floor(remainder / 1000);
      const hyaku = Math.floor((remainder % 1000) / 100);
      if (sen > 0 && hyaku > 0) {
        return `${man}万${sen}千${hyaku}百円`;
      } else if (sen > 0) {
        return `${man}万${sen}千円`;
      } else if (hyaku > 0) {
        return `${man}万${hyaku}百円`;
      } else {
        return `${man}万円`;
      }
    } else {
      return `${man}万円`;
    }
  } else {
    return `${num.toLocaleString()}円`;
  }
};

interface SectionRendererProps {
  section: ReportSection;
  reportId?: string;
}

const SectionRenderer: React.FC<SectionRendererProps> = ({ section, reportId }) => {
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // ニュース機能用の状態管理
  const [showAllNews, setShowAllNews] = useState(false);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);

  // 音声再生機能用の状態管理
  const [currentPlayingAudio, setCurrentPlayingAudio] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (section.type === 'weekly-schedule' && reportId) {
      const fetchSchedule = async () => {
        try {
          const schedule = await getScheduleByReportId(reportId);
          setWeeklySchedule(schedule);
          setScheduleItems(schedule?.items || []);
        } catch (error) {
          console.error('Failed to fetch schedule:', error);
          setScheduleItems(section.data as ScheduleItem[] || []);
        }
      };

      fetchSchedule();
    } else if (section.type === 'weekly-schedule') {
      setScheduleItems(section.data as ScheduleItem[] || []);
    }
  }, [section.type, section.data, reportId]);

  useEffect(() => {
    if (section.type === 'weekly-schedule' && reportId) {
      const unsubscribe = subscribeToScheduleUpdates(reportId, (schedule) => {
        setWeeklySchedule(schedule);
        setScheduleItems(schedule?.items || []);
      });

      return unsubscribe;
    }
  }, [section.type, reportId]);

  // 音声再生のクリーンアップ
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleScheduleSave = (savedSchedule: WeeklySchedule) => {
    setWeeklySchedule(savedSchedule);
    setScheduleItems(savedSchedule.items);
    setIsEditing(false);
  };

  const handleScheduleCancel = () => {
    setIsEditing(false);
  };

  // ニュース関連のハンドラー
  const handleNewsClick = (news: NewsItem) => {
    setSelectedNews(news);
  };

  const handleCloseModal = () => {
    setSelectedNews(null);
  };

  const handleToggleShowAllNews = () => {
    setShowAllNews(!showAllNews);
  };

  // 音声再生ハンドラー
  const handleAudioPlay = (audioUrl: string, audioId: string) => {
    try {
      // 既に再生中の音声があれば停止
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      // 同じ音声の場合は停止
      if (currentPlayingAudio === audioId && isPlaying) {
        setCurrentPlayingAudio(null);
        setIsPlaying(false);
        setCurrentTime(0);
        return;
      }

      setIsLoading(true);
      setAudioError(null); // エラー状態をリセット
      
      // 新しい音声を再生
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      // 音声の時間更新イベント
      audio.addEventListener('timeupdate', () => {
        setCurrentTime(audio.currentTime);
      });

      // 音声の長さ取得イベント
      audio.addEventListener('loadedmetadata', () => {
        setDuration(audio.duration);
        setIsLoading(false);
      });

      audio.addEventListener('loadstart', () => {
        console.log('音声ファイルの読み込みを開始:', audioUrl);
      });

      audio.addEventListener('canplay', () => {
        console.log('音声ファイルの再生準備完了:', audioUrl);
        setIsLoading(false);
      });

      audio.addEventListener('error', (e) => {
        console.error('音声ファイルの読み込みエラー:', audioUrl, e);
        setAudioError('音声ファイルを読み込めませんでした');
        setCurrentPlayingAudio(null);
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        setIsLoading(false);
      });

      audio.addEventListener('ended', () => {
        setCurrentPlayingAudio(null);
        setIsPlaying(false);
        setCurrentTime(0);
      });

      audio.play().then(() => {
        setCurrentPlayingAudio(audioId);
        setIsPlaying(true);
        // 再生速度を適用
        audio.playbackRate = playbackRate;
      }).catch((error) => {
        console.error('音声再生エラー:', error);
        setAudioError('音声の再生に失敗しました');
        setCurrentPlayingAudio(null);
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        setIsLoading(false);
      });

    } catch (error) {
      console.error('音声再生処理エラー:', error);
      setAudioError('音声再生中にエラーが発生しました');
      setCurrentPlayingAudio(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setIsLoading(false);
    }
  };

  // 再生位置を変更するハンドラー
  const handleSeek = (newTime: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  // 再生速度を変更するハンドラー
  const handlePlaybackRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  // 時間をフォーマットする関数（mm:ss形式）
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const renderBusinessPerformance = (data: BusinessPerformanceData) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
      {/* Placement */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-start justify-between mb-1.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-0.5">
              <Building2 className="w-3 h-3 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <h4 className="text-xs font-medium text-gray-900 dark:text-white truncate">Placement内定数</h4>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">※RDSを含まない</p>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <Link 
                to="/souke-report"
                className="flex items-center gap-1 px-2 py-1 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 
                           text-green-700 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 
                           rounded-md text-xs font-medium transition-all duration-200 hover:shadow-sm"
                title="集客モニタリング（総受日報）"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>集客モニ</span>
              </Link>
              <a 
                href="https://console.cloud.google.com/bigquery?ws=!1m7!1m6!12m5!1m3!1sdharma-dwh-rag!2sus-central1!3s211c18ef-6287-44e6-9c3f-1edcc00bf7c9!2e1" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex-shrink-0 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <Link 
              to="/zentai-monitoring"
              className="flex items-center gap-1 px-2 py-1 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 
                         text-purple-700 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 
                         rounded-md text-xs font-medium transition-all duration-200 hover:shadow-sm"
              title="全体モニタリング（グラフのみ）"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>全体モニ</span>
            </Link>
          </div>
        </div>
        
        <div className="mb-1.5">
          <div className="text-lg font-bold text-gray-900 dark:text-white break-all">
            {data.placement.current.toLocaleString()}件
          </div>
        </div>
        
        <div className="flex flex-wrap gap-1.5 text-xs">
          <div className="flex items-center">
            {data.placement.wowPercent >= 0 ? (
              <TrendingUp className="w-3 h-3 text-green-600 mr-1" />
            ) : (
              <TrendingDown className="w-3 h-3 text-red-600 mr-1" />
            )}
            <span className={data.placement.wowPercent >= 0 ? 'text-green-600' : 'text-red-600'}>
              前週比{data.placement.wowPercent >= 0 ? '+' : ''}{data.placement.wowPercent.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center">
            {data.placement.yoyPercent >= 0 ? (
              <TrendingUp className="w-3 h-3 text-green-600 mr-1" />
            ) : (
              <TrendingDown className="w-3 h-3 text-red-600 mr-1" />
            )}
            <span className={data.placement.yoyPercent >= 0 ? 'text-green-600' : 'text-red-600'}>
              前年比{data.placement.yoyPercent >= 0 ? '+' : ''}{data.placement.yoyPercent.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Online Platform */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-start justify-between mb-1.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-0.5">
              <DollarSign className="w-3 h-3 text-green-600 dark:text-green-400 flex-shrink-0" />
              <h4 className="text-xs font-medium text-gray-900 dark:text-white truncate">Online Platform売上</h4>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">※グロスレベニュー</p>
          </div>
          <a 
            href="https://docs.google.com/spreadsheets/d/1qJh27Zp5kldAtr0a1YoGUyIeyVGD_hOvqMgZE5dkUL8/edit?usp=sharing" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex-shrink-0 text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        
        <div className="mb-1.5">
          <div className="text-lg font-bold text-gray-900 dark:text-white break-all">
            {formatJapaneseNumber(data.onlinePlatform.current)}
          </div>
        </div>
        
        <div className="flex flex-wrap gap-1.5 text-xs">
          <div className="flex items-center">
            {data.onlinePlatform.wowPercent >= 0 ? (
              <TrendingUp className="w-3 h-3 text-green-600 mr-1" />
            ) : (
              <TrendingDown className="w-3 h-3 text-red-600 mr-1" />
            )}
            <span className={data.onlinePlatform.wowPercent >= 0 ? 'text-green-600' : 'text-red-600'}>
              前週比{data.onlinePlatform.wowPercent >= 0 ? '+' : ''}{data.onlinePlatform.wowPercent.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center">
            {data.onlinePlatform.yoyPercent >= 0 ? (
              <TrendingUp className="w-3 h-3 text-green-600 mr-1" />
            ) : (
              <TrendingDown className="w-3 h-3 text-red-600 mr-1" />
            )}
            <span className={data.onlinePlatform.yoyPercent >= 0 ? 'text-green-600' : 'text-red-600'}>
              前年比{data.onlinePlatform.yoyPercent >= 0 ? '+' : ''}{data.onlinePlatform.yoyPercent.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStockMovement = (data: StockMovementData) => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">日経平均</div>
        <div className="text-lg font-bold text-gray-900 dark:text-white">¥{data.nikkei.current.toLocaleString()}</div>
        <div className="flex items-center gap-1 mt-0.5">
          {data.nikkei.changePercent >= 0 ? (
            <TrendingUp className="w-3 h-3 text-green-600" />
          ) : (
            <TrendingDown className="w-3 h-3 text-red-600" />
          )}
          <span className={`text-xs ${data.nikkei.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {data.nikkei.changePercent >= 0 ? '+' : ''}{data.nikkei.changePercent.toFixed(2)}%
          </span>
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">S&P 500</div>
        <div className="text-lg font-bold text-gray-900 dark:text-white">${data.sp500.current.toLocaleString()}</div>
        <div className="flex items-center gap-1 mt-0.5">
          {data.sp500.changePercent >= 0 ? (
            <TrendingUp className="w-3 h-3 text-green-600" />
          ) : (
            <TrendingDown className="w-3 h-3 text-red-600" />
          )}
          <span className={`text-xs ${data.sp500.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {data.sp500.changePercent >= 0 ? '+' : ''}{data.sp500.changePercent.toFixed(2)}%
          </span>
        </div>
      </div>
      
            <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">リクルートHD</div>
        <div className="text-lg font-bold text-gray-900 dark:text-white">¥{data.recruitHoldings.current.toLocaleString()}</div>
        <div className="flex items-center gap-1 mt-0.5">
          {data.recruitHoldings.changePercent >= 0 ? (
            <TrendingUp className="w-3 h-3 text-green-600" />
          ) : (
            <TrendingDown className="w-3 h-3 text-red-600" />
          )}
          <span className={`text-xs ${data.recruitHoldings.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {data.recruitHoldings.changePercent >= 0 ? '+' : ''}{data.recruitHoldings.changePercent.toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );

  const renderSchedule = (scheduleItems: ScheduleItem[]) => {
    if (isEditing) {
      return (
        <ScheduleEditor
          reportId={reportId!}
          existingSchedule={weeklySchedule}
          onSave={handleScheduleSave}
          onCancel={handleScheduleCancel}
        />
      );
    }

    if (!scheduleItems || scheduleItems.length === 0) {
      return (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
          <Calendar className="w-6 h-6 text-gray-400 mx-auto mb-2" />
          <p className="text-xs text-gray-600 dark:text-gray-400">
            今週の予定はありません
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-1.5">
        {scheduleItems.map((item) => (
          <div
            key={item.id}
            className="bg-white dark:bg-gray-800 rounded-lg p-1.5 border border-gray-200 dark:border-gray-700 shadow-sm"
          >
            <div className="flex items-start gap-1.5">
              <div className="flex-shrink-0 w-1 h-1 bg-blue-500 rounded-full mt-1.5"></div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-col gap-0.5 mb-1">
                  <h4 className="text-xs font-medium text-gray-900 dark:text-white">
                    {item.title}
                  </h4>
                  <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(item.date).toLocaleDateString('ja-JP')}</span>
                  </div>
                </div>
                {item.description && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    {item.description}
                  </p>
                )}
                <div className="flex items-center gap-1">
                  <span className={`text-xs px-1 py-0.5 rounded-full ${
                    item.type === 'meeting' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                    item.type === 'event' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                    item.type === 'deadline' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                    'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                  }`}>
                    {item.type === 'meeting' ? '会議' :
                     item.type === 'event' ? 'イベント' :
                     item.type === 'deadline' ? '締切' : 'マイルストーン'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderAINews = (newsItems: NewsItem[]) => {
    if (!Array.isArray(newsItems) || newsItems.length === 0) {
      return (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
          <FileText className="w-6 h-6 text-gray-400 mx-auto mb-2" />
          <p className="text-xs text-gray-600 dark:text-gray-400">
            このレポートに関連するニュースはありません。
          </p>
        </div>
      );
    }

    const displayItems = showAllNews ? newsItems : newsItems.slice(0, 3);
    const hasMoreItems = newsItems.length > 3;

    return (
      <div className="space-y-1.5">
        {displayItems.map((item) => (
          <div
            key={item.id}
            onClick={() => handleNewsClick(item)}
            className="bg-white dark:bg-gray-800 rounded-lg p-1.5 border border-gray-200 dark:border-gray-700 shadow-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200"
          >
            <div className="flex items-start gap-1.5">
              <div className="flex-shrink-0 w-1 h-1 bg-blue-500 rounded-full mt-1.5"></div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-medium text-gray-900 dark:text-white mb-1 line-clamp-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  {item.title}
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-1.5">
                  {item.summary}
                </p>
                <div className="flex flex-wrap items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <span className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-xs">
                    {item.category}
                  </span>
                  <span>関連度: {item.relevanceScore}%</span>
                  <span>•</span>
                  <span>{new Date(item.publishedAt).toLocaleDateString('ja-JP')}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {hasMoreItems && (
          <div className="text-center">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleToggleShowAllNews();
              }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-medium transition-colors duration-200"
            >
              {showAllNews ? '閉じる' : `他${newsItems.length - 3}件のニュースを表示`}
            </button>
          </div>
        )}
      </div>
    );
  };

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const renderCompetitorReports = (reports: CompetitorReport[]) => {
    if (!Array.isArray(reports) || reports.length === 0) {
      return (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
          <FileText className="w-6 h-6 text-gray-400 mx-auto mb-2" />
          <p className="text-xs text-gray-600 dark:text-gray-400">
            競合レポートはありません
          </p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {reports.map((report) => {
          // カテゴリーに応じた色とアイコン
          const categoryInfo = {
            'HR Tech': { color: 'blue', icon: '🏢' },
            'Recruitment': { color: 'green', icon: '👥' },
            'E-commerce': { color: 'orange', icon: '🛒' },
            'Other': { color: 'gray', icon: '📊' }
          };
          
          const { color, icon } = categoryInfo[report.category] || categoryInfo['Other'];
          
          return (
            <a
              key={report.id}
              href={report.reportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200 group"
            >
              <div className="flex items-start gap-3">
                {/* Google Docs アイコン */}
                <div className="flex-shrink-0 w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                  </svg>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">{icon}</span>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {report.companyName}
                    </h4>
                    <span className={`px-2 py-0.5 text-xs rounded-full bg-${color}-100 text-${color}-800 dark:bg-${color}-900 dark:text-${color}-200`}>
                      1Q決算
                    </span>
                  </div>
                  {report.description && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                      {report.description}
                    </p>
                  )}
                  <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                    <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-1.5 py-0.5 rounded-full">
                      Google Docs
                    </span>
                    <ExternalLink className="w-3 h-3 ml-auto group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                  </div>
                </div>
              </div>
            </a>
          );
        })}
      </div>
    );
  };

  const renderAudioSummary = (data: AudioSummaryData) => (
    <div className="space-y-2 sm:space-y-3">
      {/* Audio Files */}
      <div className="space-y-1.5">
        <h4 className="text-xs font-medium text-gray-900 dark:text-white">音声ファイル</h4>
        <div className="space-y-1.5 sm:space-y-2">
          {data.audioFiles.map((audio) => {
            const isCurrentlyPlaying = currentPlayingAudio === audio.id && isPlaying;
            const isCurrentAudio = currentPlayingAudio === audio.id;
            const progress = isCurrentAudio && duration > 0 ? (currentTime / duration) * 100 : 0;
            
            return (
              <div
                key={audio.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-2 sm:p-3 border border-gray-200 dark:border-gray-700 shadow-sm"
              >
                {/* タイトルと再生ボタン */}
                <div className="flex items-center gap-2 mb-2">
                  <button 
                    onClick={() => handleAudioPlay(audio.audioUrl, audio.id)}
                    disabled={isLoading && isCurrentAudio}
                    className={`flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full text-white flex items-center justify-center transition-all duration-200 transform ${
                      isLoading && isCurrentAudio 
                        ? 'bg-blue-500 scale-95 cursor-not-allowed' 
                        : audioError && isCurrentAudio
                        ? 'bg-red-500 hover:bg-red-600 scale-95'
                        : isCurrentlyPlaying 
                        ? 'bg-green-600 hover:bg-green-700 shadow-lg' 
                        : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg hover:scale-105 active:scale-95'
                    }`}
                    title={
                      isLoading && isCurrentAudio 
                        ? '読み込み中...' 
                        : audioError && isCurrentAudio
                        ? `エラー: ${audioError} (クリックで再試行)`
                        : isCurrentlyPlaying 
                        ? '再生を停止' 
                        : '再生'
                    }
                  >
                    {isLoading && isCurrentAudio ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : audioError && isCurrentAudio ? (
                      <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                    ) : isCurrentlyPlaying ? (
                      <Pause className="w-4 h-4 sm:w-5 sm:h-5" />
                    ) : (
                      <Play className="w-4 h-4 sm:w-5 sm:h-5" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate">
                      {audio.title}
                    </div>
                    {isLoading && isCurrentAudio ? (
                      <div className="text-xs text-orange-600 dark:text-orange-400 font-medium animate-pulse">
                        読み込み中...
                      </div>
                    ) : audioError && isCurrentAudio ? (
                      <div className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        {audioError}
                      </div>
                    ) : isCurrentlyPlaying ? (
                      <div className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        再生中
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* 再生バーと時間表示 */}
                <div className="space-y-1.5">
                  {/* プログレスバー */}
                  <div className="relative">
                    <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 transition-all duration-200 ease-out"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    {/* シークバー（クリック可能） */}
                    {isCurrentAudio && duration > 0 && (
                      <input
                        type="range"
                        min="0"
                        max={duration}
                        value={currentTime}
                        onChange={(e) => handleSeek(Number(e.target.value))}
                        className="absolute inset-0 w-full h-1.5 opacity-0 cursor-pointer"
                      />
                    )}
                  </div>

                  {/* 時間表示 */}
                  <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                    <span>{isCurrentAudio ? formatTime(currentTime) : '0:00'}</span>
                    <span>
                      {isCurrentAudio && duration > 0 
                        ? formatTime(duration) 
                        : audio.duration 
                        ? formatDuration(audio.duration)
                        : '0:00'
                      }
                    </span>
                  </div>

                  {/* 再生速度選択 */}
                  {isCurrentAudio && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-xs text-gray-500 dark:text-gray-400">速度:</span>
                      <div className="flex gap-0.5">
                        {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                          <button
                            key={rate}
                            onClick={() => handlePlaybackRateChange(rate)}
                            className={`px-1.5 py-0.5 text-xs rounded transition-colors ${
                              playbackRate === rate
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                            }`}
                          >
                            {rate}x
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Key Points */}
      <div className="space-y-1.5">
        <h4 className="text-xs font-medium text-gray-900 dark:text-white">重要なポイント</h4>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="space-y-2.5">
            {data.keyPoints.map((point, index) => (
              <div key={index} className="flex items-start gap-1.5">
                <div className="flex-shrink-0 w-1 h-1 bg-green-500 rounded-full mt-1.5"></div>
                <p className="text-xs text-gray-900 dark:text-white leading-relaxed">
                  {point}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <h3 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate flex-1">{section.title}</h3>
        {/* スケジュールセクションで編集可能な場合は編集ボタンを表示 */}
        {section.type === 'weekly-schedule' && reportId && !isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex-shrink-0 flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs font-medium text-gray-600 dark:text-gray-400 
                     hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 
                     rounded-md transition-colors"
            title="スケジュールを編集"
          >
            <Edit2 className="w-3 h-3" />
            <span className="hidden sm:inline">編集</span>
          </button>
        )}
      </div>
      
      {/* 注意書きの表示 */}
      {section.notices && section.notices.length > 0 && (
        <div className="mb-1.5 p-1.5 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 rounded">
          {section.notices.map((notice, index) => (
            <p key={index} className="text-xs text-yellow-800 dark:text-yellow-300 mb-0.5 last:mb-0">
              ⚠️ {notice}
            </p>
          ))}
        </div>
      )}
      
      <div className="section-content">
        {section.type === 'business-performance' && renderBusinessPerformance(section.data as BusinessPerformanceData)}
        {section.type === 'stock-movement' && renderStockMovement(section.data as StockMovementData)}
        {section.type === 'weekly-schedule' && renderSchedule(scheduleItems)}
        {section.type === 'ai-news' && renderAINews(section.data as NewsItem[])}
        {section.type === 'audio-summary' && renderAudioSummary(section.data as AudioSummaryData)}
        {section.type === 'competitor-reports' && renderCompetitorReports(section.data as CompetitorReport[])}
      </div>

      {/* ニュース詳細モーダル */}
      <NewsModal
        news={selectedNews}
        isOpen={selectedNews !== null}
        onClose={handleCloseModal}
      />
    </div>
  );
};

export default SectionRenderer; 
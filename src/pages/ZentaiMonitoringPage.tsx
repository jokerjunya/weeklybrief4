import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, AlertCircle, RefreshCw, Clock, Database, BarChart3 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getZentaiDataFromCache, subscribeToZentaiDataUpdates, saveZentaiDataToCache } from '../firebase/database';
import { ZentaiChartData, ZentaiUpdateState, ZentaiCacheInfo } from '../types/zentai';

const ZentaiMonitoringPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { user, getIdToken } = useAuth();
  
  // 統合データ更新状態管理（総受データ + 内定数データ）
  const [updateState, setUpdateState] = useState<ZentaiUpdateState>({
    isLoading: false,
    isUpdating: false
  });
  
  const [cacheInfo, setCacheInfo] = useState<ZentaiCacheInfo | null>(null);
  const [chartData, setChartData] = useState<ZentaiChartData | null>(null);

  useEffect(() => {
    // ページタイトルを設定
    document.title = 'リクルートエージェント全体モニタリング | Weekly Brief';
    
    // キャッシュデータを初期読み込み（iframe初期化でも行うが、先に state を設定）
    loadCacheData();
    
    // リアルタイムデータ更新の監視（Zentaiデータ）
    const unsubscribe = subscribeToZentaiDataUpdates((zentaiData, zentaiCache) => {
      if (zentaiData && zentaiCache) {
        setCacheInfo(zentaiCache);
        setChartData(zentaiData);
        console.log('📊 Real-time zentai chart data updated:', !!zentaiData);
        
        if (iframeRef.current?.contentWindow) {
          console.log('🔄 Real-time zentai update detected, sending data to iframe...');
          iframeRef.current.contentWindow.postMessage({
            type: 'UPDATE_CHART_DATA',
            data: zentaiData
          }, '*');
          
          // 状態も送信
          iframeRef.current.contentWindow.postMessage({
            type: 'UPDATE_STATUS',
            status: 'success'
          }, '*');
        }
      }
    });
    
    // iframe からのメッセージ受信
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'REQUEST_DATA_UPDATE' && event.data.source === 'zentai-monitoring') {
        console.log('📤 Received data update request from iframe');
        handleUpdateChartData();
      }
    };
    
    window.addEventListener('message', handleMessage);
    
    // 初期ローディングタイマー（iframe読み込みで上書きされる）
    const timer = setTimeout(() => setIsLoading(false), 3000);
    
    return () => {
      unsubscribe();
      window.removeEventListener('message', handleMessage);
      clearTimeout(timer);
    };
  }, []);
  
  // キャッシュデータ初期読み込み（Zentai + テーブル）
  const loadCacheData = async () => {
    try {
      console.log('🔄 Loading zentai cache data...');
      const { data: zentaiData, cacheInfo: zentaiCacheInfo } = await getZentaiDataFromCache();
      console.log('💾 Zentai cache data loaded:', { hasData: !!zentaiData, cacheInfo: zentaiCacheInfo });
      
      if (zentaiData && zentaiCacheInfo) {
        setCacheInfo(zentaiCacheInfo);
        setChartData(zentaiData);
        console.log('✅ Zentai data loaded from cache');
      } else {
        setChartData(null);
        setCacheInfo(null);
        console.warn('⚠️ No zentai cache data available');
      }

      // 初回読み込み時にテーブルデータも取得（集客モニタリングと同様）
      if (user?.id) {
        try {
          console.log('🔄 Loading initial table data...');
          const token = `custom-auth-${user.id}`;
          const tableResponse = await fetch('/.netlify/functions/get-table-data', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': token
            }
          });

          if (tableResponse.ok) {
            const tableResult = await tableResponse.json();
            if (tableResult.success && tableResult.data) {
              console.log('📊 Initial table data loaded:', tableResult.data);
              
              // iframeが読み込まれた後にテーブルデータを送信
              setTimeout(() => {
                if (iframeRef.current?.contentWindow) {
                  console.log('📤 Sending initial table data to iframe');
                  iframeRef.current.contentWindow.postMessage({
                    type: 'UPDATE_TABLE_DATA',
                    data: tableResult.data
                  }, '*');
                }
              }, 1000); // iframe読み込み完了まで少し待機
            }
          } else {
            console.warn('⚠️ Failed to load initial table data:', tableResponse.status);
          }
        } catch (tableError) {
          console.warn('⚠️ Error loading initial table data:', tableError);
        }
      }
    } catch (error) {
      console.error('❌ Failed to load zentai cache data:', error);
      setError('Zentaiキャッシュデータの読み込みに失敗しました');
    }
  };
  
  // 統合データ更新処理（グラフ + 内定数テーブル）
  const handleUpdateChartData = async () => {
    if (!user?.id || updateState.isUpdating) return;
    
    setUpdateState(prev => ({ 
      ...prev, 
      isUpdating: true, 
      error: undefined 
    }));
    
    // iframe に読み込み状態を送信
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: 'UPDATE_STATUS',
        status: 'loading'
      }, '*');
    }
    
    try {
      console.log('🚀 Fetching fresh zentai chart and table data from BigQuery...');
      
      const token = `custom-auth-${user.id}`;
      
      // グラフとテーブルデータを並行取得（集客モニタリングと同じ方式）
      const [chartResponse, tableResponse] = await Promise.all([
        fetch('/.netlify/functions/update-souke-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            userId: user.id,
            forceUpdate: true
          })
        }),
        fetch('/.netlify/functions/get-table-data', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token
          }
        })
      ]);

      // レスポンス検証
      if (!chartResponse.ok) {
        throw new Error(`Chart API failed with status ${chartResponse.status}`);
      }
      if (!tableResponse.ok) {
        throw new Error(`Table API failed with status ${tableResponse.status}`);
      }

      const [chartResult, tableResult] = await Promise.all([
        chartResponse.json(),
        tableResponse.json()
      ]);

      console.log('✅ Both chart and table updates completed:', { chartResult, tableResult });

      // グラフデータ処理
      if (chartResult.success && chartResult.data) {
        console.log('✅ Zentai chart data update successful:', chartResult);
        
        const newZentaiData: ZentaiChartData = chartResult.data;
        const newZentaiCache: ZentaiCacheInfo = {
          updatedAt: chartResult.lastUpdated || new Date().toISOString(),
          updatedBy: user.id,
          ageMinutes: 0,
          isExpired: false
        };
        
        // Firebase Zentaiキャッシュに保存
        await saveZentaiDataToCache(newZentaiData, user.id);
        
        // 状態を更新
        setChartData(newZentaiData);
        setCacheInfo(newZentaiCache);
        
        // iframeにグラフデータ送信
        if (iframeRef.current?.contentWindow) {
          console.log('🔄 Sending updated zentai chart data to iframe...');
          iframeRef.current.contentWindow.postMessage({
            type: 'UPDATE_CHART_DATA',
            data: newZentaiData
          }, '*');
          console.log('✅ Zentai chart data sent to iframe successfully');
        }
      }

      // テーブルデータ処理（新機能）
      if (tableResult.success && tableResult.data) {
        console.log('📊 Naitei KPI data received:', tableResult.data);
        
        // iframeに内定数テーブルデータ送信
        if (iframeRef.current?.contentWindow) {
          console.log('📤 Sending naitei KPI table data to iframe:', tableResult.data);
          iframeRef.current.contentWindow.postMessage({
            type: 'UPDATE_TABLE_DATA',
            data: tableResult.data
          }, '*');
          console.log('✅ Naitei KPI table data sent to iframe successfully');
        }
      }
      
      setUpdateState(prev => ({
        ...prev,
        isUpdating: false,
        lastUpdated: new Date().toISOString()
      }));
      
      // iframe に成功状態を送信
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage({
          type: 'UPDATE_STATUS',
          status: 'success'
        }, '*');
      }
      
    } catch (err) {
      console.error('❌ Chart and table data update failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'データの更新に失敗しました';
      setUpdateState(prev => ({
        ...prev,
        isUpdating: false,
        error: errorMessage
      }));
      setError(errorMessage);
      
      // iframe にエラー状態を送信
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage({
          type: 'UPDATE_STATUS',
          status: 'error'
        }, '*');
      }
    }
  };

  if (error && !updateState.isUpdating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="max-w-2xl mx-auto pt-20">
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              <h2 className="text-lg font-semibold text-red-800 dark:text-red-200">エラーが発生しました</h2>
            </div>
            <p className="text-red-700 dark:text-red-300 mb-4">{error}</p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setError(null);
                  loadCacheData();
                }}
                className="btn-primary"
              >
                再読み込み
              </button>
              <Link to="/" className="btn-secondary">
                ホームに戻る
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      {/* 統合コンパクトヘッダー */}
      <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 py-2">
          <div className="flex items-center justify-between">
            {/* 左側: ナビゲーション + タイトル */}
            <div className="flex items-center gap-2 min-w-0">
              <Link
                to="/souke-report"
                className="flex items-center text-gray-600 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 transition-colors p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                title="集客モニタリングに戻る"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="h-4 w-px bg-gray-300 dark:bg-gray-600 hidden sm:block" />
              <h1 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                <span className="hidden sm:inline">リクルートエージェント</span>全体モニタリング
              </h1>
              {user && (
                <span className="text-xs text-gray-500 dark:text-gray-400 hidden md:inline">
                  ({user.id})
                </span>
              )}
            </div>
            
            {/* 中央: ステータスインジケーター */}
            <div className="flex items-center gap-1">
              {/* データ更新状態 */}
              {updateState.isUpdating && (
                <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 rounded-full">
                  <RefreshCw className="w-3 h-3 animate-spin text-blue-600 dark:text-blue-400" />
                  <span className="text-xs text-blue-700 dark:text-blue-300 hidden sm:inline">更新中</span>
                </div>
              )}
              
              {/* キャッシュ状態 */}
              {cacheInfo && !updateState.isUpdating && (
                <div className="flex items-center gap-1 px-2 py-1 bg-green-50 dark:bg-green-900/30 rounded-full">
                  <Clock className="w-3 h-3 text-green-600 dark:text-green-400" />
                  <span className="text-xs text-green-700 dark:text-green-300 hidden sm:inline">
                    {new Date(cacheInfo.updatedAt).toLocaleDateString('ja-JP', {
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              )}
              
              {/* エラー状態 */}
              {updateState.error && (
                <div className="flex items-center gap-1 px-2 py-1 bg-red-50 dark:bg-red-900/30 rounded-full">
                  <AlertCircle className="w-3 h-3 text-red-600 dark:text-red-400" />
                  <span className="text-xs text-red-700 dark:text-red-300 hidden sm:inline">エラー</span>
                </div>
              )}
            </div>
            
            {/* 右側: アクション */}
            <div className="flex items-center gap-1">
              {/* データ更新ボタン */}
              <button
                onClick={handleUpdateChartData}
                disabled={updateState.isUpdating || isLoading}
                className={`p-2 rounded-lg transition-all ${
                  updateState.isUpdating || isLoading
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                    : 'bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 dark:text-purple-400'
                }`}
                title="データを更新"
              >
                {updateState.isUpdating ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <BarChart3 className="w-4 h-4" />
                )}
              </button>
              
              
              {/* 認証状態 */}
              <div className="flex items-center gap-1 px-2 py-1 bg-green-50 dark:bg-green-900/30 rounded-full">
                <Shield className="w-3 h-3 text-green-600 dark:text-green-400" />
                <span className="text-xs text-green-700 dark:text-green-300 hidden sm:inline">認証済み</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* トーストメッセージ */}
      {(updateState.error || updateState.lastUpdated) && (
        <div className="fixed top-16 right-4 z-30 space-y-1 max-w-xs">
          {updateState.error && (
            <div className="bg-red-500 text-white px-3 py-2 rounded-lg shadow-lg text-xs animate-slide-in-right">
              <div className="flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                <span>更新エラー: {updateState.error}</span>
              </div>
            </div>
          )}
          {updateState.lastUpdated && !updateState.error && (
            <div className="bg-green-500 text-white px-3 py-2 rounded-lg shadow-lg text-xs animate-slide-in-right">
              <div className="flex items-center gap-1">
                <Database className="w-3 h-3" />
                <span>データ更新完了</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* レスポンシブiframeコンテナ */}
      <div 
        className="w-full" 
        style={{ height: 'calc(100vh - 48px)' }} // コンパクトヘッダーの高さ48pxを考慮
      >
        <iframe
          ref={iframeRef}
          src="/protected-reports/zentai_monitoring_report.html"
          className="w-full h-full border-0"
          title="リクルートエージェント全体モニタリング"
          allowFullScreen
          onLoad={() => {
            console.log('🔄 Iframe loaded, initializing with cache data...');
            setIsLoading(false);

            const initializeIframeWithCache = async () => {
              try {
                console.log('🔄 Initializing iframe with cache data...');
                
                // 既に読み込んだグラフデータを送信
                if (chartData && iframeRef.current?.contentWindow) {
                  console.log('📊 Sending cached chart data to iframe...');
                  iframeRef.current.contentWindow.postMessage({
                    type: 'UPDATE_CHART_DATA',
                    data: chartData
                  }, '*');
                  console.log('✅ Cached chart data sent successfully');
                } else {
                  console.warn('⚠️ No cached chart data available');
                }

                // 初期テーブルデータも取得して送信（iframe読み込み完了後）
                if (user?.id) {
                  try {
                    console.log('🔄 Loading initial table data after iframe load...');
                    const token = `custom-auth-${user.id}`;
                    const tableResponse = await fetch('/.netlify/functions/get-table-data', {
                      method: 'GET',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token
                      }
                    });

                    if (tableResponse.ok) {
                      const tableResult = await tableResponse.json();
                      if (tableResult.success && tableResult.data && iframeRef.current?.contentWindow) {
                        console.log('📊 Sending initial table data to iframe after iframe load:', tableResult.data);
                        iframeRef.current.contentWindow.postMessage({
                          type: 'UPDATE_TABLE_DATA',
                          data: tableResult.data
                        }, '*');
                        console.log('✅ Initial table data sent to iframe successfully');
                      }
                    }
                  } catch (tableError) {
                    console.warn('⚠️ Error loading table data after iframe load:', tableError);
                  }
                }
                
              } catch (error) {
                console.warn('⚠️ Failed to initialize iframe with cache:', error);
              }
            };
            
            // iframe の完全初期化を待ってからキャッシュデータ送信
            setTimeout(initializeIframeWithCache, 200);
          }}
          onError={(e) => {
            console.error('❌ Iframe loading failed:', e);
            setError('レポートの読み込みに失敗しました');
            setIsLoading(false);
          }}
        />
      </div>
    </div>
  );
};

export default ZentaiMonitoringPage;

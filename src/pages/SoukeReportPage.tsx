import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, AlertCircle, RefreshCw, Clock, Database, BarChart3 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
// import { User } from 'firebase/auth'; // 独自認証システム使用のため不要
import { getSoukeDataFromCache, subscribeToSoukeDataUpdates, getTableDataFromCache, saveSoukeDataToCache, saveTableDataToCache } from '../firebase/database';
import { SoukeUpdateState, SoukeCacheInfo, SoukeStateData } from '../types/souke';

const SoukeReportPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { user, getIdToken } = useAuth();
  
  // 集客データ更新状態管理
  const [updateState, setUpdateState] = useState<SoukeUpdateState>({
    isLoading: false,
    isUpdating: false
  });
  
  const [cacheInfo, setCacheInfo] = useState<SoukeCacheInfo | null>(null);
  const [chartData, setChartData] = useState<SoukeStateData>(null);
  
  // テーブル更新状態管理（グラフとは独立）
  const [tableUpdateState, setTableUpdateState] = useState<SoukeUpdateState>({
    isLoading: false,
    isUpdating: false
  });
  
  // テーブルキャッシュデータ状態管理
  const [tableData, setTableData] = useState<any | null>(null);

  useEffect(() => {
    // ページタイトルを設定
    document.title = 'リクルートエージェント総受日報 | Weekly Brief';
    
    // キャッシュデータを初期読み込み（iframe初期化でも行うが、先に state を設定）
    loadCacheData();
    
    // iframe からのメッセージ受信
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'REQUEST_DATA_UPDATE' && event.data.source === 'souke-report') {
        console.log('📤 Received data update request from iframe');
        handleUpdateAllData();
      }
    };
    
    window.addEventListener('message', handleMessage);
    
    // リアルタイムデータ更新の監視
    const unsubscribe = subscribeToSoukeDataUpdates((data, cache) => {
      setCacheInfo(cache);
      
      if (data) {
        // オブジェクト形式を配列形式に変換するヘルパー関数
        const convertObjectToArray = (obj: any) => {
          if (!obj || typeof obj !== 'object') return {};
          
          const result: any = {};
          Object.keys(obj).forEach(year => {
            if (obj[year] && typeof obj[year] === 'object') {
              // オブジェクト形式の場合、値のみを配列として抽出
              if (obj[year].hasOwnProperty('0') || Object.keys(obj[year]).every(key => !isNaN(Number(key)))) {
                // 数値キーのオブジェクトを配列に変換
                result[year] = Object.values(obj[year]);
                console.log(`🔄 Converted ${year} from object (${Object.keys(obj[year]).length} items) to array (${result[year].length} items)`);
              } else {
                // 既に配列形式または適切な構造の場合はそのまま
                result[year] = obj[year];
              }
            } else {
              result[year] = obj[year] || [];
            }
          });
          return result;
        };

        // Firestoreから取得した平坦構造を統合構造に変換（配列変換も実行）
        const integratedStructure = {
          souke: {
            daily: convertObjectToArray(data.daily || {}),
            cumulative: convertObjectToArray(data.cumulative || {}),
            weekly: convertObjectToArray(data.weekly || {}),
            metadata: data.metadata || {
              lastUpdated: new Date().toISOString(),
              dataSource: 'realtime-cache'
            }
          },
          metadata: data.metadata || {
            lastUpdated: new Date().toISOString(),
            dataSource: 'realtime-cache'
          }
        };
        
        console.log('🔄 Real-time chart data updated from Firebase');
        
        setChartData(integratedStructure); // 統合構造をstateに設定
        
        if (iframeRef.current?.contentWindow) {
          
          iframeRef.current.contentWindow.postMessage({
            type: 'UPDATE_CHART_DATA',
            data: integratedStructure  // 統合構造データを送信
          }, '*');
          
          // 状態も送信
          iframeRef.current.contentWindow.postMessage({
            type: 'UPDATE_STATUS',
            status: 'success'
          }, '*');
        }
      } else {
        setChartData(null);
        console.log('📊 Real-time chart data updated: no data');
      }
    });
    
    // 初期ローディングタイマー（iframe読み込みで上書きされる）
    const timer = setTimeout(() => setIsLoading(false), 3000);
    
    return () => {
      unsubscribe();
      window.removeEventListener('message', handleMessage);
      clearTimeout(timer);
    };
  }, []);
  
  // キャッシュデータ初期読み込み（グラフ＋テーブル両方）
  const loadCacheData = async () => {
    try {
      // グラフキャッシュ読み込み
      const { data: graphData, cacheInfo: graphCacheInfo } = await getSoukeDataFromCache();
      setCacheInfo(graphCacheInfo);
      
      if (graphData && graphCacheInfo) {
        console.log('✅ Graph cache data loaded:', graphCacheInfo);
        
        // オブジェクト形式を配列形式に変換するヘルパー関数（リアルタイム更新と共通）
        const convertObjectToArray = (obj: any) => {
          if (!obj || typeof obj !== 'object') return {};
          
          const result: any = {};
          Object.keys(obj).forEach(year => {
            if (obj[year] && typeof obj[year] === 'object') {
              // オブジェクト形式の場合、値のみを配列として抽出
              if (obj[year].hasOwnProperty('0') || Object.keys(obj[year]).every(key => !isNaN(Number(key)))) {
                // 数値キーのオブジェクトを配列に変換
                result[year] = Object.values(obj[year]);
                console.log(`🔄 Cache: Converted ${year} from object (${Object.keys(obj[year]).length} items) to array (${result[year].length} items)`);
              } else {
                // 既に配列形式または適切な構造の場合はそのまま
                result[year] = obj[year];
              }
            } else {
              result[year] = obj[year] || [];
            }
          });
          return result;
        };
        
        // キャッシュから読み込んだ平坦構造を統合構造に変換（Chart.js対応 + 配列変換）
        const integratedStructure = {
          souke: {
            daily: convertObjectToArray(graphData.daily || {}),
            cumulative: convertObjectToArray(graphData.cumulative || {}),
            weekly: convertObjectToArray(graphData.weekly || {}),
            metadata: graphData.metadata || {
              lastUpdated: new Date().toISOString(),
              dataSource: 'cache'
            }
          },
          metadata: graphData.metadata || {
            lastUpdated: new Date().toISOString(),
            dataSource: 'cache'
          }
        };
        
        console.log('📊 Cache data converted to integrated structure');
        
        setChartData(integratedStructure);
      }
      
      // テーブルキャッシュ読み込み（新機能）
      const { data: tableDataFromCache, cacheInfo: tableCacheInfo } = await getTableDataFromCache();
      
      if (tableDataFromCache && tableCacheInfo) {
        console.log('✅ Table cache loaded');
        setTableData(tableDataFromCache);
      }
      
    } catch (error) {
      console.error('Failed to load cache data:', error);
    }
  };
  
  // 統合データ更新処理（グラフ＋テーブル同時更新）
  const handleUpdateAllData = async () => {
    if (!user) {
      setError('認証が必要です');
      setTableUpdateState({
        isLoading: false,
        isUpdating: false,
        error: '認証が必要です'
      });
      return;
    }
    
    // 両方の更新状態を開始
    setUpdateState({
      isLoading: false,
      isUpdating: true,
      error: undefined
    });
    
    setTableUpdateState({
      isLoading: false,
      isUpdating: true,
      error: undefined
    });
    
    // iframe に読み込み状態を送信
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: 'UPDATE_STATUS',
        status: 'loading'
      }, '*');
    }
    
    try {
      console.log('🚀 Starting simultaneous graph and table data update...');
      
      // Firebase Auth IDトークン取得
      const idToken = await getIdToken();
      if (!idToken) {
        throw new Error('認証トークンの取得に失敗しました');
      }
      
      // グラフとテーブルデータを並行取得
      const [graphResponse, tableResponse] = await Promise.all([
        fetch('/api/run-kpi', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            start: '2025-01-01',
            end: '2025-12-31',
            bu: 'ALL'
          })
        }),
        fetch('/api/run-kpi', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            start: '2025-01-01',
            end: '2025-12-31',
            bu: 'ALL'
          })
        })
      ]);

      // レスポンスステータスとContent-Typeを事前チェック
      console.log('🔍 Initial response check:', {
        graphStatus: graphResponse.status,
        tableStatus: tableResponse.status,
        graphOk: graphResponse.ok,
        tableOk: tableResponse.ok,
        graphContentType: graphResponse.headers.get('content-type'),
        tableContentType: tableResponse.headers.get('content-type')
      });

      // APIレスポンスのJSONパース（デバッグログ付き）
      let graphResult, tableResult;
      try {
        if (!graphResponse.ok) {
          throw new Error(`Graph API failed with status ${graphResponse.status}`);
        }
        graphResult = await graphResponse.json();
        console.log('✅ Graph JSON parse successful');
      } catch (graphError) {
        const errorMessage = graphError instanceof Error ? graphError.message : String(graphError);
        console.error('❌ Failed to parse graph response as JSON:', errorMessage);
        throw new Error(`グラフAPIレスポンス解析エラー (${graphResponse.status}): ${errorMessage}`);
      }

      try {
        if (!tableResponse.ok) {
          throw new Error(`Table API failed with status ${tableResponse.status}`);
        }
        tableResult = await tableResponse.json();
        console.log('✅ Table JSON parse successful');
      } catch (tableError) {
        const errorMessage = tableError instanceof Error ? tableError.message : String(tableError);
        console.error('❌ Failed to parse table response as JSON:', errorMessage);
        throw new Error(`テーブルAPIレスポンス解析エラー (${tableResponse.status}): ${errorMessage}`);
      }

      console.log('✅ Both updates completed:', { graphResult, tableResult });

      // グラフデータ処理
      if (graphResult.success && graphResult.data) {
        console.log('📊 Chart data received, saving to cache...');
        try {
          await saveSoukeDataToCache(graphResult.data, user.id);
          console.log('✅ Souke data cached in Firestore successfully');
        } catch (cacheError) {
          console.warn('⚠️ Graph cache save failed:', cacheError);
        }
        
        // 更新データをstateに設定（統合構造）
        setChartData(graphResult.data);
        
        // iframeに新しいデータを送信（統合構造）
        if (iframeRef.current?.contentWindow) {
          console.log('📤 Sending updated chart data to iframe after API success');
          console.log('  graphResult.data keys:', Object.keys(graphResult.data));
          console.log('  has souke property:', 'souke' in graphResult.data);
          
          iframeRef.current.contentWindow.postMessage({
            type: 'UPDATE_CHART_DATA',
            data: graphResult.data  // APIから取得した統合構造データをそのまま送信
          }, '*');
        }
      }

      // テーブルデータ処理
      if (tableResult.success && tableResult.data) {
        setTableData(tableResult.data);
        try {
          await saveTableDataToCache(tableResult.data, user.id);
          console.log('✅ Table data cached in Firestore successfully');
        } catch (cacheError) {
          console.warn('⚠️ Table cache save failed:', cacheError);
        }
        
        // iframe にテーブルデータを送信
        if (iframeRef.current?.contentWindow) {
          console.log('📤 Sending complete table data to iframe:', tableResult.data);
          iframeRef.current.contentWindow.postMessage({
            type: 'UPDATE_TABLE_DATA',
            data: tableResult.data
          }, '*');
        }
      }

      // 成功時の状態更新
      const now = new Date().toISOString();
      setUpdateState({
        isLoading: false,
        isUpdating: false,
        lastUpdated: now
      });
      
      setTableUpdateState({
        isLoading: false,
        isUpdating: false,
        lastUpdated: now
      });

      console.log('🎉 All data update completed successfully!');
      
      // iframe に成功状態を送信
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage({
          type: 'UPDATE_STATUS',
          status: 'success'
        }, '*');
      }

    } catch (updateError) {
      console.error('❌ Data update failed:', updateError);
      
      const errorMessage = updateError instanceof Error ? updateError.message : 'データ更新エラー';
      
      // エラー時の状態更新
      setUpdateState({
        isLoading: false,
        isUpdating: false,
        error: errorMessage
      });
      
      setTableUpdateState({
        isLoading: false,
        isUpdating: false,
        error: errorMessage
      });
      
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-6"></div>
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <Shield className="w-5 h-5" />
            <span className="font-medium">セキュアレポートを読み込み中...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* エラー時もナビゲーションを表示 */}
        <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <Link
                to="/"
                className="inline-flex items-center text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors duration-200"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                ホームに戻る
              </Link>
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span className="font-medium">アクセスエラー</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-pink-100 dark:from-gray-900 dark:to-gray-800">
          <div className="text-center max-w-md mx-auto p-8">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              レポート読み込みエラー
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {error}
            </p>
            <Link
              to="/"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              ホームに戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 統合コンパクトヘッダー */}
      <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 py-2">
          <div className="flex items-center justify-between">
            {/* 左側: ナビゲーション + タイトル */}
            <div className="flex items-center gap-2 min-w-0">
              <Link
                to="/"
                className="flex items-center text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                title="ホームに戻る"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="h-4 w-px bg-gray-300 dark:bg-gray-600 hidden sm:block" />
              <h1 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                <span className="hidden sm:inline">リクルートエージェント</span>総受日報
              </h1>
            </div>
            
            {/* 中央: ステータスインジケーター */}
            <div className="flex items-center gap-1">
              {/* データ更新状態 */}
              {(updateState.isUpdating || tableUpdateState.isUpdating) && (
                <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 rounded-full">
                  <RefreshCw className="w-3 h-3 animate-spin text-blue-600 dark:text-blue-400" />
                  <span className="text-xs text-blue-700 dark:text-blue-300 hidden sm:inline">更新中</span>
                </div>
              )}
              
              {/* キャッシュ状態 */}
              {cacheInfo && !updateState.isUpdating && !tableUpdateState.isUpdating && (
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${
                  cacheInfo.isExpired 
                    ? 'bg-orange-50 dark:bg-orange-900/30' 
                    : 'bg-green-50 dark:bg-green-900/30'
                }`}>
                  <Clock className={`w-3 h-3 ${
                    cacheInfo.isExpired 
                      ? 'text-orange-600 dark:text-orange-400' 
                      : 'text-green-600 dark:text-green-400'
                  }`} />
                  <span className={`text-xs hidden sm:inline ${
                    cacheInfo.isExpired 
                      ? 'text-orange-700 dark:text-orange-300' 
                      : 'text-green-700 dark:text-green-300'
                  }`}>
                    {cacheInfo.ageMinutes < 1 ? '最新' : `${cacheInfo.ageMinutes}分前`}
                  </span>
                </div>
              )}
              
              {/* エラー状態 */}
              {(updateState.error || tableUpdateState.error) && (
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
                onClick={handleUpdateAllData}
                disabled={updateState.isUpdating || tableUpdateState.isUpdating}
                className={`p-2 rounded-lg transition-all ${
                  updateState.isUpdating || tableUpdateState.isUpdating
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                    : cacheInfo?.isExpired
                    ? 'bg-orange-100 hover:bg-orange-200 text-orange-700 dark:bg-orange-900/30 dark:hover:bg-orange-900/50 dark:text-orange-400'
                    : 'bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 dark:text-purple-400'
                }`}
                title="データを更新"
              >
                {updateState.isUpdating || tableUpdateState.isUpdating ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
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
      {(updateState.error || tableUpdateState.error || updateState.lastUpdated || tableUpdateState.lastUpdated) && (
        <div className="fixed top-16 right-4 z-30 space-y-1 max-w-xs">
          {updateState.error && (
            <div className="bg-red-500 text-white px-3 py-2 rounded-lg shadow-lg text-xs animate-slide-in-right">
              <div className="flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                <span>グラフ: {updateState.error}</span>
              </div>
            </div>
          )}
          {tableUpdateState.error && (
            <div className="bg-red-500 text-white px-3 py-2 rounded-lg shadow-lg text-xs animate-slide-in-right">
              <div className="flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                <span>テーブル: {tableUpdateState.error}</span>
              </div>
            </div>
          )}
          {updateState.lastUpdated && !updateState.error && (
            <div className="bg-green-500 text-white px-3 py-2 rounded-lg shadow-lg text-xs animate-slide-in-right">
              <div className="flex items-center gap-1">
                <Database className="w-3 h-3" />
                <span>グラフデータ更新完了</span>
              </div>
            </div>
          )}
          {tableUpdateState.lastUpdated && !tableUpdateState.error && (
            <div className="bg-green-500 text-white px-3 py-2 rounded-lg shadow-lg text-xs animate-slide-in-right">
              <div className="flex items-center gap-1">
                <BarChart3 className="w-3 h-3" />
                <span>テーブルデータ更新完了</span>
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
          src="/protected-reports/souke_chart_report.html"
          className="w-full h-full border-0"
          title="リクルートエージェント総受日報"
          allowFullScreen
          onLoad={() => {
            console.log('✅ Iframe loaded successfully - initializing cache data...');
            console.log('🔗 Iframe ref status:', iframeRef.current ? 'exists' : 'null');
            console.log('🔗 Iframe contentWindow:', iframeRef.current?.contentWindow ? 'accessible' : 'not accessible');
            setIsLoading(false);
            
            // iframe 読み込み完了後に既に読み込んだキャッシュデータを送信
            const initializeIframeWithCache = async () => {
              try {
                console.log('🔄 Starting iframe cache initialization...');
                console.log('📊 Current chart data state:', chartData ? 'exists' : 'null');
                console.log('📊 Current table data state:', tableData ? 'exists' : 'null');
                
                // 既に読み込んだグラフデータを送信（集客モニタリング用に旧構造に変換）
                if (chartData && iframeRef.current?.contentWindow) {
                  console.log('📊 Sending cached graph data to iframe...');
                  
                                  // Chart.jsを統合構造に対応させたので、データをそのまま送信
                console.log('🔄 Sending integrated data structure to Chart.js (like ZentaiMonitoring)');
                console.log('  chartData typeof:', typeof chartData);
                console.log('  chartData is null:', chartData === null);
                console.log('  chartData is undefined:', chartData === undefined);
                console.log('  chartData keys:', Object.keys(chartData || {}));
                const integratedData = chartData && 'souke' in chartData ? chartData : null;
                console.log('  has souke property:', !!integratedData);
                console.log('  souke.daily.2025 length:', integratedData?.souke?.daily?.['2025']?.length || 0);
                console.log('  souke.weekly.2025 length:', integratedData?.souke?.weekly?.['2025']?.length || 0);
                console.log('📊 Full chartData JSON:', JSON.stringify(chartData, null, 2));
                  
                iframeRef.current.contentWindow.postMessage({
                  type: 'UPDATE_CHART_DATA',
                  data: chartData  // 統合データをそのまま送信
                }, '*');
                console.log('📤 PostMessage sent with type:', 'UPDATE_CHART_DATA');
                  console.log('✅ Cached graph data sent successfully');
                } else {
                  console.warn('⚠️ No cached graph data available');
                  // フォールバック処理を一時的に無効化（新しいFirestore Client SDK優先）
                }
                
                // 既に読み込んだテーブルデータを送信
                if (tableData && iframeRef.current?.contentWindow) {
                  console.log('📊 Sending cached table data to iframe...');
                  iframeRef.current.contentWindow.postMessage({
                    type: 'UPDATE_TABLE_DATA',
                    data: tableData
                  }, '*');
                  console.log('✅ Cached table data sent successfully');
                } else {
                  console.warn('⚠️ No cached table data available');  
                  // フォールバック処理を一時的に無効化（新しいFirestore Client SDK優先）
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

export default SoukeReportPage;

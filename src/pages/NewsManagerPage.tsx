import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Database, Upload, Plus, Settings, Search, Filter, Edit3, Trash2, Link as LinkIcon, ExternalLink, FileText, AlertTriangle } from 'lucide-react';
import { NewsItem, WeeklyReport } from '../types/report';
import { getAllNews, getAllReports, updateNewsAssignment, deleteNewsItem, subscribeToNewsUpdates, createNewsItem } from '../utils/reportUtils';

// エラーバウンダリーコンポーネント
class NewsErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('❌ News Manager Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card p-8 text-center">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-6" />
          <h3 className="text-2xl font-semibold text-red-900 mb-4">
            エラーが発生しました
          </h3>
          <p className="text-red-600 mb-6">
            ニュースデータの読み込み中に問題が発生しました。
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="btn-primary bg-red-600 hover:bg-red-700"
          >
            ページを再読み込みする
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const NewsManagerPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'manage' | 'upload' | 'settings'>('manage');

  const tabs = [
    { id: 'manage', name: 'ニュース管理', icon: Database },
    { id: 'upload', name: 'アップロード', icon: Upload },
    { id: 'settings', name: '設定', icon: Settings },
  ];

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
          AIニュース管理
        </h1>
        <p className="text-xl text-secondary-600 max-w-2xl mx-auto">
          週次レポートに含めるニュースアイテムの管理とデータベースの更新
        </p>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mb-8"
      >
        <div className="card p-2">
          <nav className="flex space-x-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`
                    relative flex items-center px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200
                    ${isActive 
                      ? 'text-primary-600 bg-primary-50' 
                      : 'text-secondary-600 hover:text-secondary-900 hover:bg-secondary-50'
                    }
                  `}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {tab.name}
                  
                  {isActive && (
                    <motion.div
                      layoutId="activeNewsTab"
                      className="absolute inset-0 bg-primary-100 rounded-xl -z-10"
                      initial={false}
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </motion.div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        {activeTab === 'manage' && (
          <NewsErrorBoundary>
            <NewsManageTab />
          </NewsErrorBoundary>
        )}
        {activeTab === 'upload' && <NewsUploadTab />}
        {activeTab === 'settings' && <NewsSettingsTab />}
      </motion.div>
    </div>
  );
};

const NewsManageTab: React.FC = () => {
  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredNews, setFilteredNews] = useState<NewsItem[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('🔄 Loading news and reports data...');
        
        const [newsData, reportsData] = await Promise.all([
          getAllNews(),
          getAllReports()
        ]);
        
        console.log('✅ Data loaded successfully:', {
          newsCount: newsData?.length || 0,
          reportsCount: reportsData?.length || 0
        });
        
        // データの安全性チェック
        const safeNewsData = Array.isArray(newsData) ? newsData : [];
        const safeReportsData = Array.isArray(reportsData) ? reportsData : [];
        
        // 日付順（新しい順）でソート
        const sortedNewsData = safeNewsData.sort((a, b) => {
          const dateA = new Date(a.publishedAt || '1970-01-01');
          const dateB = new Date(b.publishedAt || '1970-01-01');
          return dateB.getTime() - dateA.getTime(); // 新しい順
        });
        
        setNewsList(sortedNewsData);
        setReports(safeReportsData);
        setFilteredNews(sortedNewsData);
        
      } catch (error) {
        console.error('❌ Failed to load data:', error);
        // エラー時はとりあえず空の配列で初期化
        setNewsList([]);
        setReports([]);
        setFilteredNews([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // リアルタイム同期の設定
    let unsubscribe: (() => void) | null = null;
    
    try {
      unsubscribe = subscribeToNewsUpdates((updatedNews) => {
        console.log('📡 Real-time update received:', updatedNews?.length || 0, 'news items');
        
        if (Array.isArray(updatedNews)) {
          // リアルタイム更新でも日付順（新しい順）でソート
          const sortedUpdatedNews = updatedNews.sort((a, b) => {
            const dateA = new Date(a.publishedAt || '1970-01-01');
            const dateB = new Date(b.publishedAt || '1970-01-01');
            return dateB.getTime() - dateA.getTime(); // 新しい順
          });
          setNewsList(sortedUpdatedNews);
        } else {
          console.warn('⚠️ Invalid real-time update data:', updatedNews);
        }
      });
    } catch (error) {
      console.error('❌ Failed to set up real-time updates:', error);
    }

    // クリーンアップ
    return () => {
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (error) {
          console.error('❌ Error during cleanup:', error);
        }
      }
    };
  }, []);

  useEffect(() => {
    try {
      const filtered = newsList.filter(news => {
        const title = news.title || '';
        const category = news.category || '';
        const summary = news.summary || '';
        const searchLower = searchTerm.toLowerCase();
        
        return title.toLowerCase().includes(searchLower) ||
               category.toLowerCase().includes(searchLower) ||
               summary.toLowerCase().includes(searchLower);
      });
      
      // フィルタリング後も最新順でソート
      const sortedFiltered = filtered.sort((a, b) => {
        const dateA = new Date(a.publishedAt || '1970-01-01');
        const dateB = new Date(b.publishedAt || '1970-01-01');
        return dateB.getTime() - dateA.getTime(); // 新しい順
      });
      
      setFilteredNews(sortedFiltered);
    } catch (error) {
      console.error('Filtering error:', error);
      setFilteredNews(newsList); // フォールバック: フィルタリングなしで表示
    }
  }, [searchTerm, newsList]);

  const handleAssignNews = async (newsId: string, reportId: string | undefined) => {
    console.log('🔄 handleAssignNews called:', { newsId, reportId });
    
    try {
      // ローディング状態を表示（オプション）
      const currentNews = newsList.find(n => n.id === newsId);
      console.log('📰 Current news before update:', currentNews);
      
      const updatedNews = await updateNewsAssignment(newsId, reportId);
      console.log('✅ News assignment updated:', updatedNews);
      
      if (updatedNews) {
        setNewsList(prev => {
          const updated = prev.map(news => 
            news.id === newsId ? updatedNews : news
          );
          console.log('🔄 Updated newsList state');
          return updated;
        });
        
        // 成功メッセージ表示
        console.log('🎉 Assignment successful!', {
          newsTitle: updatedNews.title,
          assignedTo: reportId || 'Unassigned'
        });
      }
    } catch (error) {
      console.error('❌ Failed to update news assignment:', error);
      // エラーメッセージを表示（ユーザーに通知）
      alert('ニュースの割り当て更新に失敗しました。再度お試しください。');
    }
  };

  const handleDeleteNews = async (newsId: string) => {
    if (!confirm('このニュースを削除しますか？')) return;
    
    try {
      console.log('🗑️ Attempting to delete news:', newsId);
      const deleted = await deleteNewsItem(newsId);
      console.log('✅ Delete result:', deleted);
      
      if (deleted) {
        setNewsList(prev => {
          const updated = prev.filter(news => news.id !== newsId);
          console.log('🔄 Local state updated, remaining items:', updated.length);
          return updated;
        });
        
        alert('ニュースを削除しました！');
      } else {
        alert('ニュースの削除に失敗しました。');
      }
    } catch (error) {
      console.error('❌ Failed to delete news:', error);
      alert('削除中にエラーが発生しました: ' + error);
    }
  };

  // デバッグ用: Firebase の実データを確認
  const debugFirebaseData = async () => {
    try {
      console.log('🔥 === Firebase Debug Info ===');
      const allNews = await getAllNews();
      console.log('📊 Total news items in Firebase:', allNews.length);
      
      const report2025News = allNews.filter(n => n.assignedReportId === '2025-06-30');
      console.log('📰 News assigned to 2025-06-30:', report2025News.length);
      console.log('📋 Assigned news:', report2025News.map(n => ({ id: n.id, title: n.title })));
      
      const unassignedNews = allNews.filter(n => !n.assignedReportId);
      console.log('❓ Unassigned news:', unassignedNews.length);
      console.log('📋 Unassigned news:', unassignedNews.map(n => ({ id: n.id, title: n.title })));
      
      alert(`Firebase データ確認完了！\n\n全ニュース: ${allNews.length}件\n2025-06-30レポート: ${report2025News.length}件\n未割り当て: ${unassignedNews.length}件\n\n詳細はコンソールをご確認ください。`);
    } catch (error) {
      console.error('Firebase debug failed:', error);
      alert('Firebase データ確認に失敗しました: ' + error);
    }
  };

  // デバッグ用: localStorage をクリア
  const clearLocalStorage = () => {
    if (confirm('⚠️ WARNING: localStorage のニュースデータをクリアします。\n\nこれによりローカルキャッシュがリセットされ、Firebase データが正しく表示されるようになります。\n\n実行しますか？')) {
      try {
        localStorage.removeItem('weeklybrief_news_database');
        console.log('🧹 localStorage cleared successfully');
        alert('✅ localStorage をクリアしました！\n\nページを再読み込みしてください。');
        window.location.reload();
      } catch (error) {
        console.error('Failed to clear localStorage:', error);
        alert('localStorage のクリアに失敗しました: ' + error);
      }
    }
  };

  // 新しいAIニュースを追加（2025年8月分）
  const addNewAugustAINews = async () => {
    const newsToAdd = [
      {
        title: 'NVIDIA、AIエージェントの効率化に小規模言語モデル（SLM）の活用を提唱',
        summary: 'NVIDIAは、大規模言語モデル（LLM）と小規模言語モデル（SLM）を組み合わせることで、AIエージェントのコスト削減と効率化が図れると発表。繰り返されるタスクを特定し、SLMで処理することで、運用の最適化が期待される。',
        url: 'https://www.itmedia.co.jp/aiplus/articles/2508/14/news033.html',
        publishedAt: '2025-08-14',
        category: 'AI',
        relevanceScore: 90
      },
      {
        title: 'Google、超小型AIモデル「Gemma 3 270M」を発表',
        summary: 'Googleが2.7億パラメータという超小型のAIモデル「Gemma 3 270M」を発表。スマートフォンでも高速に動作し、高いエネルギー効率と指示追従能力を持つ。これにより、デバイス上でのAI活用がさらに進むと期待される。',
        url: 'https://note.com/masa_wunder/n/n0bd9f2e8904d',
        publishedAt: '2025-08-16',
        category: 'AI',
        relevanceScore: 88
      },
      {
        title: 'AIエージェント成功の鍵、「コンテキストエンジニアリング」が提唱される',
        summary: 'AIエージェントが最適な結果を出すためには、プロンプトだけでなく、ツールや履歴、データなどの「コンテキスト」を動的に活用する「コンテキストエンジニアリング」が重要であると提唱された。これにより、より複雑なタスクの実行が可能になる。',
        url: 'https://www.boxsquare.jp/blog/why-context-engineering-far-more-just-prompt-engineering-20',
        publishedAt: '2025-08-14',
        category: 'AI',
        relevanceScore: 85
      },
      {
        title: 'PCやスマホを自動操作する「OSエージェント」に関する調査報告',
        summary: '浙江大学とOPPO AI Centerが、PCやスマートフォンを自律的に操作するAI「OSエージェント」に関する包括的な調査を発表。その技術的な構成要素や今後の可能性、そして安全性についての課題を提示しており、AIアシスタントの進化を示唆している。',
        url: 'https://innovatopia.jp/ai/ai-news/62919/',
        publishedAt: '2025-08-13',
        category: 'AI',
        relevanceScore: 87
      },
      {
        title: 'OpenAI、ChatGPTを中心としたエコシステム拡大のためAIブラウザ開発か',
        summary: 'OpenAIがChatGPTを中心としたサービスを人々の生活に浸透させるため、独自のAIブラウザを開発している可能性が報じられた。Googleへの依存から脱却し、独自のプラットフォームを確立することで、AI市場でのさらなるシェア拡大を目指す。',
        url: 'https://innova-jp.com/media/ai-weekly/61',
        publishedAt: '2025-08-01',
        category: 'AI',
        relevanceScore: 92
      },
      {
        title: 'キリン、経営会議に「AI役員」を本格導入',
        summary: 'キリンホールディングスが、過去10年分の議事録や社内データを学習した「AI役員 CoreMate」を経営戦略会議に導入。多様な視点から議論の論点を提示することで、意思決定の質とスピードの向上を目指す。',
        url: 'https://www.watch.impress.co.jp/docs/news/2036523.html',
        publishedAt: '2025-08-04',
        category: 'AI',
        relevanceScore: 89
      },
      {
        title: 'ChatGPTの週間アクティブユーザー数が7億人に到達',
        summary: 'OpenAIは、ChatGPTの週間アクティブユーザー数が7億人に達したと発表。これは驚異的な数字であり、個人向けAIツールとしての圧倒的なシェアを維持していることを示している。次期モデルGPT-5の発表も控え、さらなる利用者増が期待される。',
        url: 'https://innovatopia.jp/ai/ai-news/62164/',
        publishedAt: '2025-08-06',
        category: 'AI',
        relevanceScore: 94
      },
      {
        title: 'Google、AI検索によるトラフィック減の報告に反論',
        summary: 'Googleは、AI検索機能の導入後もWebサイトへのクリック数は安定しており、クリックの質はむしろ向上していると反論。AIで完結する質問が増える一方で、より深い情報へのニーズは高まっているとし、ウェブサイト運営者の懸念払拭に努めた。',
        url: 'https://www.itmedia.co.jp/news/articles/2508/07/news071.html',
        publishedAt: '2025-08-07',
        category: 'AI',
        relevanceScore: 86
      },
      {
        title: 'Appleのティム・クックCEO、「AIで勝つ必要がある」と表明',
        summary: 'Appleのティム・クックCEOが、従業員向けの会議でAI分野での勝利への強い意欲を表明。過去に他社に先行された市場で成功してきた経験を挙げ、AI分野での巻き返しを誓った。Siriのアップデート遅延の理由も説明し、品質を重視する姿勢を強調した。',
        url: 'https://hyper.ai/ja/headlines/f71dcc353509011551ac15347933692f',
        publishedAt: '2025-08-02',
        category: 'AI',
        relevanceScore: 91
      }
    ];

    console.log('🚀 Starting to add August AI news to Firebase...');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const newsData of newsToAdd) {
      try {
        console.log(`📰 Adding: ${newsData.title}`);
        const result = await createNewsItem(newsData);
        console.log(`✅ Added successfully: ${result.id}`);
        successCount++;
        
        // APIレート制限を避けるため、少し待機
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (error) {
        console.error(`❌ Failed to add news: ${newsData.title}`, error);
        errorCount++;
      }
    }
    
    console.log(`🎉 Completed! Success: ${successCount}, Errors: ${errorCount}`);
    alert(`2025年8月分のAIニュース追加が完了しました！\n成功: ${successCount}件\nエラー: ${errorCount}件`);
  };

  // 最新AIニュースを追加（2025年8月下旬）
  const addLatestAINews = async () => {
    const latestNewsToAdd = [
      {
        title: 'Googleドキュメントの音声読み上げ機能、Gemini Liveの新機能など、AI最新サービスと活用事例',
        summary: 'GoogleドキュメントにGeminiの流暢な音声読み上げ機能が追加され、内容のチェックが容易になりました。また、Android版Gemini Liveでは、カメラで映したものを音声で解説する機能が追加されるなど、AIのビジネス活用から最新技術、社会的な影響まで幅広く解説されています。',
        url: 'https://youtu.be/c9YM5JP5utU',
        publishedAt: '2025-08-26',
        category: 'AI',
        relevanceScore: 92
      },
      {
        title: 'Anthropic、ビジネスプラン向けにClaude Codeと新しい管理コントロールを発表',
        summary: 'Anthropicは、ビジネスプラン向けにコーディング支援ツール「Claude Code」と、管理者が使用状況などを管理しやすくなる新しいコントロール機能をリリースしました。これにより、企業でのAI活用がさらにセキュアかつ効率的になります。',
        url: 'https://www.anthropic.com/news/introducing-claude',
        publishedAt: '2025-08-21',
        category: 'AI',
        relevanceScore: 95
      },
      {
        title: 'Google、Gemini Live AIアシスタントに新機能を追加',
        summary: 'Googleは、AIアシスタント「Gemini Live」にいくつかのアップグレードを発表しました。スマートフォンのカメラでオブジェクトをスキャンすると、画面上で視覚的なガイダンスを受け取れる機能などが追加され、より直感的な操作が可能になります。',
        url: 'https://medium.com/@CherryZhouTech/ai-news-august-16-22-2025-10-most-impactful-ai-updates-you-need-to-know-63d7ae794e32',
        publishedAt: '2025-08-21',
        category: 'AI',
        relevanceScore: 90
      },
      {
        title: 'OpenAI、オープンソースモデル「gpt-oss」を公開',
        summary: 'OpenAIが、新しいオープンソースモデル「gpt-oss」を公開しました。これにより、開発者はより自由にモデルをカスタマイズし、様々なアプリケーションに組み込むことが可能になり、AI開発のさらなる活性化が期待されます。',
        url: 'https://note.com/watarun111/n/n62597cce13d1',
        publishedAt: '2025-08-20',
        category: 'AI',
        relevanceScore: 93
      },
      {
        title: '中国のDeepSeek、高性能オープンソースAIモデル「DeepSeek V3.1」を公開',
        summary: '中国のAI企業DeepSeekが、6850億パラメータを持つ大規模なオープンソースAIモデル「DeepSeek V3.1」を公開しました。画期的な性能とハイブリッド推論を備え、OpenAIやAnthropicに挑戦するモデルとして注目されています。',
        url: 'https://note.com/chobiai/n/nb621ff0edf67',
        publishedAt: '2025-08-20',
        category: 'AI',
        relevanceScore: 91
      },
      {
        title: 'Baidu、2025年第2四半期のAI新事業収益が100億元を突破',
        summary: 'Baiduが発表した2025年第2四半期の決算報告によると、AI関連の新事業収益が前年同期比34%増の100億元を超えました。特にインテリジェント検索と自動運転タクシーサービス「Apollo Go」が成長を牽引しており、AI技術の事業化が進んでいます。',
        url: 'https://news.aibase.com/news/20669',
        publishedAt: '2025-08-20',
        category: 'AI',
        relevanceScore: 88
      },
      {
        title: 'OpenAI、インド市場向けに低価格プラン「ChatGPT Go」を発表',
        summary: 'OpenAIは、インド市場向けに月額399ルピーの新しいサブスクリプションプラン「ChatGPT Go」を導入しました。これにより、より多くのユーザーがGPT-5モデルを利用できるようになり、PerplexityやGoogleとの競争が激化しています。',
        url: 'https://timesofindia.indiatimes.com/business/india-business/openai-heats-up-ai-race-with-new-india-offering/articleshow/123397802.cms',
        publishedAt: '2025-08-20',
        category: 'AI',
        relevanceScore: 87
      },
      {
        title: 'カナダ政府、Cohereと覚書を締結し国内AIエコシステムを強化',
        summary: 'カナダ政府は、自国のAIエコシステムと政府内サービスを構築するため、カナダのAI企業Cohereとの覚書に署名しました。これにより、より効率的で生産的な公共サービスの実現と、カナダのAI分野における競争力維持を目指します。',
        url: 'https://www.canada.ca/en/innovation-science-economic-development/news/2025/08/canada-partners-with-cohere-to-accelerate-world-leading-artificial-intelligence.html',
        publishedAt: '2025-08-19',
        category: 'AI',
        relevanceScore: 85
      },
      {
        title: 'PerplexityのAIブラウザ「Comet」に間接的なプロンプトインジェクションの脆弱性が指摘される',
        summary: 'セキュリティ研究者により、PerplexityのAIブラウザ「Comet」において、ユーザーの意図しない操作を実行させる可能性がある「間接的プロンプトインジェクション」の脆弱性が発見、報告されました。AIエージェントのセキュリティ確保が今後の課題となります。',
        url: 'https://brave.com/blog/comet-prompt-injection/',
        publishedAt: '2025-08-20',
        category: 'AI',
        relevanceScore: 89
      },
      {
        title: 'MetaとRay-Ban、AI搭載スマートグラスをインドで発売',
        summary: 'MetaとRay-Banは、カメラ、音声アシスタント、ソーシャルメディア機能を備えたAI搭載のスマートグラスをインドで発売しました。これにより、ユーザーは見たものをAIで認識させたり、リアルタイムで翻訳したりすることが可能になります。',
        url: 'https://www.hindustantimes.com/technology/-neural-dispatch-anthropic-tokens-perplexity-s-chrome-play-and-using-the-ray-ban-meta-ai-glasses-101755665802791.html',
        publishedAt: '2025-08-20',
        category: 'AI',
        relevanceScore: 86
      },
      {
        title: 'Nvidia、米国の輸出規制を受け中国市場向けの新しいAIチップを準備',
        summary: 'Nvidiaは、米国の対中輸出規制に対応するため、中国市場向けにBlackwellアーキテクチャをベースにした新しいAIチップを開発中と報じられました。地政学的な制約の中で、世界のAI需要に応えるための製品戦略が注目されます。',
        url: 'https://note.com/sato_yoko/n/na24b1ce2d140',
        publishedAt: '2025-08-19',
        category: 'AI',
        relevanceScore: 88
      },
      {
        title: 'Databricks、評価額1000億ドル超えの「センティコーン」企業に',
        summary: 'データとAIの企業であるDatabricksが、最新の資金調達ラウンドで評価額1000億ドルを突破しました。これは現在の「AIサマー」の中でも稀な成果であり、同社のデータ基盤とAIエージェント製品への期待の高さを示しています。',
        url: 'https://www.youtube.com/watch?v=4YdNDuyDH5Y',
        publishedAt: '2025-08-20',
        category: 'AI',
        relevanceScore: 90
      },
      {
        title: '医療AIスタートアップOpenEvidenceのシステムが米国医師免許試験で満点を記録',
        summary: '医療AIスタートアップOpenEvidenceのシステムが、米国医師免許試験（USMLE）で史上初の満点を獲得しました。このAIは、各質問に対する推論と参照文献も公開しており、透明性の高い意思決定ロジックを示しています。',
        url: 'https://ts2.tech/en/ai-breakthroughs-big-tech-moves-bubble-fears-top-ai-news-roundup-aug-20-21-2025/',
        publishedAt: '2025-08-21',
        category: 'AI',
        relevanceScore: 94
      }
    ];

    console.log('🚀 Starting to add latest AI news to Firebase...');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const newsData of latestNewsToAdd) {
      try {
        console.log(`📰 Adding: ${newsData.title.substring(0, 50)}...`);
        const result = await createNewsItem(newsData);
        console.log(`✅ Added successfully: ${result.id}`);
        successCount++;
        
        // APIレート制限を避けるため、少し待機
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (error) {
        console.error(`❌ Failed to add news: ${newsData.title}`, error);
        errorCount++;
      }
    }
    
    console.log(`🎉 Latest AI News addition completed! Success: ${successCount}, Errors: ${errorCount}`);
    alert(`最新AIニュース追加が完了しました！\n成功: ${successCount}件\nエラー: ${errorCount}件`);
  };

  // デバッグ用: Firebase 接続テスト
  const testFirebaseConnection = async () => {
    try {
      console.log('🔥 === Firebase Connection Test ===');
      
      // 1. Firebase設定確認
      const { db } = await import('../firebase/config');
      console.log('✅ Firebase config loaded successfully');
      console.log('📡 Firebase app:', db.app.name);
      console.log('📡 Project ID:', db.app.options.projectId);
      
      // 2. USE_FIREBASE フラグ確認
      console.log('🏷️ USE_FIREBASE flag: true (hardcoded)');
      
      // 3. Firestore読み取りテスト
      const { collection, getDocs } = await import('firebase/firestore');
      console.log('📚 Attempting to read from Firestore...');
      
      const newsCollection = collection(db, 'news');
      const snapshot = await getDocs(newsCollection);
      
      console.log('✅ Firestore read successful!');
      console.log('📊 Documents count:', snapshot.size);
      console.log('📋 Document IDs:', snapshot.docs.map(doc => doc.id));
      
             alert(`🎉 Firebase接続成功！\n\nプロジェクト: ${db.app.options.projectId}\nUSE_FIREBASE: true\nドキュメント数: ${snapshot.size}\n\n詳細はコンソールをご確認ください。`);
      
         } catch (error: any) {
       console.error('❌ Firebase connection failed:', error);
       console.error('❌ Error details:', {
         name: error?.name,
         message: error?.message,
         code: error?.code,
         stack: error?.stack
       });
       
       alert(`❌ Firebase接続エラー！\n\nエラー: ${error?.message || 'Unknown error'}\nコード: ${error?.code || 'N/A'}\n\n詳細はコンソールをご確認ください。`);
     }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filter */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-secondary-400" />
            <input
              type="text"
              placeholder="ニュースを検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-secondary-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
            />
          </div>
          <button className="btn-secondary">
            <Filter className="h-4 w-4 mr-2" />
            フィルター
          </button>
          <button 
            onClick={testFirebaseConnection}
            className="btn-primary bg-blue-600 hover:bg-blue-700"
          >
            🔌 Firebase接続テスト
          </button>
          <button 
            onClick={debugFirebaseData}
            className="btn-primary bg-red-600 hover:bg-red-700"
          >
            🔍 Firebase確認
          </button>
          <button 
            onClick={clearLocalStorage}
            className="btn-secondary bg-orange-600 hover:bg-orange-700 text-white"
          >
            🧹 キャッシュクリア
          </button>
          <button 
            onClick={addNewAugustAINews}
            className="btn-primary bg-green-600 hover:bg-green-700"
          >
            <FileText className="h-4 w-4 mr-2" />
            2025年8月AIニュース追加
          </button>
          <button 
            onClick={addLatestAINews}
            className="btn-primary bg-blue-600 hover:bg-blue-700"
          >
            <FileText className="h-4 w-4 mr-2" />
            最新AIニュース追加（8月下旬）
          </button>
          <button 
            onClick={testFirebaseConnection}
            className="btn-primary bg-red-600 hover:bg-red-700"
          >
            🔄 Firebase接続テスト
          </button>
          <button className="btn-primary">
            <Plus className="h-4 w-4 mr-2" />
            新規追加
          </button>
        </div>
      </div>

      {/* News Items */}
      {filteredNews.length > 0 ? (
        <div className="space-y-4">
          {filteredNews.map((news, index) => (
            <motion.div
              key={news.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="card p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 pr-4">
                  <div className="flex items-center gap-3 mb-3">
                    <h4 className="font-semibold text-secondary-900 text-lg">
                      {news.title}
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 text-xs font-medium bg-primary-100 text-primary-700 rounded-full">
                        {news.category}
                      </span>
                      <span className="text-xs text-secondary-500">
                        {news.relevanceScore}%
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-secondary-700 mb-4 leading-relaxed">
                    {news.summary}
                  </p>
                  
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-secondary-500">
                      {news.publishedAt 
                        ? (typeof news.publishedAt === 'string' 
                           ? new Date(news.publishedAt).toLocaleDateString('ja-JP')
                           : '日付不明')
                        : '日付不明'
                      }
                    </span>
                    {news.url && (
                      <a
                        href={news.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-sm text-primary-600 hover:text-primary-700 font-medium"
                      >
                        リンクを開く
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    )}
                  </div>

                  {/* Report Assignment */}
                  <div className="flex items-center gap-3">
                    <LinkIcon className="h-4 w-4 text-secondary-500" />
                    <span className="text-sm text-secondary-600">
                      レポート割り当て:
                    </span>
                    <select
                      value={news.assignedReportId || ''}
                      onChange={(e) => {
                        console.log('🎯 Select onChange triggered:', {
                          newsId: news.id,
                          newsTitle: news.title,
                          oldValue: news.assignedReportId,
                          newValue: e.target.value
                        });
                        handleAssignNews(news.id, e.target.value || undefined);
                      }}
                      className="text-sm border border-secondary-300 rounded-lg px-3 py-1 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">未割り当て</option>
                      {reports.map(report => (
                        <option key={report.id} value={report.id}>
                          {report.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button className="p-2 text-secondary-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors duration-200">
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteNews(news.id)}
                    className="p-2 text-secondary-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="card p-8 text-center">
          <Database className="h-16 w-16 text-secondary-400 mx-auto mb-6" />
          <h3 className="text-2xl font-semibold text-secondary-900 mb-4">
            {searchTerm ? '検索結果がありません' : 'ニュースデータベース'}
          </h3>
          <p className="text-secondary-600 mb-8">
            {searchTerm 
              ? '検索条件に一致するニュースが見つかりませんでした。'
              : 'ニュースアイテムがありません。新しいニュースを追加してください。'
            }
          </p>
          <button className="btn-primary">
            <Plus className="h-4 w-4 mr-2" />
            新規追加
          </button>
        </div>
      )}
    </div>
  );
};

const NewsUploadTab: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div className="card p-8">
        <div className="border-2 border-dashed border-secondary-300 rounded-xl p-12 text-center hover:border-primary-400 transition-colors duration-200">
          <Upload className="h-16 w-16 text-secondary-400 mx-auto mb-6" />
          <h3 className="text-xl font-semibold text-secondary-900 mb-4">
            CSVファイルをアップロード
          </h3>
          <p className="text-secondary-600 mb-8">
            ドラッグ&ドロップするか、クリックしてファイルを選択してください
          </p>
          <button className="btn-primary">
            ファイルを選択
          </button>
        </div>
      </div>

      {/* Upload Instructions */}
      <div className="card p-6">
        <h4 className="text-lg font-semibold text-secondary-900 mb-4">
          CSVフォーマット要件
        </h4>
        <div className="space-y-2 text-sm text-secondary-600">
          <p>• <strong>title</strong>: ニュースのタイトル</p>
          <p>• <strong>summary</strong>: ニュースの要約</p>
          <p>• <strong>url</strong>: ニュースのURL（オプション）</p>
          <p>• <strong>publishedAt</strong>: 公開日（YYYY-MM-DD形式）</p>
          <p>• <strong>category</strong>: カテゴリー</p>
          <p>• <strong>relevanceScore</strong>: 関連度スコア（1-100）</p>
        </div>
      </div>
    </div>
  );
};

const NewsSettingsTab: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Settings Form */}
      <div className="card p-6">
        <h4 className="text-lg font-semibold text-secondary-900 mb-6">
          ニュース設定
        </h4>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              デフォルトカテゴリー
            </label>
            <select className="w-full px-3 py-2 border border-secondary-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent">
              <option>技術</option>
              <option>ビジネス</option>
              <option>マーケット</option>
              <option>AI・機械学習</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              最小関連度スコア
            </label>
            <input
              type="number"
              min="1"
              max="100"
              defaultValue="50"
              className="w-full px-3 py-2 border border-secondary-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              週次レポートに含める最大ニュース数
            </label>
            <input
              type="number"
              min="1"
              max="20"
              defaultValue="5"
              className="w-full px-3 py-2 border border-secondary-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-secondary-200">
          <button className="btn-primary">
            設定を保存
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewsManagerPage; 
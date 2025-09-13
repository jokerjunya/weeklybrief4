import { WeeklyReport, StockMovementData, ScheduleItem, NewsItem, AudioSummaryData } from '../types/report';
import { loadBusinessPerformanceData } from './csvUtils';
import {
  getAllNewsFromFirebase,
  getNewsByIdFromFirebase,
  createNewsInFirebase,
  updateNewsInFirebase,
  deleteNewsFromFirebase,
  updateNewsAssignmentInFirebase,
  getNewsForReportFromFirebase,
  getUnassignedNewsFromFirebase,
  subscribeToNewsUpdates,
  subscribeToReportNews
} from '../firebase/database';
import { db } from '../firebase/config';

// ローカルストレージのキー
const NEWS_STORAGE_KEY = 'weeklybrief_news_database';

// 初期ニュースデータ
const initialNewsDatabase: NewsItem[] = [
  {
    id: 'news-1',
    title: 'ChatGPT-5の発表でAI業界に新たな波',
    summary: 'OpenAIが次世代モデルを発表し、企業のAI導入がさらに加速すると予想される。',
    url: 'https://openai.com/chatgpt-5-announcement',
    publishedAt: '2025-01-05',
    category: 'AI',
    relevanceScore: 95,
    assignedReportId: '2025-01-06'
  },
  {
    id: 'news-2',
    title: 'クラウドサービス市場の急成長',
    summary: 'AWSとMicrosoft Azureが競争を激化させ、企業のデジタル変革を推進。',
    url: 'https://aws.amazon.com/news/cloud-market-growth',
    publishedAt: '2025-01-04',
    category: 'クラウド',
    relevanceScore: 88,
    assignedReportId: '2025-01-06'
  },
  {
    id: 'news-3',
    title: 'サイバーセキュリティ投資の増加傾向',
    summary: '企業のセキュリティ投資が前年比25%増加、リモートワークの普及が要因。',
    url: 'https://cybersecurity.com/investment-trends-2025',
    publishedAt: '2025-01-03',
    category: 'セキュリティ',
    relevanceScore: 82,
    assignedReportId: '2025-01-06'
  },
  // 第2週のニュース
  {
    id: 'news-7',
    title: 'OpenAI、GPT-5の開発進捗を公開 - マルチモーダル性能が大幅向上',
    summary: 'OpenAIが次世代モデルGPT-5の開発状況を発表。画像、音声、テキストを統合した処理能力が飛躍的に向上し、2025年後半のリリースを予定。',
    url: 'https://openai.com/gpt-5-progress',
    publishedAt: '2025-01-15',
    category: 'AI Model',
    relevanceScore: 94,
    assignedReportId: '2025-01-13'
  },
  {
    id: 'news-8',
    title: 'Microsoft Copilot Enterprise、新機能で企業採用率が前月比40%増',
    summary: 'Microsoft Copilot Enterpriseが新たな統合機能を追加し、企業での導入が急速に拡大。特にコード生成とドキュメント作成支援機能が高評価。',
    url: 'https://microsoft.com/copilot-enterprise-growth',
    publishedAt: '2025-01-14',
    category: 'Enterprise AI',
    relevanceScore: 89,
    assignedReportId: '2025-01-13'
  },
  {
    id: 'news-9',
    title: 'Amazon、AI駆動の人材マッチングサービス「WorkMatch AI」をローンチ',
    summary: 'Amazonが求職者と企業をAIでマッチングする新サービスを開始。リクルート業界に新たな競争軸をもたらす可能性として注目を集めている。',
    url: 'https://aws.amazon.com/workmatch-ai',
    publishedAt: '2025-01-13',
    category: 'HR Tech',
    relevanceScore: 91,
    assignedReportId: '2025-01-13'
  },
  // 第1週向けのGemini関連ニュース
  {
    id: 'news-4',
    title: '[2025年6月27日] Gemini CLIは現状ちょっとダメかもしれない (週刊AI)',
    summary: 'リリースされたばかりのGemini CLIについてのレビュー記事です。現状ではまだ改善の余地があるとの評価がなされています。',
    url: 'https://zenn.dev/carenet/articles/7f4d0bf85cc0e2',
    publishedAt: '2025-06-27',
    category: 'AI',
    relevanceScore: 85,
    assignedReportId: '2025-01-06'
  },
  {
    id: 'news-5',
    title: 'グーグル、「Gemini CLI」をリリース--AIの機能をターミナルに直接統合',
    summary: 'Googleが、GeminiのAI機能をコマンドラインインターフェース（CLI）から直接利用できる「Gemini CLI」をリリースしたことを報じる記事です。',
    url: 'https://japan.zdnet.com/article/35234816/',
    publishedAt: '2025-06-27',
    category: 'AI',
    relevanceScore: 90,
    assignedReportId: '2025-01-06'
  },
  {
    id: 'news-6',
    title: 'Gemini アプリの機能アップデート（公式）',
    summary: 'Googleの公式発表です。Geminiアプリで特定のタスクのスケジュール設定が可能になりました。また、有料版のGemini Advancedにおいて、より高性能な1.5 Proモデルが利用可能になり、推論やコーディングの性能が向上しました。',
    url: 'https://gemini.google.com/updates?hl=ja',
    publishedAt: '2025-06-25',
    category: 'AI',
    relevanceScore: 88,
    assignedReportId: '2025-01-06'
  },
  // 第3週（2025年6月30日週）向けのニュース
  {
    id: 'news-10',
    title: 'Claude 3.5 Sonnet - 新しいAIベンチマークで最高性能を達成',
    summary: 'Anthropic社のClaude 3.5 Sonnetが、複数のAIベンチマークで従来モデルを上回る性能を記録。特にコーディングタスクにおいて85%の精度を達成し、開発者の生産性向上に大きく貢献。',
    url: 'https://www.anthropic.com/news/claude-3-5-sonnet',
    publishedAt: '2025-06-30',
    category: 'AI',
    relevanceScore: 95,
    assignedReportId: '2025-06-30'
  },
  {
    id: 'news-11', 
    title: 'ChatGPT Searchが正式リリース - リアルタイム検索機能でGoogle検索に挑戦',
    summary: 'OpenAI社がChatGPT Searchを正式リリース。リアルタイムWeb検索機能により、最新情報の取得が可能に。検索市場でのGoogle独占に風穴を開ける可能性が高まる。',
    url: 'https://openai.com/blog/chatgpt-search',
    publishedAt: '2025-06-29',
    category: 'AI',
    relevanceScore: 90,
    assignedReportId: '2025-06-30'
  },
  {
    id: 'news-12',
    title: 'Microsoft Copilot Studio - ノーコードでAIアシスタント構築が可能に',
    summary: 'Microsoftがノーコード環境でカスタムAIアシスタントを構築できるCopilot Studioを発表。企業独自のワークフローに特化したAIアシスタントを簡単に作成可能。',
    url: 'https://www.microsoft.com/copilot-studio',
    publishedAt: '2025-06-28',
    category: 'AI',
    relevanceScore: 88,
    assignedReportId: '2025-06-30'
  },
  // 新しいニュース項目（2025年6月23日-29日）
  {
    id: 'news-13',
    title: '[2025年6月23日] 行動型AIアシスタント「11.ai」を発表',
    summary: 'ElevenLabsは、声で操作できる新しい行動型AIアシスタント「11.ai」（アルファ版）をリリースしました。このアシスタントは、ユーザーのタスク（スケジュールの計画、顧客調査、プロジェクト管理など）を自動化するのに役立ちます。',
    url: 'https://elevenlabs.io/ja/blog',
    publishedAt: '2025-06-23',
    category: 'AI',
    relevanceScore: 87
  },
  {
    id: 'news-14',
    title: '[2025年6月23日] CiscoのWebex AIエージェントへの音声技術提供を発表',
    summary: 'ElevenLabsは、CiscoのWebex AIエージェントに音声技術を提供することを発表しました。これにより、エンタープライズ向けのカスタマーサポートにおいて、より自然で人間らしい音声対話が可能になります。',
    url: 'https://elevenlabs.io/ja/blog',
    publishedAt: '2025-06-23',
    category: 'AI',
    relevanceScore: 85
  },
  {
    id: 'news-15',
    title: '[2025年6月24日] Anthropic、著作権訴訟でAIの「フェアユース」が認められる重要な勝利',
    summary: '米国の連邦判事は、AnthropicがAIモデル「Claude」を訓練するために書籍データを使用したことは、米国の著作権法における「フェアユース（公正な利用）」にあたると判断しました。これは、AIの学習データ利用に関する重要な判例となる可能性があります。',
    url: 'https://m.economictimes.com/tech/artificial-intelligence/anthropic-wins-key-ruling-on-ai-in-authors-copyright-lawsuit/articleshow/122050583.cms',
    publishedAt: '2025-06-24',
    category: 'AI',
    relevanceScore: 93
  },
  {
    id: 'news-16',
    title: '[2025年6月24日] AppleがPerplexityの買収を検討か',
    summary: 'Appleが、自社のAI機能強化のため、AIスタートアップのPerplexityを買収することを検討していると報じられました。Appleの幹部が買収の可能性について社内で議論しているとのことです。',
    url: 'https://www.techradar.com/computing/artificial-intelligence/forget-apple-intelligence-heres-why-i-think-apples-rumored-perplexity-takeover-could-solve-its-ai-woes',
    publishedAt: '2025-06-24',
    category: 'AI',
    relevanceScore: 91
  },
  {
    id: 'news-17',
    title: '[2025年6月24日] ElevenLabs、公式モバイルアプリをリリース',
    summary: 'ElevenLabsの強力なAI音声ツールが、iOSおよびAndroidの公式アプリとして利用可能になりました。これにより、モバイルデバイスからでも手軽に音声生成機能へアクセスできます。',
    url: 'https://elevenlabs.io/ja/blog',
    publishedAt: '2025-06-24',
    category: 'AI',
    relevanceScore: 84
  },
  {
    id: 'news-18',
    title: '[2025年6月27日] Perplexity、リアルタイム金融データやMLBのライブスコアなどを追加',
    summary: 'Perplexityは、リアルタイムの金融データをResearch and Labs機能に追加し、Financeページでは価格変動のタイムラインを、また、MLBチームのライブスコアをフォローする機能などを追加しました。',
    url: 'https://www.perplexity.ai/changelog',
    publishedAt: '2025-06-27',
    category: 'AI',
    relevanceScore: 86
  },
  {
    id: 'news-19',
    title: 'OpenAIがAIチップ供給の多様化を図り、GoogleのTPUを採用 - The Information',
    summary: 'OpenAIは、AIモデルのトレーニングと推論に使用するチップの供給源を多様化するため、GoogleのTensor Processing Unit（TPU）を採用することを決定しました。これにより、NVIDIAへの依存を低減し、コンピューティングリソースの可用性とコストに関する懸念に対処することを目的としています。',
    url: 'https://jp.investing.com/news/stock-market-news/article-1158723',
    publishedAt: '2025-06-28',
    category: 'AI',
    relevanceScore: 89
  },
  {
    id: 'news-20',
    title: '[2025年6月29日] Claudeのパフォーマンスと利用制限に関するユーザーからのフィードバック (Reddit)',
    summary: 'ソーシャルニュースサイトRedditのClaudeAIコミュニティにて、過去一週間におけるClaudeのパフォーマンス、特に利用制限（クオータ）が厳しくなったことに対するユーザーからの不満が多数報告されています。多くのユーザーが、以前より早く使用上限に達してしまうと指摘しています。',
    url: 'https://www.reddit.com/r/ClaudeAI/comments/1lnasi3/claude_performance_report_week_of_june_22_june_29/',
    publishedAt: '2025-06-29',
    category: 'AI',
    relevanceScore: 82
  },
  // Web検索で発見された追加ニュース項目（2025年6月22日-29日）
  {
    id: 'news-21',
    title: '[2025年6月26日] FRB議長パウエル氏「AIが労働市場に大幅な変化をもたらす」と発言',
    summary: 'ジェローム・パウエルFRB議長は米上院銀行委員会で、AIが現時点では経済に大きな影響を与えていないものの、今後数年間で労働市場に「重大な変化」をもたらすと予想されると述べました。AIの経済への影響の規模とタイミングについては未知数としながらも、変革的な効果は避けられないと強調しました。',
    url: 'https://ground.news/article/fed-chair-sees-ai-creating-significant-changes-to-us-workforce',
    publishedAt: '2025-06-26',
    category: 'AI',
    relevanceScore: 90
  },
  {
    id: 'news-22',
    title: '[2025年6月28日] Meta、OpenAIから4人の研究者をスーパーインテリジェンスチームに引き抜き',
    summary: 'Meta Platformsは、OpenAIから4人の著名なAI研究者（Jiahui Yu、Shuchao Bi、Shengjia Zhao、Hongyu Ren）をスーパーインテリジェンスグループに採用しました。これはGenerative AI分野における人材獲得競争の激化を示しており、各社が数百万ドル規模の採用パッケージで優秀な研究者を争奪している状況を浮き彫りにしています。',
    url: 'https://fortune.com/2025/06/28/meta-four-openai-researchers-superintelligence-team-ai-talent-competition/',
    publishedAt: '2025-06-28',
    category: 'AI',
    relevanceScore: 88
  }
];

// LocalStorage からニュースデータを読み込む関数
const loadNewsFromStorage = (): NewsItem[] => {
  try {
    const storedNews = localStorage.getItem(NEWS_STORAGE_KEY);
    if (storedNews) {
      return JSON.parse(storedNews);
    }
  } catch (error) {
    console.error('Failed to load news from localStorage:', error);
  }
  return [...initialNewsDatabase];
};

// LocalStorage にニュースデータを保存する関数
const saveNewsToStorage = (news: NewsItem[]): void => {
  try {
    localStorage.setItem(NEWS_STORAGE_KEY, JSON.stringify(news));
  } catch (error) {
    console.error('Failed to save news to localStorage:', error);
  }
};

// News database - separate from reports
let newsDatabase: NewsItem[] = loadNewsFromStorage();

// Firebase と LocalStorage の切り替えフラグ
// Firebase設定完了、Firebaseを使用
const USE_FIREBASE = true;

// 初期データ移行済みかチェックするフラグ
let migrationChecked = false;

// 初期データをFirebaseに移行する関数
const migrateInitialDataToFirebase = async (): Promise<void> => {
  // 既にチェック済みの場合はスキップ
  if (migrationChecked) {
    console.log('🔄 Migration already checked, skipping');
    return;
  }
  
  console.log('🚀 Starting Firebase migration...');
  console.log('🔍 Migration debug info:', {
    projectId: db?.app?.options?.projectId,
    hasDb: !!db,
    USE_FIREBASE,
    initialDataCount: initialNewsDatabase.length
  });
  
  try {
    // Firebaseに既存データがあるかチェック
    console.log('📡 Checking existing Firebase data...');
    const existingNews = await getAllNewsFromFirebase();
    console.log('📊 Existing Firebase news count:', existingNews.length);
    
    // データが存在しない場合のみ移行
    if (existingNews.length === 0) {
      console.log('📦 Migrating initial data to Firebase...');
      console.log('📋 Items to migrate:', initialNewsDatabase.length);
      
      let successCount = 0;
      let errorCount = 0;
      
      // 初期データをFirebaseに保存
      for (const newsItem of initialNewsDatabase) {
        try {
          console.log(`🔄 Migrating: ${newsItem.id} - ${newsItem.title.substring(0, 50)}...`);
          const result = await createNewsInFirebase(newsItem);
          console.log(`✅ Success: ${newsItem.id}`, result?.id);
          successCount++;
        } catch (itemError) {
          console.error(`❌ Failed to migrate item: ${newsItem.id}`, itemError);
          errorCount++;
        }
      }
      
      console.log(`🎉 Migration completed! Success: ${successCount}, Errors: ${errorCount}`);
      
      // 移行後の確認
      const finalNews = await getAllNewsFromFirebase();
      console.log('🔍 Final Firebase news count after migration:', finalNews.length);
      
    } else {
      console.log('✅ Firebase already has data, skipping migration');
    }
  } catch (error) {
    console.error('❌ Migration failed completely:', error);
    console.error('Error details:', {
      name: (error as any)?.name,
      message: (error as any)?.message,
      code: (error as any)?.code,
      stack: (error as any)?.stack
    });
  } finally {
    migrationChecked = true;
    console.log('🏁 Migration check completed');
  }
};

// 初期データ移行を必要時のみ実行
const ensureDataMigration = async (): Promise<void> => {
  if (USE_FIREBASE && typeof window !== 'undefined' && !migrationChecked) {
    await migrateInitialDataToFirebase();
  }
};

// Sample data for demonstration
const sampleReports: WeeklyReport[] = [
  {
    id: '2025-08-18',
    title: '2025年8月第3週 週次レポート',
    weekOf: '2025年8月18日 - 8月24日',
    createdAt: '2025-08-27T10:00:00Z',
    sections: [
      {
        id: 'business-9',
        type: 'business-performance',
        title: 'ビジネス実績',
        data: null, // 動的に読み込まれる
        notices: [
          '期間：2025/08/18-2025/08/24'
        ]
      },
      {
        id: 'stock-9',
        type: 'stock-movement',
        title: '株価動向',
        data: {
          nikkei: {
            current: 38795,
            previous: 38063,
            change: 732,
            changePercent: 1.92
          },
          sp500: {
            current: 5628.50,
            previous: 5515.25,
            change: 113.25,
            changePercent: 2.05
          },
          recruitHoldings: {
            current: 8397,
            previous: 8152,
            change: 245,
            changePercent: 3.01
          }
        } as StockMovementData,
        notices: [
          '2025/08/27 時点の株価'
        ]
      },
      {
        id: 'audio-9',
        type: 'audio-summary',
        title: '音声サマリー',
        data: {
          transcript: '',
          keyPoints: [
            '主にAI採用ツールの開発と市場投入戦略に焦点を当てています。チームは、AIスクリーニングやソーシング機能、AIリクルーターツールの進捗状況を確認し、候補者の本人確認方法や専門ライセンス認証に関するコストと法的側面について議論しています。',
            '製品の完成率とユーザー体験の向上、市場投入戦略、そして顧客からのフィードバックに基づいた製品名の変更といった課題にも取り組んでいます。',
            'ツール使用時の法的責任と仲裁合意に関する懸念事項も議題となっています。'
          ],
          audioFiles: [{
            id: 'weekly-audio-2025-08-18',
            title: 'AI採用の光と影：本人確認、品質、そして法務リスクの舞台裏',
            audioUrl: '/audio/AI採用の光と影：本人確認、品質、そして法務リスクの舞台裏.m4a',
            duration: 0 // 実際の長さは後で設定可能
          }]
        } as AudioSummaryData
      },
      {
        id: 'news-9',
        type: 'ai-news',
        title: 'AI・テクノロジーニュース',
        data: [] // 動的に生成される（空で開始）
      },
      {
        id: 'competitor-9',
        type: 'competitor-reports',
        title: '1Q決算レポートリンク',
        data: [
          {
            id: 'persol-q1-2025',
            companyName: 'パーソル',
            reportUrl: 'https://docs.google.com/document/d/1iEnkpRmbKH4PA0QyEkGmMJTHgXJKV0c2RrTblAf4RN4/edit?usp=drive_link',
            description: '2025年1Q決算分析レポート',
            category: 'HR Tech' as const
          },
          {
            id: 'enjapan-q1-2025',
            companyName: 'エンジャパン',
            reportUrl: 'https://docs.google.com/document/d/1mgyhOsMVXrd_4fdskCy-xj9w5ES2wUQtQiDkFfPDkvM/edit?usp=drive_link',
            description: '2025年1Q決算分析レポート',
            category: 'Recruitment' as const
          },
          {
            id: 'kakakucom-q1-2025',
            companyName: 'カカクコム',
            reportUrl: 'https://docs.google.com/document/d/1ET_wr64J8JZSSu4uImnwHrxQwY5eTIp0mVU1ebMKhrc/edit?usp=drive_link',
            description: '2025年1Q決算分析レポート',
            category: 'E-commerce' as const
          },
          {
            id: 'quick-q1-2025',
            companyName: 'クイック',
            reportUrl: 'https://docs.google.com/document/d/1AnPq3spv6caINB-K9HM6hhPIM9NQqGKGkPPUjFnldps/edit?usp=drive_link',
            description: '2025年1Q決算分析レポート',
            category: 'Recruitment' as const
          }
        ]
      }
    ]
  },
  {
    id: '2025-08-11',
    title: '2025年8月第2週 週次レポート',
    weekOf: '2025年8月11日 - 8月17日',
    createdAt: '2025-08-20T10:00:00Z',
    sections: [
      {
        id: 'business-8',
        type: 'business-performance',
        title: 'ビジネス実績',
        data: null, // 動的に読み込まれる
        notices: [
          '期間：2025/08/11-2025/08/17'
        ]
      },
      {
        id: 'stock-8',
        type: 'stock-movement',
        title: '株価動向',
        data: {
          nikkei: {
            current: 38063,
            previous: 37389,
            change: 674,
            changePercent: 1.80
          },
          sp500: {
            current: 5515.25,
            previous: 5505.00,
            change: 10.25,
            changePercent: 0.19
          },
          recruitHoldings: {
            current: 8152,
            previous: 8217,
            change: -65,
            changePercent: -0.79
          }
        } as StockMovementData,
        notices: [
          '2025/08/20 時点の株価'
        ]
      },
      {
        id: 'audio-8',
        type: 'audio-summary',
        title: '音声サマリー',
        data: {
          transcript: '',
          keyPoints: [
            '今週はMTGがなし'
          ],
          audioFiles: []
        } as AudioSummaryData
      },
      {
        id: 'news-8',
        type: 'ai-news',
        title: 'AI・テクノロジーニュース',
        data: [] // 動的に生成される（空で開始）
      },
      {
        id: 'competitor-8',
        type: 'competitor-reports',
        title: '1Q決算レポートリンク',
        data: [
          {
            id: 'persol-q1-2025',
            companyName: 'パーソル',
            reportUrl: 'https://docs.google.com/document/d/1iEnkpRmbKH4PA0QyEkGmMJTHgXJKV0c2RrTblAf4RN4/edit?usp=drive_link',
            description: '2025年1Q決算分析レポート',
            category: 'HR Tech' as const
          },
          {
            id: 'enjapan-q1-2025',
            companyName: 'エンジャパン',
            reportUrl: 'https://docs.google.com/document/d/1mgyhOsMVXrd_4fdskCy-xj9w5ES2wUQtQiDkFfPDkvM/edit?usp=drive_link',
            description: '2025年1Q決算分析レポート',
            category: 'Recruitment' as const
          },
          {
            id: 'kakakucom-q1-2025',
            companyName: 'カカクコム',
            reportUrl: 'https://docs.google.com/document/d/1ET_wr64J8JZSSu4uImnwHrxQwY5eTIp0mVU1ebMKhrc/edit?usp=drive_link',
            description: '2025年1Q決算分析レポート',
            category: 'E-commerce' as const
          },
          {
            id: 'quick-q1-2025',
            companyName: 'クイック',
            reportUrl: 'https://docs.google.com/document/d/1AnPq3spv6caINB-K9HM6hhPIM9NQqGKGkPPUjFnldps/edit?usp=drive_link',
            description: '2025年1Q決算分析レポート',
            category: 'Recruitment' as const
          }
        ]
      }
    ]
  },
  {
    id: '2025-08-04',
    title: '2025年8月第1週 週次レポート',
    weekOf: '2025年8月4日 - 8月10日',
    createdAt: '2025-08-04T10:00:00Z',
    sections: [
      {
        id: 'business-7',
        type: 'business-performance',
        title: 'ビジネス実績',
        data: null, // 動的に読み込まれる
        notices: [
          '期間：2025/07/27-2025/08/02'
        ]
      },
      {
        id: 'stock-7',
        type: 'stock-movement',
        title: '株価動向',
        data: {
          nikkei: {
            current: 40205,
            previous: 39800,
            change: 405,
            changePercent: 1.02
          },
          sp500: {
            current: 6420.75,
            previous: 6310.50,
            change: 110.25,
            changePercent: 1.75
          },
          recruitHoldings: {
            current: 8750,
            previous: 8650,
            change: 100,
            changePercent: 1.16
          }
        } as StockMovementData,
        notices: [
          '2025/08/04 時点の株価'
        ]
      },
      {
        id: 'audio-7',
        type: 'audio-summary',
        title: '音声サマリー',
        data: {
          transcript: '',
          keyPoints: [
            'IndeedはAIを活用した採用ソリューションの市場戦略と製品開発について議論しています。彼らは、AIソーシングの顧客からの肯定的なフィードバックに注目し、特に導入プログラムと無料トライアルを通じて製品の普及を促進する方法を模索しています。チームはまた、応募者のエンゲージメントと応答時間の最適化に焦点を当て、本人確認サービスの潜在的な価値と、これらのサービスをどのように収益化できるかについても検討しています。全体として、彼らは採用プロセスの簡素化と、市場のニーズと法的制約に対応したAI機能の統合を目指しています。'
          ],
          audioFiles: [{
            id: 'weekly-audio-2025-08-04',
            title: 'Sourcing & Screening Weekly 2025年7月29日',
            audioUrl: '/audio/Sourcing & Screening Weekly 2025年7月29日.wav',
            duration: 0
          }]
        } as AudioSummaryData
      },
      {
        id: 'news-7',
        type: 'ai-news',
        title: 'AI・テクノロジーニュース',
        data: [] // 動的に生成される（空で開始）
      },
      {
        id: 'schedule-7',
        type: 'weekly-schedule',
        title: '今週の予定',
        data: [] as ScheduleItem[] // 空で開始
      }
    ]
  },
  {
    id: '2025-07-28',
    title: '2025年7月第4週 週次レポート',
    weekOf: '2025年7月28日 - 8月3日',
    createdAt: '2025-07-28T10:00:00Z',
    sections: [
      {
        id: 'business-6',
        type: 'business-performance',
        title: 'ビジネス実績',
        data: null, // 動的に読み込まれる
        notices: [
          '期間：2025/07/21-2025/07/27'
        ]
      },
      {
        id: 'stock-6',
        type: 'stock-movement',
        title: '株価動向',
        data: {
          nikkei: {
            current: 39800,
            previous: 39570,
            change: 230,
            changePercent: 0.58
          },
          sp500: {
            current: 6310.50,
            previous: 6259.75,
            change: 50.75,
            changePercent: 0.81
          },
          recruitHoldings: {
            current: 8650,
            previous: 8556,
            change: 94,
            changePercent: 1.10
          }
        } as StockMovementData,
        notices: [
          '2025/07/28 時点の株価'
        ]
      },
      {
        id: 'audio-6',
        type: 'audio-summary',
        title: '音声サマリー',
        data: {
          transcript: '',
          keyPoints: [
            '法的懸念、製品戦略の変更、採用計画、およびLLMの利用や身元確認システムといった様々な機能について検討しています。また、候補者のフィルタリングにおける課題や、費用対効果を考慮しつつ、主要な構成要素を優先的に構築することの重要性も強調されています。全体として、進化する市場と規制の状況に対応しながら、幅広い顧客ベースを引き付けるための戦略的な方向性が示されています。'
          ],
          audioFiles: [{
            id: 'weekly-audio-2025-07-28',
            title: 'Sourcing & Screening Weekly 2025年7月22日',
            audioUrl: '/audio/Sourcing & Screening Weekly 2025年7月22日.wav',
            duration: 0
          }]
        } as AudioSummaryData
      },
      {
        id: 'news-6',
        type: 'ai-news',
        title: 'AI・テクノロジーニュース',
        data: [] // 動的に生成される（空で開始）
      },
      {
        id: 'schedule-6',
        type: 'weekly-schedule',
        title: '今週の予定',
        data: [] as ScheduleItem[] // 空で開始
      }
    ]
  },
  {
    id: '2025-07-14',
    title: '2025年7月第2週 週次レポート',
    weekOf: '2025年7月14日 - 7月20日',
    createdAt: '2025-07-14T10:00:00Z',
    sections: [
      {
        id: 'business-5',
        type: 'business-performance',
        title: 'ビジネス実績',
        data: null, // 動的に読み込まれる
        notices: [
          '期間：2025/07/07-2025/07/13'
        ]
      },
      {
        id: 'stock-5',
        type: 'stock-movement',
        title: '株価動向',
        data: {
          nikkei: {
            current: 39570,
            previous: 39689,
            change: -119,
            changePercent: -0.30
          },
          sp500: {
            current: 6259.75,
            previous: 6280.46,
            change: -20.71,
            changePercent: -0.33
          },
          recruitHoldings: {
            current: 8556,
            previous: 8399,
            change: 157,
            changePercent: 1.85
          }
        } as StockMovementData,
        notices: [
          '2025/07/12 終値時点の株価'
        ]
      },
      {
        id: 'audio-5',
        type: 'audio-summary',
        title: '音声サマリー',
        data: {
          transcript: '',
          keyPoints: [
            '法的な課題、特にWorkdayのケースに似たリスクを軽減しながら製品を市場に投入する方法について議論しています。また、価格設定戦略、さまざまな機能（求職者の事前資格審査、応募上限、スクリーニング質問など）の機能的側面、およびAIを活用したマッチングと採用基準の抽出を改善するための計画にも焦点を当てています。さらに、パイロットプログラムの進捗状況、自動化機能、そして製品の導入と継続的な改善における求職者と雇用主のエンゲージメントの重要性についても触れられています。'
          ],
          audioFiles: [{
            id: 'weekly-audio-2025-07-14',
            title: 'Sourcing & Screening Weekly 2025年7月8日',
            audioUrl: '/audio/Sourcing & Screening Weekly 2025年7月8日.wav',
            duration: 298
          }]
        } as AudioSummaryData
      },
      {
        id: 'news-5',
        type: 'ai-news',
        title: 'AI・テクノロジーニュース',
        data: [] // 動的に生成される（AIニュース0件）
      },
      {
        id: 'schedule-5',
        type: 'weekly-schedule',
        title: '今週の予定',
        data: [
          {
            id: 'schedule-5-1',
            date: '2025-07-15',
            title: '四半期業績レビュー',
            description: 'Q2業績の最終確認と Q3戦略の策定',
            type: 'meeting'
          },
          {
            id: 'schedule-5-2',
            date: '2025-07-16',
            title: '新製品ロードマップ会議',
            description: 'AI機能の実装スケジュール調整',
            type: 'meeting'
          },
          {
            id: 'schedule-5-3',
            date: '2025-07-17',
            title: 'クライアント提案書提出',
            description: '大手企業向けソリューション提案',
            type: 'deadline'
          },
          {
            id: 'schedule-5-4',
            date: '2025-07-18',
            title: 'マーケティング戦略ワークショップ',
            description: 'Q3マーケティング計画の策定',
            type: 'meeting'
          }
        ] as ScheduleItem[]
      }
    ]
  },
  {
    id: '2025-07-07',
    title: '2025年7月第1週 週次レポート',
    weekOf: '2025年7月7日 - 7月13日',
    createdAt: '2025-07-07T10:00:00Z',
    sections: [
      {
        id: 'business-4',
        type: 'business-performance',
        title: 'ビジネス実績',
        data: null, // 動的に読み込まれる
        notices: [
          '期間：2025/06/29-2025/07/05'
        ]
      },
      {
        id: 'stock-4',
        type: 'stock-movement',
        title: '株価動向',
        data: {
          nikkei: {
            current: 39576,
            previous: 39811,
            change: -235,
            changePercent: -0.59
          },
          sp500: {
            current: 6279.35,
            previous: 6242.00,
            change: 37.35,
            changePercent: 0.60
          },
          recruitHoldings: {
            current: 8401,
            previous: 8488,
            change: -87,
            changePercent: -1.02
          }
        } as StockMovementData,
        notices: [
          '2025/07/07 10:25時点の株価（日経平均は実際の市場価格を反映）'
        ]
      },
      {
        id: 'audio-4',
        type: 'audio-summary',
        title: '音声サマリー',
        data: {
          transcript: '',
          keyPoints: [
            'チームは、エンタープライズ企業や人材紹介会社をターゲットとした専門職向けのAIソーシング製品の機会、潜在的な収益、競合状況について議論しました。特に、LinkedInとの競争戦略、市場規模の評価、および自動ソーシングシステムのパフォーマンスとマッチング品質の向上に重点が置かれています。また、将来のステップとして、人材紹介会社の支出を市場分析に含めることや、より大胆なメールアプローチを検討することなどが挙げられています。'
          ],
          audioFiles: [{
            id: 'weekly-audio-2025-07-07',
            title: 'Sourcing & Screening Weekly 2025年7月1日',
            audioUrl: '/audio/weekly-2025-07-07.wav',
            duration: 332
          }]
        } as AudioSummaryData
      },
      {
        id: 'news-4',
        type: 'ai-news',
        title: 'AI・テクノロジーニュース',
        data: [] // 動的に生成される
      },
      {
        id: 'schedule-4',
        type: 'weekly-schedule',
        title: '今週の予定',
        data: [] as ScheduleItem[]
      }
    ]
  },
  {
    id: '2025-01-13',
    title: '2025年1月第2週 週次レポート',
    weekOf: '2025年1月13日週',
    createdAt: '2025-01-13T10:00:00Z',
    sections: [
      {
        id: 'audio-2',
        type: 'audio-summary',
        title: '音声サマリー（Sourcing & Screening Weekly）',
        data: {
          transcript: '',
          keyPoints: [],
          audioFiles: [
            {
              id: 'audio-2-1',
              title: 'Sourcing & Screening Weekly',
              audioUrl: '/audio/weekly-2025-01-13.wav',
              duration: 385
            }
          ]
        } as AudioSummaryData
      },
      {
        id: 'business-2',
        type: 'business-performance',
        title: 'ビジネス実績',
        data: null // 動的に読み込まれる
      },
      {
        id: 'stock-2',
        type: 'stock-movement',
        title: '株式市場動向',
        data: {
          nikkei: {
            current: 39725.46,
            previous: 40083.73,
            change: -358.27,
            changePercent: -0.89
          },
          sp500: {
            current: 5893.62,
            previous: 5862.85,
            change: 30.77,
            changePercent: 0.52
          },
          recruitHoldings: {
            current: 9150,
            previous: 8930,
            change: 220,
            changePercent: 2.46
          }
        } as StockMovementData
      },
      {
        id: 'schedule-2',
        type: 'weekly-schedule',
        title: '今週の予定',
        data: [
          { id: '5', date: '2025-01-14', title: '営業チーム週次会議', description: '第2週業績確認', type: 'meeting' },
          { id: '6', date: '2025-01-15', title: 'マーケティング戦略ワークショップ', type: 'meeting' },
          { id: '7', date: '2025-01-16', title: 'IT部門セキュリティ監査', type: 'meeting' },
          { id: '8', date: '2025-01-17', title: 'クライアント年度契約更新', type: 'deadline' },
          { id: '9', date: '2025-01-19', title: '新年度計画発表会', type: 'event' }
        ] as ScheduleItem[]
      },
      {
        id: 'news-2',
        type: 'ai-news',
        title: 'AI・テクノロジーニュース',
        data: [] // 動的に生成される
      }
    ]
  },
  {
    id: '2025-01-06',
    title: '2025年1月第1週 週次レポート',
    weekOf: '2025年1月6日週',
    createdAt: '2025-01-06T10:00:00Z',
    sections: [
      {
        id: 'audio-1',
        type: 'audio-summary',
        title: '音声サマリー（Sourcing & Screening Weekly）',
        data: {
          transcript: '',
          keyPoints: [],
          audioFiles: [
            {
              id: 'audio-1-1',
              title: 'Sourcing & Screening Weekly',
              audioUrl: '/audio/weekly-2025-01-06.wav',
              duration: 420
            }
          ]
        } as AudioSummaryData
      },
      {
        id: 'business-1',
        type: 'business-performance',
        title: 'ビジネス実績',
        data: null // 動的に読み込まれる
      },
      {
        id: 'stock-1',
        type: 'stock-movement',
        title: '株式市場動向',
        data: {
          nikkei: {
            current: 40083.73,
            previous: 39863.82,
            change: 219.91,
            changePercent: 0.55
          },
          sp500: {
            current: 5862.85,
            previous: 5851.20,
            change: 11.65,
            changePercent: 0.20
          },
          recruitHoldings: {
            current: 8930,
            previous: 8820,
            change: 110,
            changePercent: 1.25
          }
        } as StockMovementData
      },
      {
        id: 'schedule-1',
        type: 'weekly-schedule',
        title: '今週の予定',
        data: [
          { id: '1', date: '2025-01-07', title: '取締役会', description: '月次業績レビュー', type: 'meeting' },
          { id: '2', date: '2025-01-08', title: 'プロダクト戦略会議', type: 'meeting' },
          { id: '3', date: '2025-01-10', title: '四半期レポート提出', type: 'deadline' },
          { id: '4', date: '2025-01-12', title: '新機能リリース', type: 'milestone' }
        ] as ScheduleItem[]
      },
      {
        id: 'news-1',
        type: 'ai-news',
        title: 'AI・テクノロジーニュース',
        data: [] // 動的に生成される
      }
    ]
  },
  {
    id: '2025-06-30',
    title: '2025年6月第4週 週次レポート',
    weekOf: '2025年6月30日 - 7月6日',
    createdAt: '2025-06-30T10:00:00Z',
    sections: [
      {
        id: 'business-3',
        type: 'business-performance',
        title: 'ビジネス実績',
        data: null, // 動的に読み込まれる
        notices: [
          '期間：2025/06/22-06/28'
        ]
      },
      {
        id: 'stock-3',
        type: 'stock-movement',
        title: '株式市場動向',
        data: {
          nikkei: {
            current: 38725.47,
            previous: 38474.90,
            change: 250.57,
            changePercent: 0.65
          },
          sp500: {
            current: 5974.07,
            previous: 5918.23,
            change: 55.84,
            changePercent: 0.94
          },
          recruitHoldings: {
            current: 8420,
            previous: 8280,
            change: 140,
            changePercent: 1.69
          }
        } as StockMovementData,
        notices: [
          '2025年6月30日14:00時点の株価'
        ]
      },
      {
        id: 'audio-3',
        type: 'audio-summary',
        title: '音声サマリー',
        data: {
          transcript: '',
          keyPoints: [],
          audioFiles: [
            {
              id: 'audio-3-1',
              title: 'Sourcing & Screening Weekly 2025年6月24日',
              audioUrl: '/audio/weekly-2025-06-30.wav',
              duration: 450
            },
            {
              id: 'audio-3-2', 
              title: 'Jobs & Applications Weekly 2025年6月24日',
              audioUrl: '/audio/Jobs & Applications Weekly 2025年6月24日.wav',
              duration: 480
            },
            {
              id: 'audio-3-3',
              title: 'Deko - SLT 売上シンクMTG 2025年6月26日',
              audioUrl: '/audio/Deko - SLT rev sync 2025年6月26日.wav',
              duration: 420
            }
          ]
        } as AudioSummaryData
      },
      {
        id: 'news-3',
        type: 'ai-news',
        title: 'AI・テクノロジーニュース',
        data: [] // 動的に生成される
      },
      {
        id: 'schedule-3',
        type: 'weekly-schedule',
        title: '今週の予定',
        data: [
          {
            id: 'schedule-3-1',
            date: '2025-07-02',
            title: 'IVS参加@京都',
            type: 'event'
          }
        ] as ScheduleItem[]
      }
    ]
  }
];

// Helper function to attach dynamic data to reports
const attachDynamicDataToReport = async (report: WeeklyReport): Promise<WeeklyReport> => {
  console.log(`🔥 === attachDynamicDataToReport for report: ${report.id} ===`);
  
  // Attach news - Firebase/localStorage統一アクセスを使用
  const newsSection = report.sections.find(section => section.type === 'ai-news');
  if (newsSection) {
    console.log(`📡 News section found for report ${report.id}`);
    console.log(`⚠️ BEFORE: News section has ${Array.isArray(newsSection.data) ? newsSection.data.length : 'non-array'} items`);
    
          // ✅ getNewsForReport を使用してFirebase/localStorage統一アクセス
      const assignedNews = await getNewsForReport(report.id);
    console.log(`🔥 CRITICAL: Firebase returned ${assignedNews.length} items for report ${report.id}`);
         console.log('🔥 CRITICAL: Firebase news titles:', assignedNews.map((n: NewsItem) => `${n.id}: ${n.title}`));
    
    // 強制的にFirebaseデータで上書き
    newsSection.data = assignedNews;
    console.log(`✅ AFTER: News section now has ${newsSection.data.length} items`);
         console.log(`✅ Final news titles:`, newsSection.data.map((n: NewsItem) => `${n.id}: ${n.title}`));
  } else {
    console.log(`❌ No news section found for report ${report.id}`);
  }
  
  // Attach business performance data
  const businessSection = report.sections.find(section => section.type === 'business-performance');
  if (businessSection) {
    const businessData = await loadBusinessPerformanceData(report.id);
    businessSection.data = businessData;
  }
  
  console.log(`🎯 === End attachDynamicDataToReport for report: ${report.id} ===`);
  console.log(`🎯 Final report sections:`, report.sections.map((s: any) => ({ 
    type: s.type, 
    dataLength: Array.isArray(s.data) ? s.data.length : 'non-array' 
  })));
  
  return report;
};

export const getLatestReport = async (): Promise<WeeklyReport | null> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // In a real app, this would fetch from an API
  // Return the most recent report (sorted by createdAt)
  const sortedReports = [...sampleReports].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const report = sortedReports.length > 0 ? sortedReports[0] : null;
  console.log('getLatestReport - selected report:', report?.id);
  return report ? await attachDynamicDataToReport(report) : null;
};

export const getReportById = async (id: string): Promise<WeeklyReport | null> => {
  console.log('🎯 === getReportById called with ID:', id, '===');
  
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // In a real app, this would fetch from an API
  const report = sampleReports.find(r => r.id === id);
  console.log(`📊 getReportById - requested ID: ${id}, found report:`, report?.id);
  
  if (report) {
    console.log('🔄 About to call attachDynamicDataToReport...');
    const reportWithData = await attachDynamicDataToReport(report);
    console.log('✅ attachDynamicDataToReport completed for report:', reportWithData.id);
    return reportWithData;
  } else {
    console.log('❌ No report found with ID:', id);
    return null;
  }
};

export const getAllReports = async (): Promise<WeeklyReport[]> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1200));
  
  // In a real app, this would fetch from an API
  // Return sorted by date (newest first)
  const reports = [...sampleReports].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const reportsWithData = await Promise.all(reports.map(report => attachDynamicDataToReport(report)));
  return reportsWithData;
};

export const createReport = async (report: Omit<WeeklyReport, 'id' | 'createdAt'>): Promise<WeeklyReport> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  const newReport: WeeklyReport = {
    ...report,
    id: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString()
  };
  
  // In a real app, this would save to an API
  sampleReports.unshift(newReport);
  
  return newReport;
};

export const updateReport = async (id: string, updates: Partial<WeeklyReport>): Promise<WeeklyReport | null> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const reportIndex = sampleReports.findIndex(r => r.id === id);
  if (reportIndex === -1) return null;
  
  // In a real app, this would update via API
  sampleReports[reportIndex] = { ...sampleReports[reportIndex], ...updates };
  
  return sampleReports[reportIndex];
};

export const deleteReport = async (id: string): Promise<boolean> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const reportIndex = sampleReports.findIndex(r => r.id === id);
  if (reportIndex === -1) return false;
  
  // In a real app, this would delete via API
  sampleReports.splice(reportIndex, 1);
  
  return true;
};

// News management functions
export const getAllNews = async (): Promise<NewsItem[]> => {
  console.log('🎯 getAllNews called, USE_FIREBASE:', USE_FIREBASE);
  
  if (USE_FIREBASE) {
    try {
      console.log('📡 Using Firebase path...');
      
      // 必要に応じて初期データ移行を実行
      console.log('🔄 Ensuring data migration...');
      await ensureDataMigration();
      
      console.log('📊 Fetching news from Firebase...');
      const result = await getAllNewsFromFirebase();
      console.log('✅ Firebase getAllNews success! Retrieved', result.length, 'items');
      console.log('📰 Sample items:', result.slice(0, 3).map(n => ({ id: n.id, title: n.title.substring(0, 50) })));
      
      return result;
    } catch (error) {
      console.error('❌ Firebase failed, falling back to localStorage:', error);
      console.error('Error details:', {
        name: (error as any)?.name,
        message: (error as any)?.message,
        code: (error as any)?.code
      });
      
      // フォールバック: localStorage を使用
      console.log('💾 Using localStorage fallback...');
      await new Promise(resolve => setTimeout(resolve, 600));
      const fallbackResult = [...newsDatabase].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
      console.log('💾 localStorage fallback returned', fallbackResult.length, 'items');
      return fallbackResult;
    }
  } else {
    console.log('💾 Using localStorage (USE_FIREBASE is false)...');
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 600));
    
    // Return sorted by date (newest first)
    const result = [...newsDatabase].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    console.log('💾 localStorage returned', result.length, 'items');
    return result;
  }
};

export const getNewsById = async (id: string): Promise<NewsItem | null> => {
  if (USE_FIREBASE) {
    try {
      return await getNewsByIdFromFirebase(id);
    } catch (error) {
      console.error('Firebase failed, falling back to localStorage:', error);
      await new Promise(resolve => setTimeout(resolve, 300));
      const news = newsDatabase.find(n => n.id === id);
      return news || null;
    }
  } else {
    await new Promise(resolve => setTimeout(resolve, 300));
    const news = newsDatabase.find(n => n.id === id);
    return news || null;
  }
};

export const updateNewsAssignment = async (newsId: string, reportId: string | undefined): Promise<NewsItem | null> => {
  console.log('🔥 updateNewsAssignment called:', { newsId, reportId, USE_FIREBASE });
  
  if (USE_FIREBASE) {
    try {
      console.log('📡 Attempting Firebase update...');
      const result = await updateNewsAssignmentInFirebase(newsId, reportId);
      console.log('✅ Firebase: News assignment updated successfully', { newsId, reportId, result });
      return result;
    } catch (error) {
      console.error('❌ Firebase failed, falling back to localStorage:', error);
      // フォールバック: localStorage を使用
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const newsIndex = newsDatabase.findIndex(n => n.id === newsId);
      if (newsIndex === -1) return null;
      
      newsDatabase[newsIndex] = {
        ...newsDatabase[newsIndex],
        assignedReportId: reportId
      };
      
      saveNewsToStorage(newsDatabase);
      return newsDatabase[newsIndex];
    }
  } else {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const newsIndex = newsDatabase.findIndex(n => n.id === newsId);
    if (newsIndex === -1) return null;
    
    newsDatabase[newsIndex] = {
      ...newsDatabase[newsIndex],
      assignedReportId: reportId
    };
    
    saveNewsToStorage(newsDatabase);
    return newsDatabase[newsIndex];
  }
};

export const createNewsItem = async (newsData: Omit<NewsItem, 'id'>): Promise<NewsItem> => {
  if (USE_FIREBASE) {
    try {
      return await createNewsInFirebase(newsData);
    } catch (error) {
      console.error('Firebase failed, falling back to localStorage:', error);
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const newNews: NewsItem = {
        ...newsData,
        id: `news-${Date.now()}`
      };
      
      newsDatabase.unshift(newNews);
      saveNewsToStorage(newsDatabase);
      return newNews;
    }
  } else {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const newNews: NewsItem = {
      ...newsData,
      id: `news-${Date.now()}`
    };
    
    newsDatabase.unshift(newNews);
    saveNewsToStorage(newsDatabase);
    return newNews;
  }
};

export const updateNewsItem = async (id: string, updates: Partial<NewsItem>): Promise<NewsItem | null> => {
  if (USE_FIREBASE) {
    try {
      return await updateNewsInFirebase(id, updates);
    } catch (error) {
      console.error('Firebase failed, falling back to localStorage:', error);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const newsIndex = newsDatabase.findIndex(n => n.id === id);
      if (newsIndex === -1) return null;
      
      newsDatabase[newsIndex] = { ...newsDatabase[newsIndex], ...updates };
      saveNewsToStorage(newsDatabase);
      return newsDatabase[newsIndex];
    }
  } else {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const newsIndex = newsDatabase.findIndex(n => n.id === id);
    if (newsIndex === -1) return null;
    
    newsDatabase[newsIndex] = { ...newsDatabase[newsIndex], ...updates };
    saveNewsToStorage(newsDatabase);
    return newsDatabase[newsIndex];
  }
};

export const deleteNewsItem = async (id: string): Promise<boolean> => {
  if (USE_FIREBASE) {
    try {
      return await deleteNewsFromFirebase(id);
    } catch (error) {
      console.error('Firebase failed, falling back to localStorage:', error);
      await new Promise(resolve => setTimeout(resolve, 400));
      
      const newsIndex = newsDatabase.findIndex(n => n.id === id);
      if (newsIndex === -1) return false;
      
      newsDatabase.splice(newsIndex, 1);
      saveNewsToStorage(newsDatabase);
      return true;
    }
  } else {
    await new Promise(resolve => setTimeout(resolve, 400));
    
    const newsIndex = newsDatabase.findIndex(n => n.id === id);
    if (newsIndex === -1) return false;
    
    newsDatabase.splice(newsIndex, 1);
    saveNewsToStorage(newsDatabase);
    return true;
  }
};

export const getUnassignedNews = async (): Promise<NewsItem[]> => {
  if (USE_FIREBASE) {
    try {
      return await getUnassignedNewsFromFirebase();
    } catch (error) {
      console.error('Firebase failed, falling back to localStorage:', error);
      await new Promise(resolve => setTimeout(resolve, 400));
      return newsDatabase.filter(news => !news.assignedReportId);
    }
  } else {
    await new Promise(resolve => setTimeout(resolve, 400));
    return newsDatabase.filter(news => !news.assignedReportId);
  }
};

export const getNewsForReport = async (reportId: string): Promise<NewsItem[]> => {
  console.log('🎯 getNewsForReport called for reportId:', reportId);
  
  if (USE_FIREBASE) {
    try {
      console.log('📡 Attempting to fetch from Firebase...');
      const result = await getNewsForReportFromFirebase(reportId);
      console.log('✅ Firebase returned', result.length, 'news items for report', reportId);
      console.log('📰 News items:', result.map(n => ({ id: n.id, title: n.title })));
      return result;
    } catch (error) {
      console.error('❌ Firebase failed, falling back to localStorage:', error);
      await new Promise(resolve => setTimeout(resolve, 300));
      const localResult = newsDatabase.filter(news => news.assignedReportId === reportId);
      console.log('💾 localStorage returned', localResult.length, 'news items for report', reportId);
      console.log('📰 Local news items:', localResult.map(n => ({ id: n.id, title: n.title })));
      return localResult;
    }
  } else {
    await new Promise(resolve => setTimeout(resolve, 300));
    const localResult = newsDatabase.filter(news => news.assignedReportId === reportId);
    console.log('💾 localStorage returned', localResult.length, 'news items for report', reportId);
    console.log('📰 Local news items:', localResult.map(n => ({ id: n.id, title: n.title })));
    return localResult;
  }
};

// リアルタイム同期用の新しい関数をエクスポート
export { subscribeToNewsUpdates, subscribeToReportNews };

// 既存の関数を削除し、元の構造に戻す 
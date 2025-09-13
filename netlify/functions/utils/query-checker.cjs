/**
 * クエリチェッカー - 各グラフのクエリを簡単に確認・検証
 * 
 * 使用方法:
 * node query-checker.cjs [query-name]  
 * 例: node query-checker.cjs souke
 */

const { 
  getSoukeChartDataQuery, 
  getNaiteiWeeklyDataQuery, 
  getNaiteiDailyDataQuery, 
  getNaiteiCumulativeDataQuery,
  getSoukeChannelOverviewQuery,
  getSoukeChannelDetailQuery
} = require('./query-definitions.cjs');

/**
 * 利用可能なクエリ一覧
 */
const AVAILABLE_QUERIES = {
  // グラフ用クエリ
  'souke': {
    name: 'Souke Chart Data（総受グラフ）',
    function: getSoukeChartDataQuery,
    graphs: ['デイリー総受推移', '累計総受推移', '週次総受推移'],
    description: '総受データの日次・週次・累計を取得'
  },
  'naitei-daily': {
    name: 'Naitei Daily Data（日次内定数）',
    function: getNaiteiDailyDataQuery,
    graphs: ['デイリー内定数推移'],
    description: '内定数の日次データを取得（前年同日比較）'
  },
  'naitei-weekly': {
    name: 'Naitei Weekly Data（週次内定数）', 
    function: getNaiteiWeeklyDataQuery,
    graphs: ['週次内定数推移'],
    description: '内定数の週次データを取得（前年同週比較）'
  },
  'naitei-cumulative': {
    name: 'Naitei Cumulative Data（累計内定数）',
    function: getNaiteiCumulativeDataQuery,
    graphs: ['累計内定数推移'],
    description: '内定数の累計データを取得（前年同日累計比較）'
  },
  
  // テーブル用クエリ
  'channel-overview': {
    name: 'Channel Overview（チャネル大分類）',
    function: getSoukeChannelOverviewQuery,
    graphs: ['チャネル大分類テーブル'],
    description: 'オーガニック・有料広告・その他の大分類別実績'
  },
  'channel-detail': {
    name: 'Channel Detail（チャネル詳細）',
    function: getSoukeChannelDetailQuery,
    graphs: ['チャネル詳細分類テーブル'], 
    description: 'リスティング指名・非指名、SEO等の詳細分類別実績'
  }
};

/**
 * クエリの基本情報を表示
 */
function displayQueryInfo(queryKey) {
  const query = AVAILABLE_QUERIES[queryKey];
  if (!query) {
    console.error(`❌ クエリ "${queryKey}" は存在しません`);
    displayAvailableQueries();
    return;
  }

  console.log(`\n📊 ${query.name}`);
  console.log(`🎯 用途: ${query.description}`);
  console.log(`📈 対象グラフ: ${query.graphs.join(', ')}`);
  console.log('─'.repeat(60));
}

/**
 * クエリの内容を表示（最初の500文字）
 */
function displayQueryPreview(queryKey) {
  const query = AVAILABLE_QUERIES[queryKey];
  if (!query) return;

  try {
    const queryString = query.function();
    const preview = queryString.substring(0, 500);
    
    console.log(`\n🔍 クエリプレビュー（最初の500文字）:`);
    console.log('─'.repeat(60));
    console.log(preview);
    console.log(queryString.length > 500 ? '\n... (続きは省略)' : '');
    console.log(`\n📏 総文字数: ${queryString.length} 文字`);
    
  } catch (error) {
    console.error('❌ クエリの生成に失敗:', error.message);
  }
}

/**
 * クエリの重要な設定値を抽出して表示
 */
function displayQuerySettings(queryKey) {
  const query = AVAILABLE_QUERIES[queryKey];
  if (!query) return;

  try {
    const queryString = query.function();
    
    console.log(`\n⚙️ 重要な設定値:`);
    console.log('─'.repeat(60));
    
    // 日付設定を抽出
    const dateMatches = queryString.match(/DATE\('[\d-]+'\)/g);
    if (dateMatches) {
      console.log(`📅 日付設定: ${[...new Set(dateMatches)].join(', ')}`);
    }
    
    // テーブル名を抽出  
    const tableMatches = queryString.match(/`[^`]+\.[^`]+\.[^`]+`/g);
    if (tableMatches) {
      console.log(`🗂️  使用テーブル:`);
      [...new Set(tableMatches)].forEach(table => {
        console.log(`   - ${table}`);
      });
    }
    
    // WITH句の数を確認
    const withCount = (queryString.match(/\bWITH\b/gi) || []).length;
    const cteCount = (queryString.match(/\w+\s+AS\s*\(/g) || []).length;
    console.log(`🧩 CTE（WITH句）: ${withCount}個のWITH句、${cteCount}個のCTE`);
    
  } catch (error) {
    console.error('❌ 設定値の抽出に失敗:', error.message);
  }
}

/**
 * 利用可能なクエリ一覧を表示
 */
function displayAvailableQueries() {
  console.log('\n📋 利用可能なクエリ一覧:');
  console.log('─'.repeat(60));
  
  Object.keys(AVAILABLE_QUERIES).forEach(key => {
    const query = AVAILABLE_QUERIES[key];
    console.log(`🔸 ${key}`);
    console.log(`   ${query.name}`);
    console.log(`   対象: ${query.graphs.join(', ')}`);
    console.log('');
  });
  
  console.log('使用方法: node query-checker.js [query-name]');
  console.log('例: node query-checker.js souke');
}

/**
 * 全クエリの基本統計を表示
 */
function displayAllQueryStats() {
  console.log('\n📊 全クエリ統計:');
  console.log('─'.repeat(60));
  
  let totalLength = 0;
  let totalCTEs = 0;
  
  Object.keys(AVAILABLE_QUERIES).forEach(key => {
    const query = AVAILABLE_QUERIES[key];
    try {
      const queryString = query.function();
      const cteCount = (queryString.match(/\w+\s+AS\s*\(/g) || []).length;
      
      console.log(`📈 ${key}: ${queryString.length} 文字, ${cteCount} CTEs`);
      
      totalLength += queryString.length;
      totalCTEs += cteCount;
      
    } catch (error) {
      console.log(`❌ ${key}: エラー - ${error.message}`);
    }
  });
  
  console.log('─'.repeat(60));
  console.log(`📏 総計: ${totalLength} 文字, ${totalCTEs} CTEs`);
  console.log(`📦 平均: ${Math.round(totalLength / Object.keys(AVAILABLE_QUERIES).length)} 文字/クエリ`);
}

/**
 * クエリの構文チェック（簡易版）
 */
function validateQuerySyntax(queryKey) {
  const query = AVAILABLE_QUERIES[queryKey];
  if (!query) return;

  console.log(`\n🔍 ${queryKey} の構文チェック:`);
  console.log('─'.repeat(60));

  try {
    const queryString = query.function();
    
    // 基本的な構文チェック
    const checks = [
      {
        name: 'WITH句とCTEの整合性',
        test: () => {
          const withCount = (queryString.match(/\bWITH\b/gi) || []).length;
          const cteCount = (queryString.match(/\w+\s+AS\s*\(/g) || []).length;
          return withCount > 0 && cteCount > 0;
        }
      },
      {
        name: 'SELECT文の存在',
        test: () => queryString.includes('SELECT')
      },
      {
        name: '括弧の対応',
        test: () => {
          const openCount = (queryString.match(/\(/g) || []).length;
          const closeCount = (queryString.match(/\)/g) || []).length;
          return openCount === closeCount;
        }
      },
      {
        name: 'FROM句の存在', 
        test: () => queryString.includes('FROM')
      }
    ];
    
    checks.forEach(check => {
      const result = check.test();
      console.log(`${result ? '✅' : '❌'} ${check.name}: ${result ? 'OK' : 'NG'}`);
    });
    
  } catch (error) {
    console.error('❌ 構文チェック失敗:', error.message);
  }
}

/**
 * メイン処理
 */
function main() {
  const args = process.argv.slice(2);
  const queryKey = args[0];
  const command = args[1] || 'info';
  
  console.log('🔧 BigQuery クエリチェッカー v1.0');
  
  if (!queryKey) {
    displayAvailableQueries();
    return;
  }
  
  if (queryKey === 'all' || queryKey === 'stats') {
    displayAllQueryStats();
    return;
  }
  
  if (!AVAILABLE_QUERIES[queryKey]) {
    console.error(`❌ クエリ "${queryKey}" は存在しません`);
    displayAvailableQueries();
    return;
  }
  
  // 基本情報を常に表示
  displayQueryInfo(queryKey);
  
  // コマンドに応じて詳細表示
  switch (command) {
    case 'preview':
      displayQueryPreview(queryKey);
      break;
    case 'settings':
      displayQuerySettings(queryKey);
      break;
    case 'validate':
      validateQuerySyntax(queryKey);
      break;
    case 'full':
      displayQueryPreview(queryKey);
      displayQuerySettings(queryKey);  
      validateQuerySyntax(queryKey);
      break;
    default:
      displayQuerySettings(queryKey);
  }
  
  console.log('\n💡 その他のコマンド:');
  console.log('   preview  - クエリプレビュー表示');
  console.log('   settings - 重要設定値の抽出');
  console.log('   validate - 構文チェック');
  console.log('   full     - 全情報表示');
  console.log('   all      - 全クエリ統計表示');
}

// コマンドライン実行時のメイン処理
if (require.main === module) {
  main();
}

module.exports = {
  AVAILABLE_QUERIES,
  displayQueryInfo,
  displayQueryPreview,
  displayQuerySettings,
  validateQuerySyntax
};

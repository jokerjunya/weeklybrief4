/**
 * KPIテーブルデータ取得専用 Netlify Function
 * グラフ機能とは完全に独立したテーブルデータAPI
 * 
 * 機能:
 * - 前日比・前週比・前年比のKPI実績データ取得
 * - 流入チャネル別実績データ取得（将来実装）
 * - グラフデータ処理には一切影響しない独立設計
 */

exports.handler = async (event, context) => {
  console.log('📊 KPI Table Data Function - START');
  
  // CORS対応
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Preflightリクエスト対応
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  // GET以外は拒否
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'Method not allowed' 
      })
    };
  }

  // 認証チェック（簡易版）
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('custom-auth-')) {
    console.warn('⚠️ Unauthorized request - missing auth header');
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'Unauthorized' 
      })
    };
  }

  try {
    // 環境変数確認
    console.log('🔍 Environment check...');
    const requiredEnvVars = [
      'GOOGLE_APPLICATION_CREDENTIALS_JSON',
      'GOOGLE_CLOUD_PROJECT'
    ];
    
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        console.error(`❌ Missing environment variable: ${envVar}`);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            success: false, 
            error: `Missing ${envVar}` 
          })
        };
      }
    }

    // 依存関係ロード
    console.log('📦 Loading dependencies...');
    try {
      const { getBigQueryClient } = require('./utils/bigquery-client');
      const { sanitizeForFirestore } = require('./utils/data-processor');
      console.log('✅ Dependencies loaded successfully');
      
      // BigQuery クライアント初期化
      console.log('🔗 Initializing BigQuery client...');
      const bqClient = getBigQueryClient();
      
      // 並行処理で高速化（504タイムアウト回避）
      console.log('⚡ Executing parallel table queries (like update-souke-data.js)...');
      
      const [kpiData, naiteiKpiData, channelsOverview, channelsDetail] = await Promise.all([
        getKpiData(bqClient),
        getNaiteiKpiData(bqClient),
        getChannelOverviewData(bqClient),
        getChannelDetailData(bqClient)
      ]);
      
      if (!kpiData) {
        throw new Error('KPIデータの取得に失敗しました');
      }

      console.log('✅ All table data retrieved successfully:', {
        kpi: !!kpiData,
        channelsOverview: channelsOverview.length,
        channelsDetail: channelsDetail.length
      });

      // テーブルキャッシュ保存はフロントエンドで実行（認証問題回避）
      console.log('💾 Table caching will be handled by frontend (Firebase Client SDK)');

      // レスポンス返却
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: {
            kpi: kpiData,
            naitei_kpi: naiteiKpiData,
            channels_overview: channelsOverview,
            channels_detail: channelsDetail,
            metadata: {
              lastUpdated: new Date().toISOString(),
              dataSource: 'bigquery-table-live',
              type: 'table-data'
            }
          }
        })
      };

    } catch (depError) {
      console.error('❌ Dependency loading error:', depError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Failed to load dependencies' 
        })
      };
    }

  } catch (error) {
    console.error('💥 KPI Table Function Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'KPIテーブルデータの取得中にエラーが発生しました',
        details: error.message
      })
    };
  }
};

/**
 * KPIデータ取得（元のPython get_kpi_data() を移植）
 * 前日比・前週比・前年比の計算ロジック込み
 */
async function getKpiData(bqClient) {
  const query = `
    WITH
    date_analysis AS (
      SELECT 
        -- 実際の最新データ日を動的取得
        (SELECT MAX(first_determine_date) FROM \`dharma-dwh-rag.datamart.t_rag_jobseeker_all\` 
         WHERE first_determine_date >= DATE('2025-08-01') AND first_determine_date <= CURRENT_DATE()) as latest_date,
        
        -- 動的に前日・前週・前年の日付を計算
        DATE_SUB((SELECT MAX(first_determine_date) FROM \`dharma-dwh-rag.datamart.t_rag_jobseeker_all\` 
                  WHERE first_determine_date >= DATE('2025-08-01') AND first_determine_date <= CURRENT_DATE()), INTERVAL 1 DAY) as prev_day,
        
        DATE_SUB((SELECT MAX(first_determine_date) FROM \`dharma-dwh-rag.datamart.t_rag_jobseeker_all\` 
                  WHERE first_determine_date >= DATE('2025-08-01') AND first_determine_date <= CURRENT_DATE()), INTERVAL 7 DAY) as prev_week_day,
        
        DATE_SUB((SELECT MAX(first_determine_date) FROM \`dharma-dwh-rag.datamart.t_rag_jobseeker_all\` 
                  WHERE first_determine_date >= DATE('2025-08-01') AND first_determine_date <= CURRENT_DATE()), INTERVAL 1 YEAR) as prev_year_day
    ),
    
    -- PDT2除外処理
    pdt2_exclusions AS (
      SELECT
        entry_complete_date AS first_determine_date,
        jobseeker_id,
        jobseeker_branch_id,
        1 AS exclude_flg
      FROM \`dharma-dwh-rag.datamart.v_rag_entry_users_for_ro2\`
      WHERE entry_start_type = "pdt1db_to_pdt2_entry_form"
        AND entry_complete_date >= "2025-05-14"
      GROUP BY ALL
    ),
    
    daily_souke AS (
      SELECT 
        r.first_determine_date,
        SUM(CAST(r.acceptance_flag AS INT64)) as daily_souke_count
      FROM \`dharma-dwh-rag.datamart.t_rag_jobseeker_all\` r
        LEFT JOIN pdt2_exclusions excl
          USING(first_determine_date, jobseeker_id, jobseeker_branch_id)
      WHERE r.first_determine_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 400 DAY)
        AND r.first_determine_date IS NOT NULL
        AND excl.exclude_flg IS NULL
      GROUP BY r.first_determine_date
    )
    
    SELECT
      d.latest_date,
      COALESCE(latest.daily_souke_count, 0) as latest_souke,
      COALESCE(prev_day.daily_souke_count, 0) as prev_day_souke,
      COALESCE(prev_week.daily_souke_count, 0) as prev_week_souke,
      COALESCE(prev_year.daily_souke_count, 0) as prev_year_souke,
      
      -- 成長率計算（修正版：正しい計算式）
      CASE 
        WHEN COALESCE(prev_day.daily_souke_count, 0) > 0 THEN
          ROUND(((COALESCE(latest.daily_souke_count, 0) - COALESCE(prev_day.daily_souke_count, 0)) * 100.0) / COALESCE(prev_day.daily_souke_count, 0), 1)
        ELSE NULL
      END as day_growth_rate,
      
      CASE 
        WHEN COALESCE(prev_week.daily_souke_count, 0) > 0 THEN
          ROUND(((COALESCE(latest.daily_souke_count, 0) - COALESCE(prev_week.daily_souke_count, 0)) * 100.0) / COALESCE(prev_week.daily_souke_count, 0), 1)
        ELSE NULL
      END as week_growth_rate,
      
      CASE 
        WHEN COALESCE(prev_year.daily_souke_count, 0) > 0 THEN
          ROUND(((COALESCE(latest.daily_souke_count, 0) - COALESCE(prev_year.daily_souke_count, 0)) * 100.0) / COALESCE(prev_year.daily_souke_count, 0), 1)
        ELSE NULL
      END as year_growth_rate
      
    FROM date_analysis d
    LEFT JOIN daily_souke latest ON d.latest_date = latest.first_determine_date
    LEFT JOIN daily_souke prev_day ON d.prev_day = prev_day.first_determine_date
    LEFT JOIN daily_souke prev_week ON d.prev_week_day = prev_week.first_determine_date
    LEFT JOIN daily_souke prev_year ON d.prev_year_day = prev_year.first_determine_date
  `;

  try {
    const rows = await bqClient.executeQuery(query);
    console.log(`📈 KPI Query returned ${rows.length} rows`);
    
    if (rows.length === 0) {
      console.warn('⚠️ No KPI data found');
      return null;
    }

    // Firestore互換形式に変換
    const { sanitizeForFirestore } = require('./utils/data-processor');
    const sanitizedRows = sanitizeForFirestore(rows);
    
    // 最初の行を取得（1行のみ返されるはず）
    const row = sanitizedRows[0];
    
    console.log('📊 KPI raw data:', row);

    return {
      latest_souke: row.latest_souke || 0,
      prev_day_souke: row.prev_day_souke || 0,
      prev_week_souke: row.prev_week_souke || 0,
      prev_year_souke: row.prev_year_souke || 0,
      latest_date: row.latest_date,
      day_growth_rate: row.day_growth_rate,
      week_growth_rate: row.week_growth_rate,
      year_growth_rate: row.year_growth_rate
    };

  } catch (error) {
    console.error('❌ KPI query execution error:', error);
    throw error;
  }
}

/**
 * チャネル別実績データ取得（大分類版）
 * オーガニック流入・有料広告流入・その他不明の3分類
 */
async function getChannelOverviewData(bqClient) {
  const { getSoukeChannelOverviewQuery } = require('./utils/query-definitions.cjs');
  const query = getSoukeChannelOverviewQuery();

  try {
    const rows = await bqClient.executeQuery(query);
    console.log(`📈 Channel overview query returned ${rows.length} rows`);
    
    if (rows.length === 0) {
      console.warn('⚠️ No channel overview data found');
      return [];
    }

    // Firestore互換形式に変換
    const { sanitizeForFirestore } = require('./utils/data-processor');
    const sanitizedRows = sanitizeForFirestore(rows);
    
    console.log('📊 Channel overview raw data:', sanitizedRows);

    // フォーマット変換
    return sanitizedRows.map(row => ({
      channel_category: row.channel_category || 'その他・不明',
      latest_souke: row.latest_souke || 0,
      prev_day_souke: row.prev_day_souke || 0,
      prev_week_souke: row.prev_week_souke || 0,
      prev_year_souke: row.prev_year_souke || 0,
      share_pct: row.share_pct || 0,
      day_growth_rate: row.day_growth_rate,
      week_growth_rate: row.week_growth_rate,
      year_growth_rate: row.year_growth_rate
    }));

  } catch (error) {
    console.error('❌ Channel overview query execution error:', error);
    throw error;
  }
}

/**
 * チャネル別実績データ取得（詳細分類版）
 * リスティング_指名/非指名・SEO_TOP/TOP以外・Indeed・アフィリエイト等の詳細分類
 */
async function getChannelDetailData(bqClient) {
  const { getSoukeChannelDetailQuery } = require('./utils/query-definitions.cjs');
  const query = getSoukeChannelDetailQuery();

  try {
    const rows = await bqClient.executeQuery(query);
    console.log(`📈 Channel detail query returned ${rows.length} rows`);
    
    if (rows.length === 0) {
      console.warn('⚠️ No channel detail data found');
      return [];
    }

    // Firestore互換形式に変換
    const { sanitizeForFirestore } = require('./utils/data-processor');
    const sanitizedRows = sanitizeForFirestore(rows);
    
    console.log('📊 Channel detail raw data:', sanitizedRows);

    // フォーマット変換
    return sanitizedRows.map(row => ({
      channel_category: row.channel_category || 'その他・不明',
      parent_category: row.parent_category || 'その他・不明',
      latest_souke: row.latest_souke || 0,
      prev_day_souke: row.prev_day_souke || 0,
      prev_week_souke: row.prev_week_souke || 0,
      prev_year_souke: row.prev_year_souke || 0,
      share_pct: row.share_pct || 0,
      day_growth_rate: row.day_growth_rate,
      week_growth_rate: row.week_growth_rate,
      year_growth_rate: row.year_growth_rate
    }));

  } catch (error) {
    console.error('❌ Channel detail query execution error:', error);
    throw error;
  }
}

/**
 * 内定数KPIデータ取得（getKpiDataの内定数版）
 * 前日比・前週比・前年比の計算ロジック込み
 */
async function getNaiteiKpiData(bqClient) {
  const { getNaiteiKpiDataQuery } = require('./utils/query-definitions.cjs');
  const query = getNaiteiKpiDataQuery();

  try {
    const rows = await bqClient.executeQuery(query);
    console.log(`📈 Naitei KPI Query returned ${rows.length} rows`);
    
    if (rows.length === 0) {
      console.warn('⚠️ No Naitei KPI data found');
      return null;
    }

    // Firestore互換形式に変換
    const { sanitizeForFirestore } = require('./utils/data-processor');
    const sanitizedRows = sanitizeForFirestore(rows);
    
    // 最初の行を取得（1行のみ返されるはず）
    const row = sanitizedRows[0];
    
    console.log('📊 Naitei KPI raw data:', row);

    return {
      latest_naitei: row.latest_naitei || 0,
      prev_day_naitei: row.prev_day_naitei || 0,
      prev_week_naitei: row.prev_week_naitei || 0,
      prev_year_naitei: row.prev_year_naitei || 0,
      latest_date: row.latest_date,
      day_growth_rate: row.day_growth_rate,
      week_growth_rate: row.week_growth_rate,
      year_growth_rate: row.year_growth_rate
    };

  } catch (error) {
    console.error('❌ Naitei KPI query execution error:', error);
    throw error;
  }
}

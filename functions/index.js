/**
 * Firebase Functions API for KPI Dashboard
 * Firebase Hosting → Firebase Functions → BigQuery構成
 * 
 * 機能:
 * - Firebase Auth IDトークン検証
 * - BigQueryクエリ実行 (asia-northeast1統一)
 * - Dry-run見積による課金制御
 * - パラメータ検証 (日付・BUホワイトリスト)
 */

const {onRequest} = require("firebase-functions/v2/https");
const {setGlobalOptions} = require("firebase-functions/v2");
const {logger} = require("firebase-functions");
const admin = require("firebase-admin");
const {BigQuery} = require("@google-cloud/bigquery");
const cors = require("cors")({origin: true});

// Global options for cost control
setGlobalOptions({
  maxInstances: 10,
  region: "asia-northeast1" // リージョン統一
});

// Firebase Admin初期化
if (!admin.apps.length) {
  admin.initializeApp();
}

// BigQuery クライアント初期化 (asia-northeast1統一)
const bigquery = new BigQuery({
  projectId: process.env.GCLOUD_PROJECT,
  location: 'asia-northeast1'
});

// BUホワイトリスト定義
const VALID_BUSINESS_UNITS = [
  'ALL',           // 全BU対象
  'ENGINEER',      // エンジニア採用
  'SALES',         // 営業採用
  'CORPORATE',     // コーポレート
  'CS',            // カスタマーサクセス
  'MARKETING'      // マーケティング
];

// 日付妥当性検証 (YYYY-MM-DD)
const validateDate = (dateString) => {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    return false;
  }
  
  const date = new Date(dateString);
  const inputDate = dateString.split('-');
  
  // 実際の日付として有効かチェック
  return date.getFullYear() === parseInt(inputDate[0]) &&
         date.getMonth() === parseInt(inputDate[1]) - 1 &&
         date.getDate() === parseInt(inputDate[2]);
};

// パラメータ検証
const validateParameters = (start, end, bu) => {
  const errors = [];
  
  // 日付検証
  if (!start || !validateDate(start)) {
    errors.push('start must be a valid date in YYYY-MM-DD format');
  }
  if (!end || !validateDate(end)) {
    errors.push('end must be a valid date in YYYY-MM-DD format');
  }
  
  // 日付順序チェック
  if (start && end && validateDate(start) && validateDate(end)) {
    if (new Date(start) > new Date(end)) {
      errors.push('start date must be before or equal to end date');
    }
  }
  
  // BU検証
  if (!bu || !VALID_BUSINESS_UNITS.includes(bu.toUpperCase())) {
    errors.push(`bu must be one of: ${VALID_BUSINESS_UNITS.join(', ')}`);
  }
  
  return errors;
};

// Firebase Auth IDトークン検証
const verifyIdToken = async (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }

  const idToken = authHeader.substring(7); // "Bearer " を除去
  
  // Firebase Admin SDKでトークン検証
  const decodedToken = await admin.auth().verifyIdToken(idToken, true);
  
  return decodedToken;
};

// BigQuery Dry-run見積実行
const estimateQueryCost = async (query) => {
  try {
    const [job] = await bigquery.createQueryJob({
      query: query,
      location: 'asia-northeast1',
      dryRun: true // Dry-run有効
    });
    
    const bytesProcessed = parseInt(job.metadata.statistics.totalBytesProcessed || '0');
    const gbProcessed = bytesProcessed / (1024 * 1024 * 1024);
    
    logger.info(`Query dry-run estimate: ${gbProcessed.toFixed(2)} GB`);
    
    return {
      bytesProcessed,
      gbProcessed,
      exceedsLimit: gbProcessed > 5.0 // 5GB閾値
    };
    
  } catch (error) {
    logger.error('Dry-run estimation failed:', error);
    throw new Error(`Query estimation failed: ${error.message}`);
  }
};

// KPI BigQueryクエリ生成（サーバー固定SQL）
const buildKpiQuery = (start, end, bu) => {
  // BU条件構築
  let buCondition = '';
  if (bu.toUpperCase() !== 'ALL') {
    buCondition = `AND business_unit = '${bu.toUpperCase()}'`;
  }
  
  return `
    WITH
    date_range AS (
      SELECT 
        DATE('${start}') as start_date,
        DATE('${end}') as end_date
    ),
    
    -- PDT2除外処理（既存ロジックを維持）
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
    
    daily_kpi AS (
      SELECT 
        r.first_determine_date,
        CASE 
          WHEN '${bu.toUpperCase()}' = 'ALL' THEN 'ALL'
          ELSE r.business_unit
        END as business_unit,
        SUM(CAST(r.acceptance_flag AS INT64)) as daily_count,
        COUNT(*) as total_applications
      FROM \`dharma-dwh-rag.datamart.t_rag_jobseeker_all\` r
        LEFT JOIN pdt2_exclusions excl
          USING(first_determine_date, jobseeker_id, jobseeker_branch_id)
        CROSS JOIN date_range dr
      WHERE r.first_determine_date >= dr.start_date
        AND r.first_determine_date <= dr.end_date
        AND r.first_determine_date IS NOT NULL
        AND excl.exclude_flg IS NULL
        ${buCondition}
      GROUP BY r.first_determine_date, business_unit
    )
    
    SELECT
      business_unit,
      first_determine_date,
      daily_count,
      total_applications,
      -- 累積KPI
      SUM(daily_count) OVER (
        PARTITION BY business_unit 
        ORDER BY first_determine_date 
        ROWS UNBOUNDED PRECEDING
      ) as cumulative_count
      
    FROM daily_kpi
    ORDER BY business_unit, first_determine_date
  `;
};

// メインAPIエンドポイント
exports.runKpi = onRequest(async (req, res) => {
  return cors(req, res, async () => {
    const startTime = Date.now();
    
    // 構造化ログ出力
    logger.info('🚀 Firebase Functions /runKpi START', {
      method: req.method,
      params: req.body,
      timestamp: new Date().toISOString()
    });
    
    try {
      // POST以外は拒否
      if (req.method !== 'POST') {
        res.status(405).json({
          success: false,
          error: 'Method not allowed'
        });
        return;
      }
      
      // Firebase Auth IDトークン検証
      const user = await verifyIdToken(req);
      logger.info('✅ Authentication successful', {user: user.uid});
      
      const {start, end, bu} = req.body;
      
      // パラメータ検証
      const validationErrors = validateParameters(start, end, bu);
      if (validationErrors.length > 0) {
        res.status(400).json({
          success: false,
          error: 'Parameter validation failed',
          details: validationErrors
        });
        return;
      }
      
      // クエリ生成
      const query = buildKpiQuery(start, end, bu);
      
      // Dry-run見積実行
      const estimate = await estimateQueryCost(query);
      
      // 5GB閾値チェック
      if (estimate.exceedsLimit) {
        logger.warn('Query exceeds 5GB limit:', estimate);
        res.status(413).json({
          success: false,
          error: 'Query exceeds maximum scan limit (5GB)',
          estimated_gb: estimate.gbProcessed,
          limit_gb: 5.0
        });
        return;
      }
      
      // 実際のクエリ実行
      logger.info('📊 Executing BigQuery with cost controls...');
      const [job] = await bigquery.createQueryJob({
        query: query,
        location: 'asia-northeast1',
        maximumBytesBilled: 5 * 1024 * 1024 * 1024, // 5GB制限
        jobTimeoutMs: 60000, // 60秒タイムアウト
        labels: {
          app: 'exec-dashboard',
          env: 'prod',
          user: user.uid.substring(0, 8) // ユーザー識別用
        }
      });
      
      const [rows] = await job.getQueryResults();
      const duration = Date.now() - startTime;
      
      // 成功ログ
      logger.info('✅ Firebase Functions /runKpi SUCCESS', {
        duration_ms: duration,
        rows_returned: rows.length,
        job_id: job.id,
        bytes_processed: job.metadata.statistics.totalBytesProcessed
      });
      
      // レスポンス返却
      res.json({
        success: true,
        data: rows,
        metadata: {
          query_duration_ms: duration,
          rows_count: rows.length,
          job_id: job.id,
          bytes_processed: parseInt(job.metadata.statistics.totalBytesProcessed || '0'),
          estimated_gb: estimate.gbProcessed
        }
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // エラーログ
      logger.error('❌ Firebase Functions /runKpi ERROR', {
        duration_ms: duration,
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  });
});

// ヘルスチェックエンドポイント
exports.health = onRequest((req, res) => {
  cors(req, res, () => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'kpi-dashboard-functions-api'
    });
  });
});
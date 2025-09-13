/**
 * Cloud Run API for KPI Dashboard
 * Firebase Hosting → Cloud Run → BigQuery構成
 * 
 * 機能:
 * - Firebase Auth IDトークン検証 (firebase-admin)
 * - BigQueryクエリ実行 (asia-northeast1統一)
 * - Dry-run見積による課金制御
 * - パラメータ検証 (日付・BUホワイトリスト)
 */

const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const { BigQuery } = require('@google-cloud/bigquery');

// Express app初期化
const app = express();

// ミドルウェア設定
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());

// Firebase Admin初期化
const initializeFirebaseAdmin = () => {
  if (!admin.apps.length) {
    // Cloud Runの環境変数からFirebaseサービスアカウントキー取得
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is required');
    }

    const serviceAccount = JSON.parse(serviceAccountKey);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID
    });
    
    console.log('✅ Firebase Admin initialized');
  }
};

// BigQuery クライアント初期化 (asia-northeast1統一)
const initializeBigQuery = () => {
  const bqCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!bqCredentials) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable is required');
  }

  const credentials = JSON.parse(bqCredentials);
  
  return new BigQuery({
    projectId: process.env.GOOGLE_CLOUD_PROJECT || 'dharma-dwh-rag',
    credentials: credentials,
    location: 'asia-northeast1' // リージョン統一
  });
};

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

// Firebase Auth IDトークン検証ミドルウェア
const verifyIdToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid Authorization header'
      });
    }

    const idToken = authHeader.substring(7); // "Bearer " を除去
    
    // Firebase Admin SDKでトークン検証
    const decodedToken = await admin.auth().verifyIdToken(idToken, true);
    
    // audience検証 (Firebase Project ID)
    const expectedAudience = process.env.FIREBASE_PROJECT_ID;
    if (decodedToken.aud !== expectedAudience) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token audience'
      });
    }
    
    req.user = decodedToken;
    next();
    
  } catch (error) {
    console.error('❌ Token verification failed:', error.message);
    return res.status(401).json({
      success: false,
      error: 'Invalid ID token'
    });
  }
};

// BigQuery Dry-run見積実行
const estimateQueryCost = async (bqClient, query) => {
  try {
    const [job] = await bqClient.createQueryJob({
      query: query,
      location: 'asia-northeast1',
      dryRun: true // Dry-run有効
    });
    
    const bytesProcessed = parseInt(job.metadata.statistics.totalBytesProcessed || '0');
    const gbProcessed = bytesProcessed / (1024 * 1024 * 1024);
    
    console.log(`📊 Query dry-run estimate: ${gbProcessed.toFixed(2)} GB`);
    
    return {
      bytesProcessed,
      gbProcessed,
      exceedsLimit: gbProcessed > 5.0 // 5GB閾値
    };
    
  } catch (error) {
    console.error('❌ Dry-run estimation failed:', error);
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
app.post('/api/run-kpi', verifyIdToken, async (req, res) => {
  const startTime = Date.now();
  
  // 構造化ログ出力
  console.log('🚀 POST /api/run-kpi START', {
    timestamp: new Date().toISOString(),
    user: req.user.uid,
    params: req.body
  });
  
  try {
    const { start, end, bu } = req.body;
    
    // パラメータ検証
    const validationErrors = validateParameters(start, end, bu);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Parameter validation failed',
        details: validationErrors
      });
    }
    
    // BigQueryクライアント初期化
    const bqClient = initializeBigQuery();
    
    // クエリ生成
    const query = buildKpiQuery(start, end, bu);
    
    // Dry-run見積実行
    const estimate = await estimateQueryCost(bqClient, query);
    
    // 5GB閾値チェック
    if (estimate.exceedsLimit) {
      console.warn('⚠️ Query exceeds 5GB limit:', estimate);
      return res.status(413).json({
        success: false,
        error: 'Query exceeds maximum scan limit (5GB)',
        estimated_gb: estimate.gbProcessed,
        limit_gb: 5.0
      });
    }
    
    // 実際のクエリ実行
    console.log('📊 Executing BigQuery with cost controls...');
    const [job] = await bqClient.createQueryJob({
      query: query,
      location: 'asia-northeast1',
      maximumBytesBilled: 5 * 1024 * 1024 * 1024, // 5GB制限
      jobTimeoutMs: 60000, // 60秒タイムアウト
      labels: {
        app: 'exec-dashboard',
        env: 'prod',
        user: req.user.uid.substring(0, 8) // ユーザー識別用
      }
    });
    
    const [rows] = await job.getQueryResults();
    const duration = Date.now() - startTime;
    
    // 成功ログ
    console.log('✅ POST /api/run-kpi SUCCESS', {
      timestamp: new Date().toISOString(),
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
    console.error('❌ POST /api/run-kpi ERROR', {
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      error: error.message,
      user: req.user?.uid
    });
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// ヘルスチェックエンドポイント
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'kpi-dashboard-api'
  });
});

// サーバー起動
const port = process.env.PORT || 8080;

// 初期化処理
const startServer = async () => {
  try {
    // Firebase Admin初期化
    initializeFirebaseAdmin();
    
    // サーバー起動
    app.listen(port, '0.0.0.0', () => {
      console.log(`🚀 KPI Dashboard API server running on port ${port}`);
      console.log('📋 Environment:', {
        NODE_ENV: process.env.NODE_ENV,
        FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
        GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT
      });
    });
    
  } catch (error) {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  }
};

startServer();

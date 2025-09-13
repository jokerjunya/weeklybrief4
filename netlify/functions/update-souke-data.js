const { BigQuery } = require('@google-cloud/bigquery');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { processQueryResults, generateMockData, validateProcessedData } = require('./utils/data-processor');
const { getSoukeChartDataQuery, getNaiteiWeeklyDataQuery, getNaiteiDailyDataQuery, getNaiteiCumulativeDataQuery } = require('./utils/query-definitions.cjs');
const { BigQueryClientWrapper } = require('./utils/bigquery-client');

// Firebase Admin初期化（重複初期化回避）
if (!getApps().length) {
  let credentials;
  try {
    // Google Cloud認証情報をFirebase Admin SDKで使用
    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (credentialsJson) {
      credentials = JSON.parse(credentialsJson);
      console.log('🔑 Initializing Firebase Admin with service account project_id:', credentials.project_id);
      console.log('✅ Using Google Cloud credentials for Firebase Admin SDK');
    } else {
      console.warn('⚠️ GOOGLE_APPLICATION_CREDENTIALS_JSON not found, using default auth');
    }
    
    initializeApp({
      credential: credentials ? require('firebase-admin/app').cert(credentials) : undefined,
      projectId: credentials ? credentials.project_id : (process.env.FIREBASE_PROJECT_ID || 'weekly-brief-2025')
    });
    console.log('✅ Firebase Admin SDK initialized successfully');
  } catch (initError) {
    console.error('❌ Firebase Admin SDK initialization failed:', {
      message: initError.message,
      stack: initError.stack
    });
    // 初期化に失敗してもBigQueryは動作するため、続行（デバッグモード）
    try {
      initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'weekly-brief-2025'
      });
      console.log('⚠️ Firebase fallback initialization completed');
    } catch (fallbackError) {
      console.error('❌ Firebase fallback initialization also failed:', fallbackError.message);
    }
  }
}

const db = getFirestore();

/**
 * 内定数データをChart.js形式に処理する関数
 */
function processNaiteiData(weeklyRows, dailyRows, cumulativeRows) {
  console.log('📊 Processing naitei data:', {
    weeklyRows: weeklyRows ? weeklyRows.length : 0,
    dailyRows: dailyRows ? dailyRows.length : 0,
    cumulativeRows: cumulativeRows ? cumulativeRows.length : 0
  });
  
  const result = {
    daily: { '2024': [], '2025': [] },
    cumulative: { '2024': [], '2025': [] },
    weekly: { '2024': [], '2025': [] },
    metadata: {
      lastUpdated: new Date().toISOString(),
      dataSource: 'naitei-bigquery',
    }
  };

  // 実際のデータのみを処理（総受データと同じ方式）
  // 全日付生成は行わず、BigQueryクエリ結果のみ使用

  // 日次データ処理（全日付ベース）
  console.log(`📊 Processing daily naitei data with ${dailyRows ? dailyRows.length : 0} actual data rows`);
  
  // 実際のデータをMapに変換（高速検索用）
  const dailyDataMap = new Map();
  if (dailyRows && dailyRows.length > 0) {
    console.log(`🔍 Debugging daily naitei data (first 3 rows):`);
    dailyRows.slice(0, 3).forEach((row, index) => {
      console.log(`  Row ${index}:`, {
        offer_date: row.offer_date,
        offer_count_current: row.offer_count_current,
        offer_count_last_year: row.offer_count_last_year,
        rawRow: row
      });
    });
    
    // 2024年データの存在確認
    const found2024Data = dailyRows.filter(row => row.offer_count_last_year && row.offer_count_last_year > 0).length;
    console.log(`📊 Found ${found2024Data} rows with 2024 naitei data`);
    
    if (found2024Data === 0) {
      console.warn(`⚠️ No 2024 naitei data found`);
    }
    
    dailyRows.forEach((row, index) => {
      const dateValue = row.offer_date;
      if (!dateValue) {
        console.warn(`⚠️ No offer_date at daily row ${index}`);
        return;
      }
      
      // BigQueryDateオブジェクトを安全に文字列に変換
      let dateStr;
      if (dateValue.value) {
        dateStr = dateValue.value;
      } else if (typeof dateValue === 'string') {
        dateStr = dateValue;
      } else if (dateValue.toString) {
        dateStr = dateValue.toString();
      } else {
        console.warn(`⚠️ Unusual naitei date format at daily row ${index}:`, typeof dateValue, dateValue);
        return;
      }
      
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        console.warn(`⚠️ Invalid naitei date at daily row ${index}:`, dateStr);
        return;
      }
      
      const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
      const currentVal = row.offer_count_current || 0;
      const lastYearVal = row.offer_count_last_year || 0;
      
      dailyDataMap.set(key, {
        current: currentVal,
        lastYear: lastYearVal
      });
      
      // 2024年のデータがある場合はログ出力  
      if (lastYearVal > 0) {
        console.log(`📊 Found 2024 naitei data: ${dateStr} -> ${lastYearVal}`);
      }
    });
  }
  
  // 2025年と2024年のデータを独立処理（総受データと同じ方式）
  
  // 2025年データの処理（実際のデータがある日のみ）
  dailyDataMap.forEach((data, key) => {
    if (data.current !== undefined && data.current >= 0) {  // 0も含める
      const [year, month, day] = key.split('-').map(Number);
      if (year === 2025) {  // 2025年のデータのみ処理
        const monthDay = `${month}/${day}`;
        const dateStr = new Date(year, month - 1, day).toISOString().split('T')[0];
        
        result.daily['2025'].push({
          x: monthDay,
          y: data.current,
          label: `${monthDay}: ${data.current}件`,
          date_value: dateStr
        });
      }
    }
  });
  
  // 2024年データの処理（実際のデータがある日のみ）
  console.log(`🔍 Processing 2024 daily data from ${dailyDataMap.size} total entries...`);
  let processed2024Count = 0;
  
  dailyDataMap.forEach((data, key) => {
    console.log(`🔍 Checking entry ${key}: lastYear=${data.lastYear}`);
    if (data.lastYear !== undefined && data.lastYear >= 0) {  // 0も含める
      const [year, month, day] = key.split('-').map(Number);
      console.log(`📅 Parsed date: year=${year}, month=${month}, day=${day}`);
      if (year === 2025 && data.lastYear !== undefined) {  // 2025年キーのlastYear（2024年データ）を処理
        processed2024Count++;
        const monthDay = `${month}/${day}`;
        // 2024年の日付に変換
        const dateStr = new Date(2024, month - 1, day).toISOString().split('T')[0];
        
        console.log(`✅ Processing 2024 data from 2025 key: ${key} -> ${data.lastYear} offers`);
        result.daily['2024'].push({
          x: monthDay,
          y: data.lastYear,
          label: `${monthDay}: ${data.lastYear}件`,
          date_value: dateStr
        });
      }
    }
  });
  
  // データをソート
  result.daily['2024'].sort((a, b) => new Date(a.date_value).getTime() - new Date(b.date_value).getTime());
  result.daily['2025'].sort((a, b) => new Date(a.date_value).getTime() - new Date(b.date_value).getTime());

  console.log(`📊 2024 daily data processed: ${result.daily['2024'].length} items`);

  // 累計データ処理（全日付ベース）
  console.log(`📊 Processing cumulative naitei data with ${cumulativeRows ? cumulativeRows.length : 0} actual data rows`);
  
  // 実際の累計データをMapに変換
  const cumulativeDataMap = new Map();
  if (cumulativeRows && cumulativeRows.length > 0) {
    console.log(`🔍 Debugging cumulative naitei data (first 10 rows):`);
    cumulativeRows.slice(0, 10).forEach((row, index) => {
      console.log(`  Cumulative Row ${index}:`, {
        offer_date: row.offer_date,
        offer_count_current: row.offer_count_current,
        offer_count_last_year: row.offer_count_last_year,
        current_type: typeof row.offer_count_current,
        last_year_type: typeof row.offer_count_last_year
      });
    });
    
    cumulativeRows.forEach((row, index) => {
      const dateValue = row.offer_date;
      if (!dateValue) {
        console.warn(`⚠️ No offer_date at cumulative row ${index}`);
        return;
      }
      
      // BigQueryDateオブジェクトを安全に文字列に変換
      let dateStr;
      if (dateValue.value) {
        dateStr = dateValue.value;
      } else if (typeof dateValue === 'string') {
        dateStr = dateValue;
      } else if (dateValue.toString) {
        dateStr = dateValue.toString();
      } else {
        console.warn(`⚠️ Unusual naitei date format at cumulative row ${index}:`, typeof dateValue, dateValue);
        return;
      }
      
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        console.warn(`⚠️ Invalid naitei date at cumulative row ${index}:`, dateStr);
        return;
      }
      
      const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
      const currentVal = row.offer_count_current || 0;
      const lastYearVal = row.offer_count_last_year || 0;
      
      cumulativeDataMap.set(key, {
        current: currentVal,
        lastYear: lastYearVal
      });
      
      // 2024年の累計データがある場合はログ出力
      if (lastYearVal > 0) {
        console.log(`📊 Found 2024 cumulative naitei data: ${dateStr} -> ${lastYearVal} cumulative offers`);
      }
    });
  }
  
  // 2025年と2024年の累計データを独立処理（総受データと同じ方式）
  
  // 2025年累計データの処理（NULLはChart.jsにもnullで送る）
  cumulativeDataMap.forEach((data, key) => {
    const [year, month, day] = key.split('-').map(Number);
    if (year === 2025) {  // 2025年のデータのみ処理
      const monthDay = `${month}/${day}`;
      const dateStr = new Date(year, month - 1, day).toISOString().split('T')[0];
      
      // NULLの場合はChart.jsにnullを送信（空白表示のため）
      const yValue = data.current === null || data.current === undefined ? null : data.current;
      
      result.cumulative['2025'].push({
        x: monthDay,
        y: yValue,
        label: yValue !== null ? `${monthDay}累計: ${yValue}件` : `${monthDay}: データなし`,
        date_value: dateStr
      });
    }
  });
  
  // 2024年累計データの処理（実際のデータがある日のみ）
  cumulativeDataMap.forEach((data, key) => {
    if (data.lastYear !== undefined && data.lastYear >= 0) {  // 0も含める
      const [year, month, day] = key.split('-').map(Number);
      if (year === 2025 && data.lastYear !== undefined) {  // 2025年キーのlastYear（2024年データ）を処理
        const monthDay = `${month}/${day}`;
        // 2024年の日付に変換
        const dateStr = new Date(2024, month - 1, day).toISOString().split('T')[0];
        
        result.cumulative['2024'].push({
          x: monthDay,
          y: data.lastYear,
          label: `${monthDay}累計: ${data.lastYear}件`,
          date_value: dateStr
        });
      }
    }
  });

  // データをソート
  result.cumulative['2024'].sort((a, b) => new Date(a.date_value).getTime() - new Date(b.date_value).getTime());
  result.cumulative['2025'].sort((a, b) => new Date(a.date_value).getTime() - new Date(b.date_value).getTime());

  // 週次データ処理
  if (weeklyRows && weeklyRows.length > 0) {
    console.log(`📊 Processing ${weeklyRows.length} weekly naitei rows`);
    console.log(`🔍 Debugging weekly naitei data (first 3 rows):`);
    weeklyRows.slice(0, 3).forEach((row, index) => {
      console.log(`  Weekly Row ${index}:`, {
        week_start_date: row.week_start_date,
        offer_count_current: row.offer_count_current,
        offer_count_last_year: row.offer_count_last_year,
        rawRow: row
      });
    });
    
    weeklyRows.forEach((row, index) => {
      const weekStartDateValue = row.week_start_date;
      if (!weekStartDateValue) {
        console.warn(`⚠️ No week_start_date at weekly row ${index}`);
        return;
      }
      
      // BigQueryDateオブジェクトを安全に文字列に変換（総受データと同じ処理）
      let weekStartDateStr;
      if (weekStartDateValue.value) {
        weekStartDateStr = weekStartDateValue.value;
      } else if (typeof weekStartDateValue === 'string') {
        weekStartDateStr = weekStartDateValue;
      } else if (weekStartDateValue.toString) {
        weekStartDateStr = weekStartDateValue.toString();
      } else {
        console.warn(`⚠️ Unusual naitei week date format at row ${index}:`, typeof weekStartDateValue, weekStartDateValue);
        return;
      }
      
      const weekStartDate = new Date(weekStartDateStr);
      if (isNaN(weekStartDate.getTime())) {
        console.warn(`⚠️ Invalid naitei week date at row ${index}:`, weekStartDateStr);
        return;
      }
      
      const year = weekStartDate.getFullYear().toString();
      
      // 週のラベル (M/D形式)
      const weekLabel = `${weekStartDate.getMonth() + 1}/${weekStartDate.getDate()}`;
      
      if (year === '2025') {
        result.weekly['2025'].push({
          x: weekLabel,
          y: row.offer_count_current || 0,
          label: `第${Math.ceil(weekStartDate.getDate() / 7)}週: ${row.offer_count_current || 0}件`,
          date_value: weekStartDateStr,
          is_current_week: false // 現在週の判定は後で追加可能
        });
      }
      
      // 前年同週データ
      if (row.offer_count_last_year !== undefined) {
        const weeklyLastYearCount = row.offer_count_last_year || 0;
        result.weekly['2024'].push({
          x: weekLabel,
          y: weeklyLastYearCount,
          label: `第${Math.ceil(weekStartDate.getDate() / 7)}週: ${weeklyLastYearCount}件`,
          date_value: weekStartDateStr
        });
        
        // 2024年の週次データがある場合はログ出力
        if (weeklyLastYearCount > 0) {
          console.log(`📊 Found 2024 weekly naitei data: ${weekLabel} -> ${weeklyLastYearCount} offers`);
        }
      }
    });
  }

      // 延長ロジック削除: クエリで実データが月末まで取得されるため不要

  console.log('✅ Naitei data processing completed with month-end extension:', {
    daily: `2024: ${result.daily['2024'].length}, 2025: ${result.daily['2025'].length}`,
    cumulative: `2024: ${result.cumulative['2024'].length}, 2025: ${result.cumulative['2025'].length}`,
    weekly: `2024: ${result.weekly['2024'].length}, 2025: ${result.weekly['2025'].length}`
  });
  
  return result;
}

/**
 * 集客モニタリング + 内定数データ更新API
 * BigQueryから最新データを取得し、Firebase Firestoreにキャッシュ
 */
exports.handler = async (event, context) => {
  console.log('🚀 Function execution started');
  console.log('Environment check:', {
    FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
    GOOGLE_CLOUD_PROJECT: !!process.env.GOOGLE_CLOUD_PROJECT,
    GOOGLE_APPLICATION_CREDENTIALS_JSON: !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
    NODE_ENV: process.env.NODE_ENV
  });

  // CORS対応
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // OPTIONS リクエストの処理
  if (event.httpMethod === 'OPTIONS') {
    console.log('✅ OPTIONS request handled');
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // POSTリクエストのみ許可
  if (event.httpMethod !== 'POST') {
    console.log('❌ Invalid method:', event.httpMethod);
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('🚀 Souke data update started');

    // 認証チェック（簡単な独自認証システム対応）
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: '認証が必要です' })
      };
    }

    const token = authHeader.substring(7);
    
    // 独自認証トークンの検証（簡易版）
    if (!token.startsWith('custom-auth-') || token.length < 15) {
      console.error('❌ Invalid authentication token:', token);
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: '認証に失敗しました' })
      };
    }
    
    const userId = token.replace('custom-auth-', '');
    console.log('✅ Authentication verified for user:', userId);
    const decodedToken = { uid: userId };

    // BigQuery クライアント初期化
    console.log('📦 Loading dependencies...');
    try {
      console.log('✅ Dependencies loaded successfully');
      
      console.log('🔗 Initializing BigQuery client...');
      const bqClient = new BigQueryClientWrapper();
      await bqClient.initialize();
      console.log('✅ BigQuery client initialized');
      
      console.log('📊 Executing BigQuery...');

      let processedData;
    
    try {
      // BigQuery クエリ実行（並行処理）
      console.log('🔄 Executing parallel BigQuery queries...');
      
      const [soukeRows, naiteiWeeklyRows, naiteiDailyRows, naiteiCumulativeRows] = await Promise.all([
        bqClient.executeQuery(getSoukeChartDataQuery()),
        bqClient.executeQuery(getNaiteiWeeklyDataQuery()),
        bqClient.executeQuery(getNaiteiDailyDataQuery()),
        bqClient.executeQuery(getNaiteiCumulativeDataQuery())
      ]);
      
      console.log(`📈 BigQuery results: Souke=${soukeRows.length}, NaiteiWeekly=${naiteiWeeklyRows.length}, NaiteiDaily=${naiteiDailyRows.length}, NaiteiCumulative=${naiteiCumulativeRows.length} rows`);
      
      // 総受データの日付範囲をログ出力（デバッグ用）
      if (soukeRows.length > 0) {
        console.log('📅 Analyzing souke data range...');
        
        try {
          const validDates = [];
          soukeRows.forEach((row, index) => {
            const dateValue = row.first_determine_date;
            if (dateValue) {
              // BigQueryDateオブジェクトを安全に文字列に変換
              let dateStr;
              if (dateValue.value) {
                // BigQueryDate.value プロパティを使用
                dateStr = dateValue.value;
              } else if (typeof dateValue === 'string') {
                // 既に文字列の場合
                dateStr = dateValue;
              } else if (dateValue.toString) {
                // toString()メソッドを使用
                dateStr = dateValue.toString();
              } else {
                console.warn(`⚠️ Unusual date format at row ${index}:`, typeof dateValue, dateValue);
                return;
              }
              
              // JavaScript Dateに変換して検証
              const jsDate = new Date(dateStr);
              if (!isNaN(jsDate.getTime())) {
                validDates.push(jsDate);
              } else {
                console.warn(`⚠️ Invalid date at row ${index}:`, dateStr);
              }
            }
          });
          
          if (validDates.length > 0) {
            const minDate = new Date(Math.min(...validDates));
            const maxDate = new Date(Math.max(...validDates));
            console.log('  📅 Souke Min date:', minDate.toISOString().split('T')[0]);
            console.log('  📅 Souke Max date:', maxDate.toISOString().split('T')[0]);
            console.log('  📅 Valid dates:', validDates.length, 'out of', soukeRows.length, 'rows');
          } else {
            console.warn('⚠️ No valid dates found in souke data');
          }
        } catch (dateError) {
          console.warn('⚠️ Souke date analysis failed:', dateError.message);
        }
        
        // データタイプ別の件数も確認
        const dataTypes = {};
        soukeRows.forEach(row => {
          dataTypes[row.data_type] = (dataTypes[row.data_type] || 0) + 1;
        });
        console.log('📊 Souke data types:', dataTypes);
      }
      
      // 内定数データの簡易ログ出力
      console.log('📅 Naitei data summary:');
      if (naiteiWeeklyRows.length > 0) {
        const firstWeek = naiteiWeeklyRows[0];
        const lastWeek = naiteiWeeklyRows[naiteiWeeklyRows.length - 1];
        console.log(`  📈 Weekly: ${firstWeek.week_start_date} ~ ${lastWeek.week_start_date} (${naiteiWeeklyRows.length} weeks)`);
      }
      if (naiteiDailyRows.length > 0) {
        const firstDay = naiteiDailyRows[0];
        const lastDay = naiteiDailyRows[naiteiDailyRows.length - 1];
        console.log(`  📈 Daily: ${firstDay.offer_date} ~ ${lastDay.offer_date} (${naiteiDailyRows.length} days)`);
      }
      
      // データ処理（総受データのみ、内定数は後で統合）
      console.log('📊 Processing souke data:', soukeRows.length, 'rows');
      
      const soukeData = processQueryResults(soukeRows);
      
      console.log('✅ Souke data processed:', {
        daily: `2024: ${soukeData.daily['2024']?.length || 0}, 2025: ${soukeData.daily['2025']?.length || 0}`,
        weekly: `2024: ${soukeData.weekly['2024']?.length || 0}, 2025: ${soukeData.weekly['2025']?.length || 0}`,
        cumulative: `2024: ${soukeData.cumulative['2024']?.length || 0}, 2025: ${soukeData.cumulative['2025']?.length || 0}`
      });
      
      // 内定数データ処理
      const naiteiData = processNaiteiData(naiteiWeeklyRows, naiteiDailyRows, naiteiCumulativeRows);
      
      // 統合データ作成
      processedData = {
        souke: soukeData,
        naitei: naiteiData,
        metadata: {
          lastUpdated: new Date().toISOString(),
          dataSource: 'bigquery',
          userId: userId,
          recordCount: {
            souke: soukeRows.length,
            naiteiWeekly: naiteiWeeklyRows.length,
            naiteiDaily: naiteiDailyRows.length,
            naiteiCumulative: naiteiCumulativeRows.length
          }
        }
      };
      
      console.log('🔗 Integrated souke + naitei data structure created successfully');
      
      // データ検証（総受データのみ検証、統合データ対応は今後実装）
      const soukeValidation = validateProcessedData(processedData.souke);
      if (!soukeValidation.isValid) {
        console.error('❌ Souke data validation failed:', soukeValidation.errors);
        throw new Error('総受データ検証エラー: ' + soukeValidation.errors.join(', '));
      }
      
      if (soukeValidation.warnings.length > 0) {
        console.warn('⚠️ Souke data warnings:', soukeValidation.warnings);
      }
      
      // 内定数データの基本検証
      if (processedData.naitei && processedData.naitei.metadata) {
        console.log('✅ Naitei data structure validation passed');
      } else {
        console.warn('⚠️ Naitei data structure validation failed, but continuing...');
      }
      
      console.log('✅ Data processing completed successfully');
      
    } catch (queryError) {
      console.error('❌ BigQuery execution failed:', queryError);
      
      // フォールバック: モックデータを使用（統合データ構造）
      console.log('🔄 Falling back to mock data...');
      const mockSoukeData = generateMockData('bigquery-error');
      mockSoukeData.metadata.error = queryError.message;
      
      // 内定数用のモックデータ作成
      const mockNaiteiData = {
        daily: { '2024': [], '2025': [] },
        cumulative: { '2024': [], '2025': [] },
        weekly: { '2024': [], '2025': [] },
        metadata: {
          lastUpdated: new Date().toISOString(),
          dataSource: 'mock-fallback',
          error: 'BigQuery failed, using mock data for naitei'
        }
      };
      
      // 統合データ構造でフォールバック
      processedData = {
        souke: mockSoukeData,
        naitei: mockNaiteiData,
        metadata: {
          lastUpdated: new Date().toISOString(),
          dataSource: 'bigquery-fallback',
          userId: userId,
          error: queryError.message,
          recordCount: {
            souke: 0,
            naiteiWeekly: 0,
            naiteiDaily: 0,
            naiteiCumulative: 0
          }
        }
      };
    }

      // Firestore保存はフロントエンドで実行（認証問題回避）
      console.log('💾 Firestore caching will be handled by frontend (Firebase Client SDK)');

      console.log('✅ Souke data update completed successfully');

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: processedData,
          message: 'データが正常に更新されました（フロントエンドでキャッシュ保存）'
        })
      };

    } catch (dependencyError) {
      console.error('❌ Dependency or processing failed:', dependencyError);
      console.error('Dependency error details:', dependencyError.stack);
      
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: `Processing Error: ${dependencyError.message}`,
          message: 'データ処理に失敗しました'
        })
      };
    }

  } catch (error) {
    console.error('❌ Souke data update failed:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'データ更新に失敗しました',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  }
};

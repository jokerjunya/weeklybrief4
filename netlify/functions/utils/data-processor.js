/**
 * BigQueryデータ処理ユーティリティ
 * BigQueryの生データをChart.js形式に変換する
 */

/**
 * BigQueryオブジェクトをプレーンオブジェクトに変換
 * FirestoreはBigQueryDate等の特殊オブジェクトを保存できないため
 */
const sanitizeForFirestore = (obj) => {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  // BigQueryの日付オブジェクトを文字列に変換
  if (obj.constructor && (obj.constructor.name === 'BigQueryDate' || obj.constructor.name === 'Date')) {
    // BigQueryDateの場合は複数の可能なプロパティを試行
    if (obj.value !== undefined) {
      return obj.value;
    } else if (typeof obj.toString === 'function') {
      return obj.toString();
    } else if (obj.toISOString) {
      return obj.toISOString();
    } else {
      // フォールバック: オブジェクトを直接文字列化
      return String(obj);
    }
  }
  
  // 関数オブジェクトはnullに変換（Firestoreで保存不可）
  if (typeof obj === 'function') {
    return null;
  }
  
  // 配列の場合
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore);
  }
  
  // オブジェクトの場合
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeForFirestore(value);
    }
    return sanitized;
  }
  
  return obj;
};

/**
 * BigQueryの結果をChart.js用データに変換
 * @param {Array} rows - BigQueryから取得した行データ
 * @returns {Object} Chart.js形式のデータ
 */
const processQueryResults = (rows) => {
  // BigQueryデータをFirestore互換形式に変換
  const sanitizedRows = sanitizeForFirestore(rows);
  
  const result = {
    daily: { '2024': [], '2025': [] },
    cumulative: { '2024': [], '2025': [] },
    weekly: { '2024': [], '2025': [] },
    metadata: {
      lastUpdated: new Date().toISOString(),
      dataSource: 'bigquery-live',
      recordCount: sanitizedRows.length
    }
  };

  // 各行をデータ型別に処理（KPIデータは無視してグラフデータのみ）
  console.log('🔍 Processing query results - total rows:', sanitizedRows.length);
  let weeklyRowCount = { '2024': 0, '2025': 0 };
  let dailyRowCount = { '2024': 0, '2025': 0 };
  
  sanitizedRows.forEach((row, index) => {
    const year = row.year?.toString() || '2025'; // デフォルトは2025年

    // 週次データの詳細ログ
    if (row.data_type === 'weekly') {
      console.log(`🔍 Weekly row ${index}: year=${year}, data_type=${row.data_type}, week_start=${row.week_start}, week_number=${row.week_number}, souke_count=${row.souke_count}`);
      weeklyRowCount[year]++;
    }

    if (row.data_type === 'daily' && row.first_determine_date) {
      processDailyData(row, result.daily[year], result.cumulative[year]);
      dailyRowCount[year]++;
    } else if (row.data_type === 'weekly' && row.week_start) {
      processWeeklyData(row, result.weekly[year]);
    }
  });
  
  console.log('🔍 Row count summary:');
  console.log('  Daily rows - 2024:', dailyRowCount['2024'], '2025:', dailyRowCount['2025']);
  console.log('  Weekly rows - 2024:', weeklyRowCount['2024'], '2025:', weeklyRowCount['2025']);

  // データをソート
  Object.keys(result.daily).forEach(year => {
    result.daily[year].sort((a, b) => new Date(a.date_value) - new Date(b.date_value));
    result.cumulative[year].sort((a, b) => new Date(a.date_value) - new Date(b.date_value));
  });

  Object.keys(result.weekly).forEach(year => {
    result.weekly[year].sort((a, b) => new Date(a.date_value) - new Date(b.date_value));
  });

  // 最終結果もFirestore互換形式に変換
  return sanitizeForFirestore(result);
};

/**
 * 日次データの処理
 */
const processDailyData = (row, dailyArray, cumulativeArray) => {
  const date = new Date(row.first_determine_date);
  const monthDay = `${date.getMonth() + 1}/${date.getDate()}`;
  const dateValue = row.first_determine_date;
  const label = formatDateLabel(date);

  // 日次データ
  dailyArray.push({
    x: monthDay,
    y: parseInt(row.souke_count) || 0,
    label: label,
    date_value: dateValue
  });

  // 累計データ
  if (row.cumulative_souke !== null) {
    cumulativeArray.push({
      x: monthDay,
      y: parseInt(row.cumulative_souke) || 0,
      label: `${label}累計`,
      date_value: dateValue
    });
  }
};

/**
 * 週次データの処理
 */
const processWeeklyData = (row, weeklyArray) => {
  const weekStart = new Date(row.week_start);
  const weekLabel = `Week ${row.week_number}`;
  const year = row.year;

  weeklyArray.push({
    x: weekLabel,
    y: parseInt(row.souke_count) || 0,
    label: `${year}年第${row.week_number}週`,
    date_value: row.week_start
  });
};

/**
 * 日付ラベルのフォーマット
 */
const formatDateLabel = (date) => {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}月${day}日`;
};

/**
 * データの統計情報を計算
 */
const calculateDataStats = (processedData) => {
  const stats = {
    dailyStats: {},
    weeklyStats: {},
    overall: {
      totalDays: 0,
      totalWeeks: 0,
      averageDaily: 0,
      averageWeekly: 0
    }
  };

  // 年別統計
  Object.keys(processedData.daily).forEach(year => {
    const dailyData = processedData.daily[year];
    const weeklyData = processedData.weekly[year];

    if (dailyData.length > 0) {
      const totalDaily = dailyData.reduce((sum, item) => sum + item.y, 0);
      stats.dailyStats[year] = {
        count: dailyData.length,
        total: totalDaily,
        average: Math.round(totalDaily / dailyData.length),
        max: Math.max(...dailyData.map(item => item.y)),
        min: Math.min(...dailyData.map(item => item.y))
      };
    }

    if (weeklyData.length > 0) {
      const totalWeekly = weeklyData.reduce((sum, item) => sum + item.y, 0);
      stats.weeklyStats[year] = {
        count: weeklyData.length,
        total: totalWeekly,
        average: Math.round(totalWeekly / weeklyData.length),
        max: Math.max(...weeklyData.map(item => item.y)),
        min: Math.min(...weeklyData.map(item => item.y))
      };
    }
  });

  // 全体統計
  const allDailyData = Object.values(processedData.daily).flat();
  const allWeeklyData = Object.values(processedData.weekly).flat();
  
  if (allDailyData.length > 0) {
    stats.overall.totalDays = allDailyData.length;
    stats.overall.averageDaily = Math.round(
      allDailyData.reduce((sum, item) => sum + item.y, 0) / allDailyData.length
    );
  }

  if (allWeeklyData.length > 0) {
    stats.overall.totalWeeks = allWeeklyData.length;
    stats.overall.averageWeekly = Math.round(
      allWeeklyData.reduce((sum, item) => sum + item.y, 0) / allWeeklyData.length
    );
  }

  return stats;
};

/**
 * エラー処理用のダミーデータ生成
 */
const generateMockData = (reason = 'unknown') => {
  const mockData = {
    daily: {
      '2024': [
        { x: '8/1', y: 3888, label: '8月1日', date_value: '2024-08-01' },
        { x: '8/2', y: 3375, label: '8月2日', date_value: '2024-08-02' }
      ],
      '2025': [
        { x: '8/18', y: 2847, label: '8月18日', date_value: '2025-08-18' },
        { x: '8/19', y: 2923, label: '8月19日', date_value: '2025-08-19' }
      ]
    },
    cumulative: {
      '2024': [
        { x: '8/1', y: 3888, label: '8月1日累計', date_value: '2024-08-01' },
        { x: '8/2', y: 7263, label: '8月2日累計', date_value: '2024-08-02' }
      ],
      '2025': [
        { x: '8/18', y: 45234, label: '8月18日累計', date_value: '2025-08-18' },
        { x: '8/19', y: 48157, label: '8月19日累計', date_value: '2025-08-19' }
      ]
    },
    weekly: {
      '2024': [
        { x: 'Week 31', y: 25678, label: '2024年第31週', date_value: '2024-07-29' },
        { x: 'Week 32', y: 24891, label: '2024年第32週', date_value: '2024-08-05' }
      ],
      '2025': [
        { x: 'Week 31', y: 18234, label: '2025年第31週', date_value: '2025-07-28' },
        { x: 'Week 32', y: 19456, label: '2025年第32週', date_value: '2025-08-04' }
      ]
    },
    metadata: {
      lastUpdated: new Date().toISOString(),
      dataSource: `mock-data-${reason}`,
      isMockData: true,
      mockReason: reason
    }
  };

  return mockData;
};

/**
 * データ検証機能
 */
const validateProcessedData = (data) => {
  const validation = {
    isValid: true,
    errors: [],
    warnings: []
  };

  // 必須フィールドの確認
  if (!data.daily || !data.cumulative || !data.weekly) {
    validation.isValid = false;
    validation.errors.push('必須データフィールドが不足しています');
  }

  // データ年の確認
  const expectedYears = ['2024', '2025'];
  expectedYears.forEach(year => {
    if (!data.daily[year]) {
      validation.warnings.push(`${year}年の日次データがありません`);
    }
    if (!data.weekly[year]) {
      validation.warnings.push(`${year}年の週次データがありません`);
    }
  });

  // データポイント数の確認
  Object.keys(data.daily).forEach(year => {
    const dailyCount = data.daily[year].length;
    const cumulativeCount = data.cumulative[year].length;
    
    if (dailyCount === 0) {
      validation.warnings.push(`${year}年の日次データが空です`);
    }
    
    if (dailyCount !== cumulativeCount) {
      validation.warnings.push(`${year}年の日次と累計データの件数が一致しません`);
    }
  });

  return validation;
};

module.exports = {
  processQueryResults,
  calculateDataStats,
  generateMockData,
  validateProcessedData,
  sanitizeForFirestore
};

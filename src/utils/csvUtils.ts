import { BusinessPerformanceData } from '../types/report';

// 週ごとのデータセット
const weeklyDataSets = {
  '2025-01-06': {
    placement: {
      total_last_tue_fri: 2628,
      total_prev_tue_fri: 2233,
      total_last_year_tue_fri: 2885,
      wow_pct: 17.69,
      yoy_pct: -8.91
    },
    onlinePlatform: {
      last_week_revenue_jpy: 3772444054,
      two_weeks_ago_revenue_jpy: 3913828382,
      last_year_last_week_revenue_jpy: 2451234374,
      wow_pct: -3.6,
      yoy_pct: 53.9
    }
  },
  '2025-01-13': {
    placement: {
      total_last_tue_fri: 2851,
      total_prev_tue_fri: 2628,
      total_last_year_tue_fri: 3012,
      wow_pct: 8.48,
      yoy_pct: -5.34
    },
    onlinePlatform: {
      last_week_revenue_jpy: 3845622187,
      two_weeks_ago_revenue_jpy: 3772444054,
      last_year_last_week_revenue_jpy: 2398765432,
      wow_pct: 1.9,
      yoy_pct: 60.3
    }
  },
  '2025-06-30': {
    placement: {
      total_last_tue_fri: 2759,
      total_prev_tue_fri: 2637,
      total_last_year_tue_fri: 3045,
      wow_pct: 4.6,
      yoy_pct: -9.4
    },
    onlinePlatform: {
      last_week_revenue_jpy: 3329185872,
      two_weeks_ago_revenue_jpy: 3772444054,
      last_year_last_week_revenue_jpy: 2542508931,
      wow_pct: -11.7,
      yoy_pct: 30.9
    }
  },
  '2025-07-07': {
    placement: {
      total_last_tue_fri: 2296,
      total_prev_tue_fri: 2810,
      total_last_year_tue_fri: 2184,
      wow_pct: -18.29,
      yoy_pct: 5.13
    },
    onlinePlatform: {
      last_week_revenue_jpy: 3323543838,
      two_weeks_ago_revenue_jpy: 3733520952,
      last_year_last_week_revenue_jpy: 2319913134,
      wow_pct: -11.0,
      yoy_pct: 43.3
    }
  },
  '2025-07-14': {
    placement: {
      total_last_tue_fri: 2468,
      total_prev_tue_fri: 2333,
      total_last_year_tue_fri: 3280,
      wow_pct: 5.79,
      yoy_pct: -24.76
    },
    onlinePlatform: {
      last_week_revenue_jpy: 3813879742,
      two_weeks_ago_revenue_jpy: 3323543838,
      last_year_last_week_revenue_jpy: 2508542528,
      wow_pct: 14.8,
      yoy_pct: 52
    }
  },
  '2025-07-28': {
    placement: {
      total_last_tue_fri: 2226,
      total_prev_tue_fri: 2205,
      total_last_year_tue_fri: 2305,
      wow_pct: 0.95,
      yoy_pct: -3.43
    },
    onlinePlatform: {
      last_week_revenue_jpy: 3326052263,
      two_weeks_ago_revenue_jpy: 3427002173,
      last_year_last_week_revenue_jpy: 2511351321,
      wow_pct: -2.9,
      yoy_pct: 32.4
    }
  },
  '2025-08-04': {
    placement: {
      total_last_tue_fri: 2713,
      total_prev_tue_fri: 2286,
      total_last_year_tue_fri: 2838,
      wow_pct: 18.68,
      yoy_pct: -4.40
    },
    onlinePlatform: {
      last_week_revenue_jpy: 3079100882,
      two_weeks_ago_revenue_jpy: 3326052263,
      last_year_last_week_revenue_jpy: 2554357376,
      wow_pct: -7.4,
      yoy_pct: 20.5
    }
  },
  '2025-08-18': {
    placement: {
      total_last_tue_fri: 3195, // 週次合計（BigQueryから取得した実際の内定数）
      total_prev_tue_fri: 47, // 前週合計（BigQueryから取得）※データに異常の可能性
      total_last_year_tue_fri: 3200, // 前年同週合計（BigQueryから取得）
      wow_pct: 6697.9, // 前週比（前週データ異常により高い値）
      yoy_pct: -0.2 // 前年比 -0.2%（BigQueryから取得した妥当な値）
    },
    onlinePlatform: {
      last_week_revenue_jpy: 3372458929, // 今週売上（8/18-8/24）実際のデータ
      two_weeks_ago_revenue_jpy: 2953175369, // 前週売上（8/11-8/17）実際のデータ
      last_year_last_week_revenue_jpy: 3274674244, // 前年同週売上（実際のデータ）
      wow_pct: 14.19, // 前週比 +14.19%
      yoy_pct: 2.99 // 前年比 +2.99%
    }
  },
  '2025-08-11': {
    placement: {
      total_last_tue_fri: 36,
      total_prev_tue_fri: 3265, // 前週比-98.9%から逆算
      total_last_year_tue_fri: 59, // 前年比-39.0%から逆算
      wow_pct: -98.9,
      yoy_pct: -39.0
    },
    onlinePlatform: {
      last_week_revenue_jpy: 2956090000, // 29億5,609万円
      two_weeks_ago_revenue_jpy: 3692177722, // 前週比-19.9%から逆算
      last_year_last_week_revenue_jpy: 2401536015, // 前年比+23.1%から逆算
      wow_pct: -19.9,
      yoy_pct: 23.1
    }
  }
};

// CSVデータを読み込む関数（本番では実際のファイルを読み込む）
export const loadBusinessPerformanceData = async (weekId?: string): Promise<BusinessPerformanceData> => {
  // デフォルトは最新週のデータ
  const dataKey = weekId || '2025-08-18';
  const weekData = weeklyDataSets[dataKey as keyof typeof weeklyDataSets] || weeklyDataSets['2025-08-18'];
  
  const placementData = weekData.placement;
  const onlinePlatformData = weekData.onlinePlatform;

  return {
    placement: {
      current: placementData.total_last_tue_fri,
      previous: placementData.total_prev_tue_fri,
      lastYear: placementData.total_last_year_tue_fri,
      wowPercent: placementData.wow_pct,
      yoyPercent: placementData.yoy_pct
    },
    onlinePlatform: {
      current: onlinePlatformData.last_week_revenue_jpy,
      previous: onlinePlatformData.two_weeks_ago_revenue_jpy,
      lastYear: onlinePlatformData.last_year_last_week_revenue_jpy,
      wowPercent: onlinePlatformData.wow_pct,
      yoyPercent: onlinePlatformData.yoy_pct
    }
  };
};

// 重複した関数を削除 - weeklyDataSetsを使用 
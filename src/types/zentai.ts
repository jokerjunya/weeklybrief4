/**
 * 全体モニタリング関連の型定義
 * 総受データ + 内定数データの統合型
 */

import { SoukeChartData } from './souke';

// Chart.js用データポイント (既存のものを再利用)
export interface ChartDataPoint {
  x: string;
  y: number;
  label: string;
  date_value?: string;
  is_current_week?: boolean; // 週次グラフ用
}

// データセット別のチャートデータ (既存のものを再利用)
export interface ChartDataset {
  [year: string]: ChartDataPoint[];
}

// 内定数チャートデータ構造
export interface NaiteiChartData {
  daily: ChartDataset;      // デイリー内定数推移
  cumulative: ChartDataset; // 累計内定数推移  
  weekly: ChartDataset;     // 週次内定数推移
  metadata?: {
    lastUpdated: string;
    dataSource: string;
    userId?: string;
    error?: string;
  };
}

// 統合チャートデータ構造
export interface ZentaiChartData {
  souke: SoukeChartData;     // 総受データ
  naitei: NaiteiChartData;   // 内定数データ
  metadata: {
    lastUpdated: string;
    dataSource: string;
    userId?: string;
    recordCount?: number;
  };
}

// API レスポンス型
export interface ZentaiApiResponse {
  success: boolean;
  data: ZentaiChartData;
  message?: string;
  error?: string;
}

// キャッシュ情報 (既存のSoukeCacheInfoを再利用)
export interface ZentaiCacheInfo {
  updatedAt: string;
  ageMinutes: number;
  isExpired: boolean;
  updatedBy?: string;
}

// キャッシュレスポンス型
export interface ZentaiCacheResponse {
  success: boolean;
  data: ZentaiChartData;
  cacheInfo: ZentaiCacheInfo;
  error?: string;
}

// 更新状態管理
export interface ZentaiUpdateState {
  isLoading: boolean;
  isUpdating: boolean;
  lastUpdated?: string;
  error?: string;
  cacheInfo?: ZentaiCacheInfo;
}

// BigQuery内定数データ（中間処理用）
export interface NaiteiRawData {
  week_start_date: string;
  offer_count_current: number;
  offer_count_last_year: number;
}

// BigQuery日次内定数データ（中間処理用）
export interface NaiteiDailyRawData {
  offer_date: string;
  offer_count_current: number;
  offer_count_last_year: number;
}

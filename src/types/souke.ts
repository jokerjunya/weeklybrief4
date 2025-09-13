/**
 * 集客モニタリング関連の型定義
 */

// Chart.js用データポイント
export interface ChartDataPoint {
  x: string;
  y: number;
  label: string;
  date_value?: string;
}

// データセット別のチャートデータ
export interface ChartDataset {
  [year: string]: ChartDataPoint[];
}

// メイン集客データ構造（従来の平坦構造）
export interface SoukeChartData {
  daily: ChartDataset;
  cumulative: ChartDataset;
  weekly: ChartDataset;
  metadata?: {
    lastUpdated: string;
    dataSource: string;
    userId?: string;
  };
}

// 統合データ構造（全体モニタリング互換）- Chart.js移植後の新しい構造
export interface IntegratedSoukeData {
  souke: {
    daily: ChartDataset;
    cumulative: ChartDataset;
    weekly: ChartDataset;
    metadata?: {
      lastUpdated: string;
      dataSource: string;
      userId?: string;
    };
  };
  naitei?: {
    daily: ChartDataset;
    cumulative: ChartDataset;
    weekly: ChartDataset;
    metadata?: any;
  };
  metadata?: {
    lastUpdated: string;
    dataSource: string;
    userId?: string;
  };
}

// React State用の柔軟な型（両方の構造をサポート）
export type SoukeStateData = SoukeChartData | IntegratedSoukeData | null;

// API レスポンス型
export interface SoukeApiResponse {
  success: boolean;
  data: SoukeChartData;
  message?: string;
  error?: string;
}

// キャッシュ情報
export interface SoukeCacheInfo {
  updatedAt: string;
  ageMinutes: number;
  isExpired: boolean;
  updatedBy?: string;
}

// キャッシュレスポンス型
export interface SoukeCacheResponse {
  success: boolean;
  data: SoukeChartData;
  cache: SoukeCacheInfo;
  error?: string;
}

// 更新状態管理
export interface SoukeUpdateState {
  isLoading: boolean;
  isUpdating: boolean;
  lastUpdated?: string;
  error?: string;
  cacheInfo?: SoukeCacheInfo;
}

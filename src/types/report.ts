export interface WeeklyReport {
  id: string;
  title: string;
  weekOf: string;
  createdAt: string;
  sections: ReportSection[];
}

export interface ReportSection {
  id: string;
  type: SectionType;
  title: string;
  data: any;
  notices?: string[]; // 注意書きのリスト
}

export type SectionType = 
  | 'business-performance'
  | 'stock-movement'
  | 'weekly-schedule'
  | 'ai-news'
  | 'audio-summary'
  | 'competitor-reports'
  | 'custom';

// Business Performance Data (Placement + Online Platform)
export interface BusinessPerformanceData {
  placement: {
    current: number; // total_last_tue_fri
    previous: number; // total_prev_tue_fri
    lastYear: number; // total_last_year_tue_fri
    wowPercent: number; // wow_pct
    yoyPercent: number; // yoy_pct
  };
  onlinePlatform: {
    current: number; // last_week_revenue_jpy
    previous: number; // two_weeks_ago_revenue_jpy
    lastYear: number; // last_year_last_week_revenue_jpy
    wowPercent: number; // wow_pct
    yoyPercent: number; // yoy_pct
  };
}

export interface StockMovementData {
  nikkei: {
    current: number;
    previous: number;
    change: number;
    changePercent: number;
  };
  sp500: {
    current: number;
    previous: number;
    change: number;
    changePercent: number;
  };
  recruitHoldings: {
    current: number;
    previous: number;
    change: number;
    changePercent: number;
  };
}

export interface ScheduleItem {
  id: string;
  date: string;
  title: string;
  description?: string;
  type: 'meeting' | 'event' | 'deadline' | 'milestone';
}

// 週次スケジュール管理用の新しい型定義
export interface WeeklySchedule {
  id: string;          // レポートID (例: "2025-07-07")
  reportId: string;    // レポートID (例: "2025-07-07")
  weekStart: string;   // 週の開始日 (例: "2025-07-07")
  weekEnd: string;     // 週の終了日 (例: "2025-07-13")
  items: ScheduleItem[];
  createdAt?: string;
  updatedAt?: string;
}

// 編集中のスケジュールアイテム（7日間分）
export interface DailyScheduleSlot {
  date: string;        // YYYY-MM-DD format
  title: string;
  description?: string;
  type: 'meeting' | 'event' | 'deadline' | 'milestone';
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url?: string;
  publishedAt: string;
  category: string;
  relevanceScore: number;
  assignedReportId?: string; // どのレポートに紐付いているか
}

export interface AudioFile {
  id: string;
  title: string;
  audioUrl: string;
  duration?: number;
}

export interface AudioSummaryData {
  transcript: string;
  keyPoints: string[];
  audioFiles: AudioFile[];
}

export interface MetricData {
  title: string;
  value: number;
  unit?: string;
  change?: number;
  changePercent?: number;
  trend: 'up' | 'down' | 'stable';
  description?: string;
}

export interface CompetitorReport {
  id: string;
  companyName: string;
  reportUrl: string;
  description?: string;
  category: 'HR Tech' | 'Recruitment' | 'E-commerce' | 'Other';
} 
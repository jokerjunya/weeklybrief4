import { WeeklySchedule, ScheduleItem } from '../types/report';
import { saveScheduleToFirebase } from '../firebase/database';
import { getWeekStartFromReportId, calculateWeekEnd } from './dateUtils';

// 既存の静的スケジュールデータ
const staticScheduleData: { [reportId: string]: ScheduleItem[] } = {
  '2025-01-06': [
    { id: '1', date: '2025-01-07', title: '取締役会', description: '月次業績レビュー', type: 'meeting' },
    { id: '2', date: '2025-01-08', title: 'プロダクト戦略会議', type: 'meeting' },
    { id: '3', date: '2025-01-10', title: '四半期レポート提出', type: 'deadline' },
    { id: '4', date: '2025-01-12', title: '新機能リリース', type: 'milestone' }
  ],
  '2025-01-13': [
    { id: '5', date: '2025-01-14', title: '営業チーム週次会議', description: '第2週業績確認', type: 'meeting' },
    { id: '6', date: '2025-01-15', title: 'マーケティング戦略ワークショップ', type: 'meeting' },
    { id: '7', date: '2025-01-16', title: 'IT部門セキュリティ監査', type: 'meeting' },
    { id: '8', date: '2025-01-17', title: 'クライアント年度契約更新', type: 'deadline' },
    { id: '9', date: '2025-01-19', title: '新年度計画発表会', type: 'event' }
  ],
  '2025-06-30': [
    {
      id: 'schedule-3-1',
      date: '2025-07-02',
      title: 'IVS参加@京都',
      type: 'event'
    }
  ]
};

/**
 * 静的スケジュールデータをWeeklyScheduleオブジェクトに変換
 */
const convertToWeeklySchedule = (reportId: string, items: ScheduleItem[]): WeeklySchedule => {
  const weekStart = getWeekStartFromReportId(reportId);
  const weekEnd = calculateWeekEnd(weekStart);
  
  return {
    id: reportId,
    reportId,
    weekStart,
    weekEnd,
    items,
    createdAt: new Date().toISOString()
  };
};

/**
 * 全ての静的スケジュールデータをFirebaseに移行
 */
export const migrateStaticSchedulesToFirebase = async (): Promise<void> => {
  console.log('🚀 Starting schedule migration to Firebase...');
  
  try {
    const migrationPromises = Object.entries(staticScheduleData).map(async ([reportId, items]) => {
      const weeklySchedule = convertToWeeklySchedule(reportId, items);
      await saveScheduleToFirebase(weeklySchedule);
      console.log(`✅ Migrated schedule for report: ${reportId} (${items.length} items)`);
    });

    await Promise.all(migrationPromises);
    console.log('🎉 Schedule migration completed successfully!');
  } catch (error) {
    console.error('❌ Schedule migration failed:', error);
    throw error;
  }
};

/**
 * 特定のレポートの静的スケジュールデータを取得
 */
export const getStaticScheduleData = (reportId: string): ScheduleItem[] => {
  return staticScheduleData[reportId] || [];
};

/**
 * 静的スケジュールデータが存在するかチェック
 */
export const hasStaticScheduleData = (reportId: string): boolean => {
  return reportId in staticScheduleData && staticScheduleData[reportId].length > 0;
}; 
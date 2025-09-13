import { DailyScheduleSlot } from '../types/report';

/**
 * 週の開始日から7日間の日付を生成する
 * @param weekStart 週の開始日 (YYYY-MM-DD形式)
 * @returns 7日間の日付配列
 */
export const generateWeekDates = (weekStart: string): string[] => {
  const startDate = new Date(weekStart);
  const dates: string[] = [];
  
  for (let i = 0; i < 7; i++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + i);
    dates.push(currentDate.toISOString().split('T')[0]);
  }
  
  return dates;
};

/**
 * 週の終了日を計算する
 * @param weekStart 週の開始日 (YYYY-MM-DD形式)
 * @returns 週の終了日 (YYYY-MM-DD形式)
 */
export const calculateWeekEnd = (weekStart: string): string => {
  const startDate = new Date(weekStart);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  return endDate.toISOString().split('T')[0];
};

/**
 * 7日間分の空のスケジュールスロットを生成する
 * @param weekStart 週の開始日 (YYYY-MM-DD形式)
 * @returns 7日間分の空のDailyScheduleSlot配列
 */
export const generateEmptyWeekSlots = (weekStart: string): DailyScheduleSlot[] => {
  const dates = generateWeekDates(weekStart);
  
  return dates.map(date => ({
    date,
    title: '',
    description: '',
    type: 'meeting' as const
  }));
};

/**
 * 日付を日本語フォーマットで表示する
 * @param dateString 日付文字列 (YYYY-MM-DD形式)
 * @returns 日本語フォーマット (例: "7月7日(月)")
 */
export const formatDateJapanese = (dateString: string): string => {
  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
  
  return `${month}月${day}日(${dayOfWeek})`;
};

/**
 * レポートIDから週の開始日を抽出する
 * @param reportId レポートID (例: "2025-07-07")
 * @returns 週の開始日 (YYYY-MM-DD形式)
 */
export const getWeekStartFromReportId = (reportId: string): string => {
  // レポートIDがすでにYYYY-MM-DD形式の場合はそのまま返す
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (datePattern.test(reportId)) {
    return reportId;
  }
  
  // その他のフォーマットの場合は現在の日付を基準にする
  const today = new Date();
  return today.toISOString().split('T')[0];
};

/**
 * 空のスケジュールアイテムかどうかを判定する
 * @param slot DailyScheduleSlot
 * @returns 空の場合true
 */
export const isEmptyScheduleSlot = (slot: DailyScheduleSlot): boolean => {
  return !slot.title.trim() && !slot.description?.trim();
};

/**
 * DailyScheduleSlotをScheduleItemに変換する（空でないもののみ）
 * @param slots DailyScheduleSlot配列
 * @returns ScheduleItem配列
 */
export const convertSlotsToScheduleItems = (slots: DailyScheduleSlot[]) => {
  return slots
    .filter(slot => !isEmptyScheduleSlot(slot))
    .map(slot => ({
      id: `schedule-${slot.date}-${Date.now()}`,
      date: slot.date,
      title: slot.title,
      description: slot.description,
      type: slot.type
    }));
}; 
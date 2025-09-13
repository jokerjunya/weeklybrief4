import React, { useState, useEffect } from 'react';
import { Calendar, X, Save, Loader2 } from 'lucide-react';
import { DailyScheduleSlot, WeeklySchedule } from '../../types/report';
import { 
  generateEmptyWeekSlots, 
  formatDateJapanese, 
  convertSlotsToScheduleItems,
  calculateWeekEnd,
  getWeekStartFromReportId 
} from '../../utils/dateUtils';
import { saveScheduleToFirebase } from '../../firebase/database';

interface ScheduleEditorProps {
  reportId: string;
  existingSchedule?: WeeklySchedule | null;
  onSave: (schedule: WeeklySchedule) => void;
  onCancel: () => void;
}

const ScheduleEditor: React.FC<ScheduleEditorProps> = ({
  reportId,
  existingSchedule,
  onSave,
  onCancel
}) => {
  const [slots, setSlots] = useState<DailyScheduleSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 初期化
  useEffect(() => {
    const weekStart = getWeekStartFromReportId(reportId);
    const emptySlots = generateEmptyWeekSlots(weekStart);
    
    if (existingSchedule?.items) {
      // 既存のスケジュールがある場合、各日付にマッピング
      const filledSlots = emptySlots.map(slot => {
        const existingItem = existingSchedule.items.find(item => item.date === slot.date);
        if (existingItem) {
          return {
            date: slot.date,
            title: existingItem.title,
            description: existingItem.description || '',
            type: existingItem.type
          };
        }
        return slot;
      });
      setSlots(filledSlots);
    } else {
      setSlots(emptySlots);
    }
  }, [reportId, existingSchedule]);

  // スロット更新
  const updateSlot = (index: number, field: keyof DailyScheduleSlot, value: string) => {
    setSlots(prev => prev.map((slot, i) => 
      i === index ? { ...slot, [field]: value } : slot
    ));
  };

  // 保存処理
  const handleSave = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const weekStart = getWeekStartFromReportId(reportId);
      const weekEnd = calculateWeekEnd(weekStart);
      const scheduleItems = convertSlotsToScheduleItems(slots);
      
      const schedule: WeeklySchedule = {
        id: reportId,
        reportId,
        weekStart,
        weekEnd,
        items: scheduleItems,
        createdAt: existingSchedule?.createdAt || new Date().toISOString(),
      };

      const savedSchedule = await saveScheduleToFirebase(schedule);
      onSave(savedSchedule);
    } catch (err) {
      console.error('Failed to save schedule:', err);
      setError('スケジュールの保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 入力されているスロット数をカウント
  const filledSlotsCount = slots.filter(slot => slot.title.trim()).length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
      {/* ヘッダー */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            今週の予定を編集
          </h3>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {filledSlotsCount > 0 && `${filledSlotsCount}件の予定`}
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* 7日間の編集フォーム */}
      <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
        {slots.map((slot, index) => (
          <div key={slot.date} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            {/* 日付ヘッダー */}
            <div className="flex items-center gap-2 mb-3">
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {formatDateJapanese(slot.date)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {slot.date}
              </div>
            </div>

            {/* 入力フィールド */}
            <div className="space-y-2">
              {/* タイトル */}
              <div>
                <input
                  type="text"
                  placeholder="予定を入力してください"
                  value={slot.title}
                  onChange={(e) => updateSlot(index, 'title', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md 
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white 
                           placeholder-gray-500 dark:placeholder-gray-400
                           focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400"
                />
              </div>

              {/* 詳細（タイトルが入力されている場合のみ表示） */}
              {slot.title.trim() && (
                <>
                  <div>
                    <input
                      type="text"
                      placeholder="詳細（任意）"
                      value={slot.description}
                      onChange={(e) => updateSlot(index, 'description', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md 
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-white 
                               placeholder-gray-500 dark:placeholder-gray-400
                               focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400"
                    />
                  </div>

                  {/* 種別選択 */}
                  <div>
                    <select
                      value={slot.type}
                      onChange={(e) => updateSlot(index, 'type', e.target.value as any)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md 
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                               focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400"
                    >
                      <option value="meeting">会議</option>
                      <option value="event">イベント</option>
                      <option value="deadline">締切</option>
                      <option value="milestone">マイルストーン</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* フッター（保存・キャンセルボタン） */}
      <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          空欄の日付は表示されません
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 
                     bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md
                     hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-4 h-4" />
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white 
                     bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 
                     rounded-md transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {loading ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleEditor; 
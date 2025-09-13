import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  where,
  Timestamp,
  DocumentData
} from 'firebase/firestore';
import { db } from './config';
import { NewsItem, WeeklySchedule } from '../types/report';
import { SoukeChartData, SoukeCacheInfo, IntegratedSoukeData } from '../types/souke';
import { ZentaiChartData, ZentaiCacheInfo } from '../types/zentai';

// コレクション名
const COLLECTIONS = {
  NEWS: 'news',
  REPORTS: 'reports',
  SCHEDULES: 'schedules',
  SOUKE_CACHE: 'souke_cache',
  TABLE_CACHE: 'table_cache',
  ZENTAI_CACHE: 'zentai_cache'
};

// NewsItem を Firestore用に変換
const newsItemToFirestore = (newsItem: NewsItem): DocumentData => ({
  ...newsItem,
  publishedAt: newsItem.publishedAt, // 文字列のまま保持
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now()
});

// Firestore から NewsItem に変換
const firestoreToNewsItem = (data: DocumentData): NewsItem => ({
  id: data.id,
  title: data.title,
  summary: data.summary,
  url: data.url,
  publishedAt: data.publishedAt?.toDate ? data.publishedAt.toDate().toISOString().split('T')[0] : data.publishedAt,
  category: data.category,
  relevanceScore: data.relevanceScore,
  assignedReportId: data.assignedReportId
});

// ニュース一覧取得
export const getAllNewsFromFirebase = async (): Promise<NewsItem[]> => {
  try {
    const newsCollection = collection(db, COLLECTIONS.NEWS);
    const newsQuery = query(newsCollection, orderBy('publishedAt', 'desc'));
    const querySnapshot = await getDocs(newsQuery);
    
    return querySnapshot.docs.map(doc => 
      firestoreToNewsItem({ id: doc.id, ...doc.data() })
    );
  } catch (error) {
    console.error('Failed to fetch news from Firebase:', error);
    throw error;
  }
};

// 特定のニュース取得
export const getNewsByIdFromFirebase = async (id: string): Promise<NewsItem | null> => {
  try {
    const newsDoc = doc(db, COLLECTIONS.NEWS, id);
    const docSnap = await getDoc(newsDoc);
    
    if (docSnap.exists()) {
      return firestoreToNewsItem({ id: docSnap.id, ...docSnap.data() });
    }
    return null;
  } catch (error) {
    console.error('Failed to fetch news by ID from Firebase:', error);
    throw error;
  }
};

// ニュース作成
export const createNewsInFirebase = async (newsData: Omit<NewsItem, 'id'>): Promise<NewsItem> => {
  try {
    // 自動IDを生成
    const newsCollection = collection(db, COLLECTIONS.NEWS);
    const newNewsRef = doc(newsCollection);
    
    const newsItem: NewsItem = {
      ...newsData,
      id: newNewsRef.id
    };
    
    await setDoc(newNewsRef, newsItemToFirestore(newsItem));
    return newsItem;
  } catch (error) {
    console.error('Failed to create news in Firebase:', error);
    throw error;
  }
};

// ニュース更新
export const updateNewsInFirebase = async (id: string, updates: Partial<NewsItem>): Promise<NewsItem | null> => {
  try {
    const newsDoc = doc(db, COLLECTIONS.NEWS, id);
    const updateData = {
      ...updates,
      updatedAt: Timestamp.now()
    };
    
    await updateDoc(newsDoc, updateData);
    
    // 更新後のデータを取得して返す
    return await getNewsByIdFromFirebase(id);
  } catch (error) {
    console.error('Failed to update news in Firebase:', error);
    throw error;
  }
};

// ニュース削除
export const deleteNewsFromFirebase = async (id: string): Promise<boolean> => {
  try {
    const newsDoc = doc(db, COLLECTIONS.NEWS, id);
    await deleteDoc(newsDoc);
    return true;
  } catch (error) {
    console.error('Failed to delete news from Firebase:', error);
    return false;
  }
};

// ニュースの紐付け更新
export const updateNewsAssignmentInFirebase = async (
  newsId: string, 
  reportId: string | undefined
): Promise<NewsItem | null> => {
  try {
    const newsDoc = doc(db, COLLECTIONS.NEWS, newsId);
    await updateDoc(newsDoc, {
      assignedReportId: reportId || null,
      updatedAt: Timestamp.now()
    });
    
    return await getNewsByIdFromFirebase(newsId);
  } catch (error) {
    console.error('Failed to update news assignment in Firebase:', error);
    throw error;
  }
};

// 特定のレポートに紐付いたニュース取得
export const getNewsForReportFromFirebase = async (reportId: string): Promise<NewsItem[]> => {
  try {
    const newsCollection = collection(db, COLLECTIONS.NEWS);
    const newsQuery = query(
      newsCollection, 
      where('assignedReportId', '==', reportId)
      // インデックスエラー回避のため一時的にorderByを削除
      // orderBy('publishedAt', 'desc')
    );
    const querySnapshot = await getDocs(newsQuery);
    
    const results = querySnapshot.docs.map(doc => 
      firestoreToNewsItem({ id: doc.id, ...doc.data() })
    );
    
    // クライアント側でソート
    return results.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  } catch (error) {
    console.error('Failed to fetch news for report from Firebase:', error);
    throw error;
  }
};

// 未割り当てのニュース取得
export const getUnassignedNewsFromFirebase = async (): Promise<NewsItem[]> => {
  try {
    const newsCollection = collection(db, COLLECTIONS.NEWS);
    const newsQuery = query(
      newsCollection, 
      where('assignedReportId', '==', null)
      // インデックスエラー回避のため一時的にorderByを削除
      // orderBy('publishedAt', 'desc')
    );
    const querySnapshot = await getDocs(newsQuery);
    
    const results = querySnapshot.docs.map(doc => 
      firestoreToNewsItem({ id: doc.id, ...doc.data() })
    );
    
    // クライアント側でソート
    return results.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  } catch (error) {
    console.error('Failed to fetch unassigned news from Firebase:', error);
    throw error;
  }
};

// リアルタイム同期用のリスナー設定
export const subscribeToNewsUpdates = (callback: (news: NewsItem[]) => void): () => void => {
  const newsCollection = collection(db, COLLECTIONS.NEWS);
  const newsQuery = query(newsCollection, orderBy('publishedAt', 'desc'));
  
  const unsubscribe = onSnapshot(newsQuery, (snapshot) => {
    const news = snapshot.docs.map(doc => 
      firestoreToNewsItem({ id: doc.id, ...doc.data() })
    );
    callback(news);
  }, (error) => {
    console.error('Error listening to news updates:', error);
  });
  
  return unsubscribe;
};

// 特定のレポートのニュースをリアルタイム同期
export const subscribeToReportNews = (
  reportId: string, 
  callback: (news: NewsItem[]) => void
): () => void => {
  const newsCollection = collection(db, COLLECTIONS.NEWS);
  const newsQuery = query(
    newsCollection, 
    where('assignedReportId', '==', reportId)
    // インデックスエラー回避のため一時的にorderByを削除
    // orderBy('publishedAt', 'desc')
  );
  
  const unsubscribe = onSnapshot(newsQuery, (snapshot) => {
    const results = snapshot.docs.map(doc => 
      firestoreToNewsItem({ id: doc.id, ...doc.data() })
    );
    
    // クライアント側でソート
    const sortedNews = results.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    callback(sortedNews);
  }, (error) => {
    console.error('Error listening to report news updates:', error);
  });
  
  return unsubscribe;
};

// ========================
// スケジュール管理関数
// ========================

// WeeklySchedule を Firestore用に変換
const weeklyScheduleToFirestore = (schedule: WeeklySchedule): DocumentData => ({
  reportId: schedule.reportId,
  weekStart: schedule.weekStart,
  weekEnd: schedule.weekEnd,
  items: schedule.items,
  createdAt: schedule.createdAt ? schedule.createdAt : Timestamp.now(),
  updatedAt: Timestamp.now()
});

// Firestore から WeeklySchedule に変換
const firestoreToWeeklySchedule = (data: DocumentData): WeeklySchedule => ({
  id: data.id,
  reportId: data.reportId,
  weekStart: data.weekStart,
  weekEnd: data.weekEnd,
  items: data.items || [],
  createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
  updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
});

// 特定レポートのスケジュール取得
export const getScheduleByReportId = async (reportId: string): Promise<WeeklySchedule | null> => {
  try {
    const scheduleDoc = doc(db, COLLECTIONS.SCHEDULES, reportId);
    const docSnap = await getDoc(scheduleDoc);
    
    if (docSnap.exists()) {
      return firestoreToWeeklySchedule({ id: docSnap.id, ...docSnap.data() });
    }
    return null;
  } catch (error) {
    console.error('Failed to fetch schedule by report ID from Firebase:', error);
    throw error;
  }
};

// スケジュール作成または更新
export const saveScheduleToFirebase = async (schedule: WeeklySchedule): Promise<WeeklySchedule> => {
  try {
    const scheduleDoc = doc(db, COLLECTIONS.SCHEDULES, schedule.reportId);
    const scheduleData = weeklyScheduleToFirestore(schedule);
    
    await setDoc(scheduleDoc, scheduleData, { merge: true });
    
    // 保存後のデータを取得して返す
    const savedSchedule = await getScheduleByReportId(schedule.reportId);
    return savedSchedule || schedule;
  } catch (error) {
    console.error('Failed to save schedule to Firebase:', error);
    throw error;
  }
};

// スケジュール削除
export const deleteScheduleFromFirebase = async (reportId: string): Promise<boolean> => {
  try {
    const scheduleDoc = doc(db, COLLECTIONS.SCHEDULES, reportId);
    await deleteDoc(scheduleDoc);
    return true;
  } catch (error) {
    console.error('Failed to delete schedule from Firebase:', error);
    return false;
  }
};

// スケジュールのリアルタイム同期
export const subscribeToScheduleUpdates = (
  reportId: string,
  callback: (schedule: WeeklySchedule | null) => void
): () => void => {
  const scheduleDoc = doc(db, COLLECTIONS.SCHEDULES, reportId);
  
  const unsubscribe = onSnapshot(scheduleDoc, (docSnap) => {
    if (docSnap.exists()) {
      const schedule = firestoreToWeeklySchedule({ id: docSnap.id, ...docSnap.data() });
      callback(schedule);
    } else {
      callback(null);
    }
  }, (error) => {
    console.error('Schedule subscription error:', error);
    callback(null);
  });

  return unsubscribe;
};

// 全スケジュール取得（管理用）
export const getAllSchedulesFromFirebase = async (): Promise<WeeklySchedule[]> => {
  try {
    const schedulesCollection = collection(db, COLLECTIONS.SCHEDULES);
    const schedulesQuery = query(schedulesCollection, orderBy('weekStart', 'desc'));
    const querySnapshot = await getDocs(schedulesQuery);
    
    return querySnapshot.docs.map(doc => 
      firestoreToWeeklySchedule({ id: doc.id, ...doc.data() })
    );
  } catch (error) {
    console.error('Failed to fetch all schedules from Firebase:', error);
    throw error;
  }
};

// ========================
// 集客モニタリング キャッシュ管理
// ========================

// SoukeChartData を Firestore用に変換（統合構造対応）
const soukeDataToFirestore = (data: SoukeChartData | IntegratedSoukeData): DocumentData => {
  // 統合構造 vs 従来構造の自動判定
  const hasIntegratedStructure = 'souke' in data;
  
  console.log('🔧 soukeDataToFirestore: detecting structure type:', {
    hasIntegratedStructure,
    dataKeys: Object.keys(data || {}),
    soukeExists: hasIntegratedStructure
  });

  let cleanData: any;
  
  if (hasIntegratedStructure) {
    // 統合構造の場合：soukeデータを抽出
    const integratedData = data as IntegratedSoukeData;
    const soukeData = integratedData.souke;
    cleanData = {
      daily: soukeData?.daily || {},
      cumulative: soukeData?.cumulative || {},
      weekly: soukeData?.weekly || {},
      metadata: soukeData?.metadata || data.metadata || {}
    };
    console.log('🔧 Using integrated structure (data.souke)');
  } else {
    // 従来構造の場合：そのまま使用
    const legacyData = data as SoukeChartData;
    cleanData = {
      daily: legacyData.daily || {},
      cumulative: legacyData.cumulative || {},
      weekly: legacyData.weekly || {},
      metadata: legacyData.metadata || {}
    };
    console.log('🔧 Using legacy structure (data.daily)');
  }

  // undefined フィールドを除去してFirestore安全に変換
  const sanitizeForFirestore = (obj: any): any => {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== 'object') return obj;
    
    const result: any = {};
    Object.keys(obj).forEach(key => {
      if (obj[key] !== undefined) {
        result[key] = typeof obj[key] === 'object' && obj[key] !== null 
          ? sanitizeForFirestore(obj[key]) 
          : obj[key];
      }
    });
    return result;
  };

  const firestoreData = {
    daily: sanitizeForFirestore(cleanData.daily),
    cumulative: sanitizeForFirestore(cleanData.cumulative),
    weekly: sanitizeForFirestore(cleanData.weekly),
    metadata: sanitizeForFirestore(cleanData.metadata),
    updatedAt: Timestamp.now(),
    version: '2.0' // 統合構造対応版
  };
  
  console.log('🔧 Final Firestore data keys:', Object.keys(firestoreData));
  return firestoreData;
};

// Firestore から SoukeChartData に変換
const firestoreToSoukeData = (data: DocumentData): SoukeChartData => ({
  daily: data.daily || {},
  cumulative: data.cumulative || {},
  weekly: data.weekly || {},
  metadata: {
    ...data.metadata,
    lastUpdated: data.updatedAt?.toDate?.()?.toISOString() || data.metadata?.lastUpdated
  }
});

// 集客データキャッシュ保存
export const saveSoukeDataToCache = async (data: SoukeChartData | IntegratedSoukeData, userId?: string): Promise<void> => {
  try {
    const cacheRef = doc(db, COLLECTIONS.SOUKE_CACHE, 'latest');
    const firestoreData = soukeDataToFirestore(data);
    
    if (userId) {
      firestoreData.updatedBy = userId;
    }
    
    await setDoc(cacheRef, firestoreData);
    console.log('✅ Souke data saved to cache');
  } catch (error) {
    console.error('❌ Failed to save souke data to cache:', error);
    throw error;
  }
};

// テーブルデータキャッシュ保存
export const saveTableDataToCache = async (data: any, userId?: string): Promise<void> => {
  try {
    const cacheRef = doc(db, COLLECTIONS.TABLE_CACHE, 'latest');
    const firestoreData = {
      ...data,
      updatedAt: Timestamp.now(),
      updatedBy: userId || 'unknown',
      version: '1.0'
    };
    
    await setDoc(cacheRef, firestoreData);
    console.log('✅ Table data saved to cache');
  } catch (error) {
    console.error('❌ Failed to save table data to cache:', error);
    throw error;
  }
};

// 集客データキャッシュ取得
export const getSoukeDataFromCache = async (): Promise<{
  data: SoukeChartData | null;
  cacheInfo: SoukeCacheInfo | null;
}> => {
  try {
    const cacheRef = doc(db, COLLECTIONS.SOUKE_CACHE, 'latest');
    const docSnap = await getDoc(cacheRef);
    
    if (!docSnap.exists()) {
      console.log('⚠️ No souke cache data found');
      return { data: null, cacheInfo: null };
    }
    
    const docData = docSnap.data();
    const updatedAt = docData.updatedAt?.toDate?.() || new Date(docData.updatedAt);
    const now = new Date();
    const ageInMinutes = (now.getTime() - updatedAt.getTime()) / (1000 * 60);
    
    const cacheInfo: SoukeCacheInfo = {
      updatedAt: updatedAt.toISOString(),
      ageMinutes: Math.round(ageInMinutes),
      isExpired: ageInMinutes > 1440, // 24時間（1440分）でキャッシュ期限切れ
      updatedBy: docData.updatedBy
    };
    
    const data = firestoreToSoukeData(docData);
    
    console.log(`✅ Souke cache loaded (age: ${Math.round(ageInMinutes)}min)`);
    return { data, cacheInfo };
    
  } catch (error) {
    console.error('❌ Failed to get souke data from cache:', error);
    throw error;
  }
};

// 集客データキャッシュ削除
export const clearSoukeDataCache = async (): Promise<boolean> => {
  try {
    const cacheRef = doc(db, COLLECTIONS.SOUKE_CACHE, 'latest');
    await deleteDoc(cacheRef);
    console.log('✅ Souke cache cleared');
    return true;
  } catch (error) {
    console.error('❌ Failed to clear souke cache:', error);
    return false;
  }
};

// 集客データのリアルタイム同期
export const subscribeToSoukeDataUpdates = (
  callback: (data: SoukeChartData | null, cacheInfo: SoukeCacheInfo | null) => void
): () => void => {
  const cacheRef = doc(db, COLLECTIONS.SOUKE_CACHE, 'latest');
  
  const unsubscribe = onSnapshot(cacheRef, (docSnap) => {
    if (docSnap.exists()) {
      const docData = docSnap.data();
      const updatedAt = docData.updatedAt?.toDate?.() || new Date(docData.updatedAt);
      const now = new Date();
      const ageInMinutes = (now.getTime() - updatedAt.getTime()) / (1000 * 60);
      
      const cacheInfo: SoukeCacheInfo = {
        updatedAt: updatedAt.toISOString(),
        ageMinutes: Math.round(ageInMinutes),
        isExpired: ageInMinutes > 1440, // 24時間（1440分）でキャッシュ期限切れ
        updatedBy: docData.updatedBy
      };
      
      const data = firestoreToSoukeData(docData);
      callback(data, cacheInfo);
    } else {
      callback(null, null);
    }
  }, (error) => {
    console.error('Souke data subscription error:', error);
    callback(null, null);
  });
  
  return unsubscribe;
};

// ========================
// テーブルキャッシュ管理（table_cache用）
// ========================

// テーブルキャッシュデータ取得
export const getTableDataFromCache = async (): Promise<{
  data: any | null;
  cacheInfo: SoukeCacheInfo | null;
}> => {
  try {
    const cacheRef = doc(db, COLLECTIONS.TABLE_CACHE, 'latest');
    const docSnap = await getDoc(cacheRef);
    
    if (!docSnap.exists()) {
      console.log('⚠️ No table cache data found');
      return { data: null, cacheInfo: null };
    }
    
    const docData = docSnap.data();
    const updatedAt = docData.updatedAt?.toDate?.() || new Date(docData.updatedAt);
    const now = new Date();
    const ageInMinutes = (now.getTime() - updatedAt.getTime()) / (1000 * 60);
    
    const cacheInfo: SoukeCacheInfo = {
      updatedAt: updatedAt.toISOString(),
      ageMinutes: Math.round(ageInMinutes),
      isExpired: ageInMinutes > 1440, // 24時間（1440分）でキャッシュ期限切れ
      updatedBy: docData.updatedBy
    };
    
    console.log(`✅ Table cache loaded (age: ${Math.round(ageInMinutes)}min)`);
    return { data: docData, cacheInfo };
    
  } catch (error) {
    console.error('❌ Failed to get table data from cache:', error);
    throw error;
  }
};

// テーブルキャッシュのリアルタイム同期
export const subscribeToTableDataUpdates = (
  callback: (data: any | null, cacheInfo: SoukeCacheInfo | null) => void
): () => void => {
  const cacheRef = doc(db, COLLECTIONS.TABLE_CACHE, 'latest');
  
  const unsubscribe = onSnapshot(cacheRef, (docSnap) => {
    if (docSnap.exists()) {
      const docData = docSnap.data();
      const updatedAt = docData.updatedAt?.toDate?.() || new Date(docData.updatedAt);
      const now = new Date();
      const ageInMinutes = (now.getTime() - updatedAt.getTime()) / (1000 * 60);
      
      const cacheInfo: SoukeCacheInfo = {
        updatedAt: updatedAt.toISOString(),
        ageMinutes: Math.round(ageInMinutes),
        isExpired: ageInMinutes > 1440, // 24時間（1440分）でキャッシュ期限切れ
        updatedBy: docData.updatedBy
      };
      
      callback(docData, cacheInfo);
    } else {
      callback(null, null);
    }
  }, (error) => {
    console.error('Table data subscription error:', error);
    callback(null, null);
  });
  
  return unsubscribe;
};

// ========================
// Zentai（全体モニタリング）キャッシュ管理
// ========================

// ZentaiChartData を Firestore用に変換（データサニタイズ強化）
const zentaiDataToFirestore = (data: ZentaiChartData): DocumentData => {
  // データサニタイズ関数
  const sanitizeValue = (val: any): any => {
    if (val === undefined || val === null) return null;
    if (typeof val === 'number' && (isNaN(val) || !isFinite(val))) return 0;
    return val;
  };

  const sanitizeArray = (arr: any[]): any[] => {
    if (!Array.isArray(arr)) return [];
    return arr.map(item => {
      if (typeof item === 'object' && item !== null) {
        const cleaned: any = {};
        Object.keys(item).forEach(key => {
          cleaned[key] = sanitizeValue(item[key]);
        });
        return cleaned;
      }
      return sanitizeValue(item);
    });
  };

  const sanitizeData = (obj: any): any => {
    if (obj === null || obj === undefined) return {};
    const cleaned: any = {};
    Object.keys(obj).forEach(key => {
      if (Array.isArray(obj[key])) {
        cleaned[key] = sanitizeArray(obj[key]);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        cleaned[key] = sanitizeData(obj[key]);
      } else {
        cleaned[key] = sanitizeValue(obj[key]);
      }
    });
    return cleaned;
  };

  try {
    const sanitizedData = {
      souke: sanitizeData(data.souke),
      naitei: sanitizeData(data.naitei), 
      metadata: sanitizeData(data.metadata),
      updatedAt: Timestamp.now(),
      version: '1.1' // バージョンアップでキャッシュクリア
    };
    
    console.log('✅ Data sanitized for Firestore:', {
      soukeKeys: Object.keys(sanitizedData.souke || {}),
      naiteiKeys: Object.keys(sanitizedData.naitei || {}),
      naitei2024Daily: sanitizedData.naitei?.daily?.['2024']?.length || 0,
      naitei2025Daily: sanitizedData.naitei?.daily?.['2025']?.length || 0
    });
    
    return sanitizedData;
  } catch (error) {
    console.error('❌ Data sanitization failed:', error);
    throw error;
  }
};

// Firestore から ZentaiChartData に変換
const firestoreToZentaiData = (data: DocumentData): ZentaiChartData => ({
  souke: data.souke || {},
  naitei: data.naitei || { daily: {}, cumulative: {}, weekly: {}, metadata: {} },
  metadata: {
    ...data.metadata,
    lastUpdated: data.updatedAt?.toDate?.()?.toISOString() || data.metadata?.lastUpdated
  }
});

// Zentaiデータキャッシュ保存
export const saveZentaiDataToCache = async (data: ZentaiChartData, userId?: string): Promise<void> => {
  try {
    console.log('🔄 Attempting to save Zentai data to cache...', {
      hasData: !!data,
      hasSouke: !!data?.souke,
      hasNaitei: !!data?.naitei,
      naitei2024Daily: data?.naitei?.daily?.['2024']?.length || 0,
      naitei2025Daily: data?.naitei?.daily?.['2025']?.length || 0
    });
    
    const cacheRef = doc(db, COLLECTIONS.ZENTAI_CACHE, 'latest');
    const firestoreData = zentaiDataToFirestore(data);
    
    if (userId) {
      firestoreData.updatedBy = userId;
    }
    
    console.log('🔄 About to write to Firestore with sanitized data...');
    await setDoc(cacheRef, firestoreData);
    console.log('✅ Zentai data saved to cache successfully');
  } catch (error) {
    console.error('❌❌❌ CRITICAL: Failed to save zentai data to cache:', error);
    
    // TypeScriptの型安全性対応
    const errorDetails = error instanceof Error ? {
      message: error.message,
      name: error.name,
      stack: error.stack
    } : {
      message: String(error),
      name: 'Unknown',
      stack: undefined
    };
    
    console.error('❌ Error details:', errorDetails);
    // エラーでも処理を続行（キャッシュ失敗は致命的ではない）
    console.warn('⚠️ Continuing without cache save...');
  }
};

// Zentaiデータキャッシュ取得
export const getZentaiDataFromCache = async (): Promise<{
  data: ZentaiChartData | null;
  cacheInfo: ZentaiCacheInfo | null;
}> => {
  try {
    const cacheRef = doc(db, COLLECTIONS.ZENTAI_CACHE, 'latest');
    const docSnap = await getDoc(cacheRef);
    
    if (!docSnap.exists()) {
      console.log('⚠️ No zentai cache data found');
      return { data: null, cacheInfo: null };
    }
    
    const docData = docSnap.data();
    const updatedAt = docData.updatedAt?.toDate?.() || new Date(docData.updatedAt);
    const now = new Date();
    const ageInMinutes = (now.getTime() - updatedAt.getTime()) / (1000 * 60);
    
    const cacheInfo: ZentaiCacheInfo = {
      updatedAt: updatedAt.toISOString(),
      ageMinutes: Math.round(ageInMinutes),
      isExpired: ageInMinutes > 1440, // 24時間（1440分）でキャッシュ期限切れ
      updatedBy: docData.updatedBy
    };
    
    const data = firestoreToZentaiData(docData);
    
    console.log(`✅ Zentai cache loaded (age: ${Math.round(ageInMinutes)}min)`);
    return { data, cacheInfo };
    
  } catch (error) {
    console.error('❌ Failed to get zentai data from cache:', error);
    throw error;
  }
};

// Zentaiデータキャッシュ削除
export const clearZentaiDataCache = async (): Promise<boolean> => {
  try {
    const cacheRef = doc(db, COLLECTIONS.ZENTAI_CACHE, 'latest');
    await deleteDoc(cacheRef);
    console.log('✅ Zentai cache cleared');
    return true;
  } catch (error) {
    console.error('❌ Failed to clear zentai cache:', error);
    return false;
  }
};

// Zentaiデータのリアルタイム同期
export const subscribeToZentaiDataUpdates = (
  callback: (data: ZentaiChartData | null, cacheInfo: ZentaiCacheInfo | null) => void
): () => void => {
  const cacheRef = doc(db, COLLECTIONS.ZENTAI_CACHE, 'latest');
  
  const unsubscribe = onSnapshot(cacheRef, (docSnap) => {
    if (docSnap.exists()) {
      const docData = docSnap.data();
      const updatedAt = docData.updatedAt?.toDate?.() || new Date(docData.updatedAt);
      const now = new Date();
      const ageInMinutes = (now.getTime() - updatedAt.getTime()) / (1000 * 60);
      
      const cacheInfo: ZentaiCacheInfo = {
        updatedAt: updatedAt.toISOString(),
        ageMinutes: Math.round(ageInMinutes),
        isExpired: ageInMinutes > 1440, // 24時間（1440分）でキャッシュ期限切れ
        updatedBy: docData.updatedBy
      };
      
      const data = firestoreToZentaiData(docData);
      callback(data, cacheInfo);
    } else {
      callback(null, null);
    }
  }, (error) => {
    console.error('Zentai data subscription error:', error);
    callback(null, null);
  });
  
  return unsubscribe;
}; 
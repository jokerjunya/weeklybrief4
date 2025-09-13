#!/usr/bin/env node

/**
 * Firestore キャッシュコレクション自動作成スクリプト
 * 既存のFirebase Client SDK設定を使用
 * 
 * 実行方法: node scripts/create-firestore-collections.cjs
 */

// Firebase Client SDK (既存設定を使用)
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc, getDoc, serverTimestamp } = require('firebase/firestore');

async function createFirestoreCollections() {
  console.log('🚀 Starting Firestore collections creation...');
  
  try {
    // 既存のFirebase設定を使用 (src/firebase/config.tsと同じ設定)
    const firebaseConfig = {
      apiKey: "AIzaSyDJ5oCi5ylGIfkCS_RvE7FeQNaTQBvGhIQ",
      authDomain: "weekly-brief-2025.firebaseapp.com",
      projectId: "weekly-brief-2025",
      storageBucket: "weekly-brief-2025.firebasestorage.app",
      messagingSenderId: "487940577484",
      appId: "1:487940577484:web:1d6262da34bd9bb98bca69"
    };
    
    console.log('✅ Using Firebase Client SDK for project:', firebaseConfig.projectId);
    
    // Firebase初期化
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    // 1. souke_cache コレクション作成
    console.log('📊 Creating souke_cache collection...');
    const soukeCache = {
      data: {
        daily: {},
        cumulative: {},
        weekly: {}
      },
      metadata: {
        dataSource: 'initial-setup',
        type: 'chart-data',
        lastUpdated: new Date().toISOString()
      },
      updatedAt: serverTimestamp(),
      version: '1.0',
      updatedBy: 'setup-script'
    };
    
    const souleCacheRef = doc(db, 'souke_cache', 'latest');
    await setDoc(souleCacheRef, soukeCache);
    console.log('✅ souke_cache/latest created successfully');
    
    // 2. table_cache コレクション作成
    console.log('📋 Creating table_cache collection...');
    const tableCache = {
      kpi: {
        latest_souke: 0,
        prev_day_souke: 0,
        prev_week_souke: 0,
        prev_year_souke: 0,
        day_growth_rate: null,
        week_growth_rate: null,
        year_growth_rate: null
      },
      channels_overview: [],
      channels_detail: [],
      metadata: {
        dataSource: 'initial-setup',
        type: 'table-data',
        lastUpdated: new Date().toISOString(),
        cacheAge: 0,
        isExpired: true
      },
      updatedAt: serverTimestamp(),
      version: '1.0',
      updatedBy: 'setup-script'
    };
    
    const tableCacheRef = doc(db, 'table_cache', 'latest');
    await setDoc(tableCacheRef, tableCache);
    console.log('✅ table_cache/latest created successfully');
    
    // 3. zentai_cache コレクション作成
    console.log('📈 Creating zentai_cache collection...');
    const zentaiCache = {
      souke: {
        daily: {},
        cumulative: {},
        weekly: {},
        metadata: {
          dataSource: 'initial-setup',
          lastUpdated: new Date().toISOString()
        }
      },
      naitei: {
        daily: {},
        cumulative: {},
        weekly: {},
        metadata: {
          dataSource: 'initial-setup',
          lastUpdated: new Date().toISOString()
        }
      },
      metadata: {
        dataSource: 'initial-setup',
        type: 'zentai-data',
        lastUpdated: new Date().toISOString()
      },
      updatedAt: serverTimestamp(),
      version: '1.0',
      updatedBy: 'setup-script'
    };
    
    const zentaiCacheRef = doc(db, 'zentai_cache', 'latest');
    await setDoc(zentaiCacheRef, zentaiCache);
    console.log('✅ zentai_cache/latest created successfully');
    
    // 4. 作成確認
    console.log('🔍 Verifying created collections...');
    
    const soukeDoc = await getDoc(souleCacheRef);
    const tableDoc = await getDoc(tableCacheRef);
    const zentaiDoc = await getDoc(zentaiCacheRef);
    
    if (soukeDoc.exists() && tableDoc.exists() && zentaiDoc.exists()) {
      console.log('🎉 SUCCESS! All collections created successfully:');
      console.log('   ├── souke_cache/latest ✅');
      console.log('   ├── table_cache/latest ✅');
      console.log('   └── zentai_cache/latest ✅');
      console.log('');
      console.log('📋 Next steps:');
      console.log('   1. Go to WeeklyBrief2 app SoukeReportPage');
      console.log('   2. Click "グラフ更新" button');
      console.log('   3. Click "テーブル更新" button');
      console.log('   4. Check Firebase Console for write operations increase');
      
      process.exit(0);
    } else {
      throw new Error('Failed to verify created documents');
    }
    
  } catch (error) {
    console.error('❌ Error creating Firestore collections:', error);
    console.error('');
    console.error('💡 Troubleshooting:');
    console.error('   1. Make sure Firebase project is accessible');
    console.error('   2. Check internet connection');
    console.error('   3. Verify Firestore database is enabled in Firebase Console');
    process.exit(1);
  }
}

// スクリプト実行
if (require.main === module) {
  createFirestoreCollections();
}

module.exports = { createFirestoreCollections };

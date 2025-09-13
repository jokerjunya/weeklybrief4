# 📊 集客モニタリング動的ページ技術仕様書

## 🎯 **プロジェクト概要**
リクルートエージェント集客モニタリング機能の静的HTML → 動的React+BigQuery システムへの完全刷新

**実装期間**: 2025年1月20日  
**最新重要更新**: 2025年9月10日 - 動的月次表示対応・2024年データ修正  
**技術スタック**: React + TypeScript + Netlify Functions + BigQuery + Firebase Firestore + Chart.js

---

## 🏗️ **システム構成**

### **🖥️ フロントエンド**
- **React 18** (TypeScript)
- **Vite** (ビルドツール)
- **TailwindCSS** (スタイリング)
- **iframe通信** (レガシーHTML統合)

### **⚡ バックエンド**
- **Netlify Functions** (サーバーレス)
- **Google Cloud BigQuery** (データウェアハウス)
- **Firebase Firestore** (キャッシュストレージ)
- **Firebase Admin SDK** (認証・データベース)

### **📊 データ可視化**
- **Chart.js 4.4** (グラフライブラリ)
- **動的HTML更新** (iframe postMessage API)

---

## 🚀 **機能実装**

### **1. グラフ動的更新機能**
```
React Component → Netlify Functions → BigQuery → データ処理 → Firebase Cache → Chart.js更新
```

**実装ファイル**:
- `netlify/functions/update-souke-data.js` - BigQueryデータ取得・処理
- `src/firebase/database.ts` - Firebaseキャッシュ管理（Client SDK）
- `src/pages/SoukeReportPage.tsx` - React UI制御・統合更新機能
- `public/protected-reports/souke_chart_report.html` - Chart.js実装

### **2. KPI・チャネル別実績テーブル機能**
```
React Component → get-table-data.js → BigQuery → 3種類のテーブル更新
```

**テーブル種類**:
- 📈 **総受数動向** (前日比・前週比・前年比)
- 📊 **チャネル大分類** (オーガニック・有料広告・その他)
- 📊 **チャネル詳細分類** (リスティング指名/非指名、SEO、Indeed等)

**実装ファイル**:
- `netlify/functions/get-table-data.js` - テーブルデータ取得
- `src/firebase/database.ts` - テーブルキャッシュ管理（Client SDK）
- `netlify/functions/utils/query-definitions.js` - BigQueryクエリ定義
- `netlify/functions/utils/data-processor.js` - データ変換処理

### **3. 統合データ更新機能**
```
1つのボタン → グラフ＋テーブル並行更新 → Firestore Client SDK保存
```

**特徴**:
- **並行処理**: `Promise.all()`でグラフ・テーブル同時取得
- **統合UI**: 1クリックで全データ更新
- **24時間キャッシュ**: 有効期限延長でパフォーマンス向上
- **フロントエンド保存**: Firebase Client SDKで認証問題回避

### **4. Firebaseキャッシュシステム**
```
Firestore Collections:
├── souke_cache/latest      (グラフデータ・30分キャッシュ)
└── table_cache/latest      (テーブルデータ・120分キャッシュ)
```

**キャッシュ機能**:
- ✅ チーム間データ共有
- ✅ 即座表示（前回データから開始）
- ✅ BigQuery実行頻度削減

---

## 🔧 **BigQueryクエリ実装**

### **データソース**
- `dharma-dwh-rag.datamart.t_rag_jobseeker_all` (メインテーブル)
- `dharma-dwh-rag.agent_resource_new.t_rag_adplan_info` (広告プラン)
- `dharma-dwh-rag.aa_rag_prt.sc_raw_datafeed_sc0197` (イベントトラッキング)

### **複雑なビジネスロジック**
```sql
-- 動的日付計算
DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY) as prev_day

-- PDT2除外処理
WHERE entry_start_type != "pdt1db_to_pdt2_entry_form"

-- VOSコード判定
CASE WHEN media_cd = '878' AND event_vos LIKE 'ev%' THEN "RAG有料集客"

-- チャネル分類ロジック（40+ルール）
CASE 
  WHEN channel_middle_category_nm = "リスティング" AND channel_small_category_nm = "ブランド" THEN "リスティング_指名"
  WHEN channel_small_category_nm LIKE "%Indeed%" THEN "Indeed"
  ELSE channel_middle_category_nm
END
```

---

## 🛡️ **セキュリティ**

### **認証システム**
```typescript
// カスタム認証トークン
const token = `custom-auth-${user.id}`;

// Netlify Functions内での認証チェック
if (!authHeader || !authHeader.startsWith('custom-auth-')) {
  return { statusCode: 401, body: 'Authentication required' };
}
```

### **環境変数管理**
```bash
# Netlify Environment Variables
GOOGLE_APPLICATION_CREDENTIALS_JSON="{"type":"service_account",...}"
GOOGLE_CLOUD_PROJECT="dharma-dwh-rag"
FIREBASE_PROJECT_ID="weekly-brief-2025"
```

---

## 📂 **プロジェクト構造**

```
weeklybrief2/
├── src/
│   ├── pages/SoukeReportPage.tsx        # メインReactコンポーネント
│   ├── firebase/database.ts             # Firebase操作
│   └── types/souke.ts                   # TypeScript型定義
├── netlify/functions/
│   ├── update-souke-data.js             # グラフデータ更新
│   ├── get-table-data.js                # テーブルデータ更新
│   └── utils/
│       ├── bigquery-client.js           # BigQuery接続
│       ├── query-definitions.js         # クエリ定義 (1400+行)
│       └── data-processor.js            # データ変換処理
├── public/protected-reports/
│   └── souke_chart_report.html          # Chart.js + HTML
└── DEPLOY_DEBUG_LOG.md                  # 実装履歴・トラブルシューティング
```

---

## 🐛 **トラブルシューティング**

### **よくある問題**

#### 1. **Netlifyビルドエラー**
```bash
# 解決方法: devDependencies → dependencies移行
npm install typescript @types/react vite --save
```

#### 2. **BigQueryDate型エラー**
```javascript
// 解決方法: サニタイズ処理追加
const sanitizeForFirestore = (obj) => {
  // BigQueryDate → String変換
};
```

#### 3. **iframe通信エラー**
```javascript
// 解決方法: postMessage APIを使用
parent.postMessage({ type: 'UPDATE_CHART_DATA', data }, '*');
```

### **詳細ログ確認**
- Netlify Functions: `/.netlify/functions/function-name`
- Firestore: Firebase Console → Firestore Database
- BigQuery: Google Cloud Console → BigQuery

---

## 📈 **パフォーマンス指標**

### **実行時間**
- BigQuery実行: 8-12秒
- Firestore読み込み: 0.5-1秒
- 初期表示: 1.5秒（キャッシュ有効時）

### **データサイズ**
- グラフデータ: ~50KB
- テーブルデータ: ~20KB
- 合計転送量: ~70KB

---

## 🔄 **今後の拡張**

### **完了機能（2025年9月）**
- [x] 動的月次表示（今月対前年比較）
- [x] 2024年データ表示修正（年判定バグ解決）
- [x] Firestore書き込みエラー対応
- [x] コード品質向上（250行以上クリーンアップ）

### **予定機能**
- [ ] リアルタイムデータ更新（WebSocket）
- [ ] モバイル最適化強化
- [ ] エクスポート機能（Excel, PDF）
- [ ] アラート機能（閾値監視）

### **技術的改善**
- [ ] TypeScript strict mode
- [ ] Jest単体テスト実装
- [ ] CI/CD パイプライン強化
- [ ] ログ監視システム

---

**最終更新**: 2025年9月10日  
**主要修正**: 動的月次表示対応、2024年データ表示修正、コード品質向上  
**メンテナンス担当**: 開発チーム

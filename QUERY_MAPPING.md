# 📊 グラフとクエリの対応マップ

## 🎯 **データ更新ボタンの動作フロー**

**データ更新ボタン**を押すと、以下の流れで各グラフが更新されます：

### 1. 全体モニタリング（ZentaiMonitoringPage）
**更新ボタン**: `handleUpdateChartData()` → `/.netlify/functions/update-souke-data`

| グラフ名 | クエリ関数 | 定義ファイル | 行数 |
|----------|------------|--------------|------|
| **デイリー総受推移** | `getSoukeChartDataQuery()` | `query-definitions.js` | 18-224行 |
| **累計総受推移** | `getSoukeChartDataQuery()` | `query-definitions.js` | 18-224行 |  
| **週次総受推移** | `getSoukeChartDataQuery()` | `query-definitions.js` | 18-224行 |
| **デイリー内定数推移** | `getNaiteiDailyDataQuery()` | `query-definitions.js` | 728-800行 |
| **累計内定数推移** | `getNaiteiCumulativeDataQuery()` | `query-definitions.js` | 806-892行 |
| **週次内定数推移** | `getNaiteiWeeklyDataQuery()` | `query-definitions.js` | 653-723行 |

### 2. 集客モニタリング（SoukeReportPage）
**更新ボタン**: `handleUpdateAllData()` → 複数のNetlify Functions

#### グラフ更新
- `/.netlify/functions/update-souke-data` を使用（全体モニタリングと同じクエリ）

#### テーブル更新 
**テーブル更新ボタン**: `handleUpdateTableData()` → `/.netlify/functions/get-table-data`

| テーブル名 | クエリ関数 | 定義ファイル | 行数 |
|------------|------------|--------------|------|
| **KPI実績テーブル** | `getKpiData()` | `get-table-data.js` | 160-272行 |
| **チャネル大分類テーブル** | `getSoukeChannelOverviewQuery()` | `query-definitions.js` | 284-446行 |
| **チャネル詳細分類テーブル** | `getSoukeChannelDetailQuery()` | `query-definitions.js` | 452-648行 |

## 🔍 **クエリの確認・修正方法**

### ✅ **1. 特定グラフのクエリを確認したい場合**

```bash
# 例：日次内定数グラフのクエリを確認
# → netlify/functions/utils/query-definitions.js の 728-800行目を確認
grep -n "getNaiteiDailyDataQuery" netlify/functions/utils/query-definitions.js
```

### ✅ **2. クエリを修正したい場合**

1. **該当ファイルを修正**
   ```bash
   # 例：内定数の期間を変更したい
   vim netlify/functions/utils/query-definitions.js
   # → 741行目: DATE('2024-05-27') を別の日付に変更
   ```

2. **デプロイ**
   ```bash
   git add .
   git commit -m "Fix naitei query date range" 
   git push  # Netlifyで自動デプロイ
   ```

3. **確認**
   - 全体モニタリングページで「**グラフ更新**」ボタンをクリック
   - **すぐに修正が反映されます** ✨

### ✅ **3. どのグラフが更新されるかの確認**

| ボタン | 対象グラフ |
|--------|------------|
| **グラフ更新**（全体モニタリング） | 6つのグラフすべて |
| **グラフ更新**（集客モニタリング） | 3つの総受グラフ |
| **テーブル更新**（集客モニタリング） | 3つのテーブル |

## 🚀 **クイックチェック機能**

### **特定のクエリだけテストしたい場合**
```javascript
// netlify/functions/utils/query-definitions.js に追加可能
const debugQuery = (queryName) => {
  switch (queryName) {
    case 'souke':
      console.log('📋 Souke Chart Query:', getSoukeChartDataQuery());
      break;
    case 'naitei-daily':
      console.log('📋 Naitei Daily Query:', getNaiteiDailyDataQuery());
      break;
    // 他のクエリも同様...
  }
};
```

## ⚠️ **重要なポイント**

### **動的表示対応完了** 
- **月次表示**: 「8月対前年比」→「今月対前年比」に自動更新
- **期間表示**: 「6-8月」→「直近3ヶ月」に自動更新  
- **x軸ラベル**: 8月固定→現在月動的生成に対応

### **2024年データ表示修正**
- **年判定バグ修正**: キーの年（2025）とデータの年（2024）の混同解決
- **前年データ取得**: lastYearフィールドの正しい処理
- **期間設定独立化**: 2024年データの完全独立取得

### **修正範囲の把握**
- **1つのグラフの問題** → 該当するクエリ関数のみ修正
- **期間設定の問題** → 各クエリが動的期間設定に対応済み
- **データ処理の問題** → processNaiteiData関数内の年判定ロジック

### **テスト方法**
1. **Netlify Functions ローカルテスト**
   ```bash
   npm run dev:functions
   # → http://localhost:8888/.netlify/functions/update-souke-data でテスト
   ```

2. **本番デプロイ後の確認**
   - ブラウザの開発者ツールでネットワークタブを確認
   - 正しいデータが返っているかをチェック

## 🎯 **今後の改善予定**

現在作成した新しいクエリ管理システムを導入すると：

### **Before（現在）**
```bash
# 問題: 同じ期間設定が複数箇所で重複
vim netlify/functions/utils/query-definitions.js +741  # 内定数の期間
vim netlify/functions/utils/query-definitions.js +28   # 総受の期間
vim netlify/functions/utils/query-definitions.js +294  # チャネルの期間
# → 3箇所を別々に修正する必要がある
```

### **After（新システム導入後）**
```bash
# 改善: 設定ファイル1箇所の修正で全クエリに反映
vim netlify/functions/utils/query-config.js +20
# → 1箇所修正するだけで全グラフに反映
```

---

## 🎉 **最新修正状況（2025年9月10日）**

### **解決済み問題**
- ✅ **9月固定値問題**: 「8月対前年比」→「今月対前年比」動的表示
- ✅ **2024年データ不表示**: 年判定バグ修正により正常表示  
- ✅ **x軸ラベル固定**: 8月固定→現在月動的生成
- ✅ **Firestore書き込みエラー**: データサニタイズ強化で解決

### **コード品質向上**
- ✅ **250行以上のクリーンアップ**: 冗長なデバッグコード削除
- ✅ **クエリ構造統一**: 週次の成功パターンを日次・累計に適用
- ✅ **保守性改善**: より読みやすく管理しやすいコード構造

**結論：全ての内定数グラフが正常動作し、9月以降も自動対応できるようになりました！** ✅

# KPI ダッシュボード - Cloud Run 移行版

Firebase Hosting + Cloud Run + BigQuery 構成の経営ダッシュボードです。

## 🏗️ アーキテクチャ

```
Firebase Hosting → Cloud Run (Node.js/Express) → BigQuery (asia-northeast1)
     ↑                    ↑                          ↑
フロントエンド       Firebase Auth認証           KPIデータ取得
(React/Vite)       IDトークン検証              5GB制限付き
```

## 🚀 デプロイ手順

### 1. 事前準備

```bash
# Google Cloud CLI 認証
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Firebase CLI インストール・ログイン
npm install -g firebase-tools
firebase login
```

### 2. Cloud Run デプロイ

```bash
# Cloud Run用ディレクトリ作成
mkdir cloud-run && cd cloud-run
cp ../server.js ../Dockerfile ../package-cloud-run.json ./package.json .

# 依存関係インストール
npm install

# Docker イメージビルド・デプロイ
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/bq-proxy
gcloud run deploy bq-proxy \
  --image gcr.io/YOUR_PROJECT_ID/bq-proxy \
  --region asia-northeast1 \
  --platform managed \
  --allow-unauthenticated=false \
  --max-instances=10 \
  --memory=1Gi \
  --cpu=1 \
  --timeout=60s \
  --port=8080
```

### 3. 環境変数設定

```bash
# Secret Manager 作成
gcloud secrets create firebase-service-account-key --data-file=./service-account-key.json
gcloud secrets create google-application-credentials --data-file=./bigquery-service-account.json

# Cloud Run環境変数設定
gcloud run services update bq-proxy \
  --region asia-northeast1 \
  --set-env-vars="FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID" \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=YOUR_GCP_PROJECT_ID" \
  --set-env-vars="NODE_ENV=production" \
  --update-secrets="FIREBASE_SERVICE_ACCOUNT_KEY=firebase-service-account-key:latest" \
  --update-secrets="GOOGLE_APPLICATION_CREDENTIALS_JSON=google-application-credentials:latest"
```

### 4. IAM 権限設定

#### Cloud Run サービスアカウント権限
```bash
# Cloud Run サービスアカウント取得
SERVICE_ACCOUNT=$(gcloud run services describe bq-proxy --region=asia-northeast1 --format="value(spec.template.spec.serviceAccountName)")

# BigQuery 権限付与
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/bigquery.jobUser"

# データセット閲覧権限付与（実際のデータセット名に変更）
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/bigquery.dataViewer"
```

#### Firebase Hosting → Cloud Run接続権限
```bash
# Firebase Hosting用サービスアカウント取得
HOSTING_SA="firebase-adminsdk-xxxxx@YOUR_PROJECT_ID.iam.gserviceaccount.com"

# Cloud Run Invoker権限付与
gcloud run services add-iam-policy-binding bq-proxy \
  --region=asia-northeast1 \
  --member="serviceAccount:${HOSTING_SA}" \
  --role="roles/run.invoker"
```

### 5. Firebase Hosting デプロイ

```bash
# フロントエンドビルド
npm run build

# firebase.json 設定確認
cat firebase.json
# rewrites の serviceId が 'bq-proxy' になっていることを確認

# Firebase Hosting デプロイ  
firebase deploy --only hosting
```

## 🔧 ローカル開発

### Cloud Run API ローカル起動

```bash
# 環境変数設定（.env.localに実際の値を設定）
export FIREBASE_PROJECT_ID=your-firebase-project-id
export FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
export GOOGLE_CLOUD_PROJECT=your-gcp-project-id  
export GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account",...}'
export NODE_ENV=development
export PORT=8080

# サーバー起動
cd cloud-run && node server.js

# 別ターミナルでテスト
curl -X POST http://localhost:8080/api/health
```

### フロントエンド ローカル起動

```bash
# 開発サーバー起動（Cloud Run APIと連携）
npm run dev

# ブラウザで http://localhost:5173 にアクセス
```

## 🔐 Firebase Auth 設定

### 1. Firebase Console設定

1. **Authentication** → **Sign-in method** → **Email/Password** を有効化
2. **Users** タブでダッシュボード用ユーザーを作成
3. **Project Settings** → **Service accounts** からサービスアカウントキーをダウンロード

### 2. フロントエンド認証フロー

```javascript
// ログイン
await login("user@example.com", "password");

// API呼び出し時に自動でIDトークン付与
const response = await fetch('/api/run-kpi', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${await getIdToken()}`
  },
  body: JSON.stringify({ start: '2025-01-01', end: '2025-12-31', bu: 'ALL' })
});
```

## 📊 BigQuery データ仕様

### データセット・テーブル構造

```sql
-- リージョン: asia-northeast1 統一
-- データセット: dharma-dwh-rag.datamart
-- メインテーブル: t_rag_jobseeker_all

-- 想定スキーマ（実際の構造に合わせて調整）
CREATE TABLE `PROJECT.DATASET.kpi_daily` (
  date DATE,
  business_unit STRING,
  metric STRING, 
  value INT64
)
PARTITION BY date
CLUSTER BY business_unit
OPTIONS(
  location="asia-northeast1"
);
```

### BUホワイトリスト

```javascript
const VALID_BUSINESS_UNITS = [
  'ALL',           // 全BU対象
  'ENGINEER',      // エンジニア採用  
  'SALES',         // 営業採用
  'CORPORATE',     // コーポレート
  'CS',            // カスタマーサクセス
  'MARKETING'      // マーケティング
];
```

## 🛡️ セキュリティ機能

### 1. 認証・認可
- Firebase Auth IDトークン検証（audience確認）
- Cloud Run は認証必須（--allow-unauthenticated=false）
- Firebase Hosting経由でのみアクセス可能

### 2. クエリ制御
- **Dry-run見積**: クエリ実行前に必ずスキャン量チェック
- **5GB制限**: maximumBytesBilled で課金上限設定
- **60秒タイムアウト**: 長時間クエリの防止
- **パラメータ検証**: 日付形式・BUホワイトリスト

### 3. 構造化ログ

```javascript
// 成功ログ例
{
  "timestamp": "2025-01-15T10:30:00.000Z",
  "level": "INFO", 
  "message": "POST /api/run-kpi SUCCESS",
  "duration_ms": 2340,
  "rows_returned": 1250,
  "job_id": "job_xxx", 
  "bytes_processed": 1048576,
  "user": "firebase_uid_123"
}
```

## 💰 課金監視設定

### 1. Billing Budget作成

```bash
# BigQuery用予算アラート（月額10,000円）
gcloud billing budgets create \
  --billing-account=YOUR_BILLING_ACCOUNT \
  --display-name="BigQuery KPI Dashboard Budget" \
  --budget-amount=10000JPY \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90 \
  --threshold-rule=percent=100
```

### 2. Cloud Monitoring アラート

```yaml
# BigQuery スロット使用量監視
displayName: "BigQuery Slot Usage - KPI Dashboard"  
conditions:
  - displayName: "Slot usage over 1000"
    conditionThreshold:
      filter: 'resource.type="bigquery_project" AND resource.label.project_id="YOUR_PROJECT"'
      comparison: COMPARISON_GREATER_THAN
      thresholdValue: 1000
```

## 🚨 Dry-run 見積機能

### フロントエンド警告表示

```javascript
// API レスポンス例（閾値超過時）
{
  "success": false,
  "error": "Query exceeds maximum scan limit (5GB)",
  "estimated_gb": 7.2,
  "limit_gb": 5.0
}

// フロントエンドで警告表示
if (!response.ok && response.status === 413) {
  const data = await response.json();
  alert(`⚠️ クエリのスキャン量が上限を超えています\n見積: ${data.estimated_gb}GB / 上限: ${data.limit_gb}GB`);
}
```

### 見積精度向上

```sql
-- パーティション プルーニング活用
WHERE date BETWEEN @start_date AND @end_date
-- 不要なカラム除外  
SELECT date, business_unit, metric, value  -- SELECT * 避ける
-- 早期フィルタリング
WHERE business_unit = @bu AND date >= @start_date
```

## 🔄 デプロイコマンド一覧

```bash
# === Cloud Run デプロイ ===
gcloud builds submit --tag gcr.io/PROJECT/bq-proxy
gcloud run deploy bq-proxy --image gcr.io/PROJECT/bq-proxy --region asia-northeast1

# === Firebase Hosting デプロイ ===  
npm run build
firebase deploy --only hosting

# === 設定更新 ===
gcloud run services update bq-proxy --region asia-northeast1 --set-env-vars="KEY=VALUE"

# === ログ確認 ===
gcloud run services logs read bq-proxy --region asia-northeast1 --limit=50

# === 動作確認 ===
curl -X GET "https://YOUR_HOSTING_DOMAIN/api/health"
```

## 📋 トラブルシューティング

### よくある問題

1. **認証エラー**: Firebase Auth設定・サービスアカウントキーを確認
2. **CORS エラー**: Cloud Run の CORS設定を確認
3. **BigQuery権限エラー**: IAM権限（bigquery.jobUser等）を確認  
4. **タイムアウト**: Cloud Run のタイムアウト設定・BigQueryクエリ最適化
5. **課金急増**: Dry-run見積機能・Budget設定を確認

### ログ確認コマンド

```bash
# Cloud Run ログ
gcloud run services logs read bq-proxy --region asia-northeast1

# BigQuery ジョブ履歴
bq ls -j --max_results=10 --location=asia-northeast1

# Firebase Hosting ログ  
firebase functions:log
```

---

## 📝 環境変数テンプレート

```bash
# Cloud Run Environment Variables
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"your-project-id",...}
GOOGLE_CLOUD_PROJECT=your-gcp-project-id  
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account","project_id":"your-project-id",...}
NODE_ENV=production
PORT=8080

# 🚨 重要: 実際の秘密情報は絶対にコミットしない
# 本番環境では gcloud secrets create で管理
# Cloud Run環境変数として注入
```

**🎯 移行完了！Netlify Functions → Cloud Run + Firebase Hosting 構成でよりスケーラブルで安全なKPIダッシュボードが実現できました。**
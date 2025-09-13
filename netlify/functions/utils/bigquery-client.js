const { BigQuery } = require('@google-cloud/bigquery');

/**
 * BigQuery クライアントクラス
 * 環境変数から認証情報を取得してクライアントを初期化
 */
class BigQueryClientWrapper {
  constructor() {
    this.client = null;
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT || 'dharma-dwh-rag';
    this.isInitialized = false;
  }

  /**
   * クライアント初期化
   */
  async initialize() {
    if (this.isInitialized) {
      return this.client;
    }

    try {
      console.log('🔍 BigQuery authentication debug:');
      console.log('Project ID:', this.projectId);
      console.log('GOOGLE_APPLICATION_CREDENTIALS_JSON exists:', !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
      console.log('GOOGLE_APPLICATION_CREDENTIALS exists:', !!process.env.GOOGLE_APPLICATION_CREDENTIALS);
      
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
        console.log('GOOGLE_APPLICATION_CREDENTIALS_JSON length:', process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON.length);
        console.log('GOOGLE_APPLICATION_CREDENTIALS_JSON starts with:', process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON.substring(0, 50) + '...');
      }

      // 環境変数から認証情報を設定
      const options = {
        projectId: this.projectId
      };

      // サービスアカウントキーが環境変数にある場合
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
        console.log('🔑 Using GOOGLE_APPLICATION_CREDENTIALS_JSON');
        try {
          const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
          console.log('✅ JSON parsing successful');
          console.log('Credentials type:', credentials.type);
          console.log('Credentials client_email:', credentials.client_email ? credentials.client_email.substring(0, 20) + '...' : 'NOT_FOUND');
          options.credentials = credentials;
        } catch (jsonError) {
          console.error('❌ Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:', jsonError.message);
          throw new Error(`認証JSON解析エラー: ${jsonError.message}`);
        }
      }
      // または、キーファイルパスが設定されている場合
      else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        console.log('🔑 Using GOOGLE_APPLICATION_CREDENTIALS file path');
        options.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      }
      else {
        console.warn('⚠️ No Google Cloud credentials found in environment variables');
        console.log('Available environment variables:', Object.keys(process.env).filter(key => key.includes('GOOGLE') || key.includes('CLOUD')));
      }

      console.log('🚀 Creating BigQuery client...');
      this.client = new BigQuery(options);
      this.isInitialized = true;

      console.log(`✅ BigQuery client initialized for project: ${this.projectId}`);
      return this.client;
    } catch (error) {
      console.error('❌ Failed to initialize BigQuery client:', error);
      throw new Error(`BigQuery初期化エラー: ${error.message}`);
    }
  }

  /**
   * クエリ実行
   * @param {string} query - 実行するSQL
   * @param {Object} options - クエリオプション
   */
  async executeQuery(query, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    
    try {
      console.log('📊 Executing BigQuery...');
      console.log('Query length:', query.length, 'characters');

      const [job] = await this.client.createQueryJob({
        query,
        location: 'US', // または 'us-central1'
        jobTimeoutMs: options.timeoutMs || 30000, // 30秒タイムアウト
        ...options
      });

      console.log(`🔄 Job created: ${job.id}`);

      const [rows] = await job.getQueryResults();
      const duration = Date.now() - startTime;

      console.log(`✅ Query completed in ${duration}ms, ${rows.length} rows returned`);
      return rows;

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ BigQuery error after ${duration}ms:`, error.message);
      
      // エラーの詳細ログ
      if (error.code) {
        console.error('Error code:', error.code);
      }
      if (error.errors) {
        console.error('Error details:', JSON.stringify(error.errors, null, 2));
      }

      throw new Error(`BigQueryクエリエラー: ${error.message}`);
    }
  }

  /**
   * ヘルスチェック用の軽量クエリ
   */
  async healthCheck() {
    try {
      const rows = await this.executeQuery('SELECT 1 as health_check', { timeoutMs: 5000 });
      return rows.length > 0 && rows[0].health_check === 1;
    } catch (error) {
      console.error('BigQuery health check failed:', error);
      return false;
    }
  }

  /**
   * 接続テスト用のプロジェクト情報取得
   */
  async getProjectInfo() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const [datasets] = await this.client.getDatasets();
      return {
        projectId: this.projectId,
        datasetsCount: datasets.length,
        connected: true
      };
    } catch (error) {
      console.error('Failed to get project info:', error);
      return {
        projectId: this.projectId,
        connected: false,
        error: error.message
      };
    }
  }
}

// シングルトンインスタンス
let instance = null;

/**
 * BigQueryクライアントのシングルトンインスタンスを取得
 */
const getBigQueryClient = () => {
  if (!instance) {
    instance = new BigQueryClientWrapper();
  }
  return instance;
};

module.exports = {
  BigQueryClientWrapper,
  getBigQueryClient
};

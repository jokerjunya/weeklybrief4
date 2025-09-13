# Cloud Run用Dockerfile
# Node.js 18 LTS使用（Cloud Run推奨）

FROM node:18-slim

# 作業ディレクトリ設定
WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係インストール（プロダクション用）
RUN npm ci --only=production && npm cache clean --force

# アプリケーションファイルをコピー
COPY server.js .

# 非rootユーザーで実行（セキュリティ向上）
RUN useradd -r -s /bin/false nodeuser && chown -R nodeuser:nodeuser /app
USER nodeuser

# ポート8080を公開（Cloud Run要求）
EXPOSE 8080

# ヘルスチェック設定
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/api/health || exit 1

# アプリケーション起動
CMD ["node", "server.js"]

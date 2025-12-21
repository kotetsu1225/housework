# ==========================================
# Stage 1: Build
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# パッケージファイルをコピー
COPY package.json package-lock.json* ./

# 依存関係のインストール
RUN npm ci

# ソースコードをコピー
COPY . .

# プロダクションビルド
RUN npm run build

# ==========================================
# Stage 2: Production (nginx)
# ==========================================
FROM nginx:alpine

# nginxの設定をコピー
COPY nginx.conf /etc/nginx/conf.d/default.conf

# ビルド成果物をコピー
COPY --from=builder /app/dist /usr/share/nginx/html

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

# ポート公開
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

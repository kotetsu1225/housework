# ==========================================
# Stage 1: Build
# ==========================================
FROM gradle:8.5-jdk17 AS builder

WORKDIR /app

# Gradleのキャッシュを活用するため、依存関係ファイルを先にコピー
COPY build.gradle.kts settings.gradle.kts ./
# COPY gradle ./gradle

# 依存関係のダウンロード（キャッシュ効率化）
RUN gradle dependencies --no-daemon || true

# ソースコードをコピー
COPY src ./src
COPY db ./db

# アプリケーションをビルド
RUN gradle shadowJar -x flywayMigrate --no-daemon -x generateJooq --no-daemon

# ==========================================
# Stage 2: Runtime
# ==========================================
FROM eclipse-temurin:17-jre
#
# Install minimal utilities required by HEALTHCHECK (wget)
# Note: run as root before switching to non-root user.
RUN apt-get update && apt-get install -y --no-install-recommends wget ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# セキュリティ: 非rootユーザーで実行
# -r はシステムユーザーを作成するオプション、-g はグループを指定するオプションです
RUN groupadd -r appgroup && useradd -r -g appgroup appuser
USER appuser

# ビルド成果物をコピー
COPY --from=builder /app/build/libs/*-all.jar app.jar

# マイグレーションファイルをコピー
COPY --from=builder /app/db ./db

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
 CMD wget -qO- http://localhost:8080/health > /dev/null || exit 1

# ポート公開
EXPOSE 8080

# アプリケーション起動
ENTRYPOINT ["java", "-jar", "app.jar"]

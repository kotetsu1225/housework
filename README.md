# Housework - 家庭タスク管理アプリケーション

家族間での家事分担を効率化するためのタスク管理アプリケーションです。

## 技術スタック

### バックエンド
- **Kotlin** - JVM 21
- **Ktor 2.3.7** - HTTPサーバーフレームワーク
- **jOOQ 3.18.7** - 型安全なSQLクエリビルダー
- **Guice 7.0.0** - 依存性注入
- **Flyway 9.22.3** - データベースマイグレーション
- **HikariCP 5.1.0** - コネクションプール
- **PostgreSQL 16** - データベース

### フロントエンド
- **React 18** - UIフレームワーク
- **TypeScript 5.2** - 型安全なJavaScript
- **Vite 5** - ビルドツール
- **Tailwind CSS 3.4** - スタイリング

### インフラ
- **Docker Compose** - コンテナオーケストレーション
- **PostgreSQL 16 Alpine** - データベースコンテナ
- **nginx** - フロントエンド静的ファイルサーバー

---

## クイックスタート

### 前提条件
- Docker Desktop がインストールされていること
- Docker Compose がインストールされていること

### 起動手順

```bash
# 1. リポジトリをクローン
git clone <repository-url>
cd housework

# 2. 全サービスを起動（バックグラウンド）
docker-compose up -d

# 3. 起動確認
docker-compose ps
```

### アクセスURL
| サービス | URL |
|---------|-----|
| フロントエンド | http://localhost:3000 |
| バックエンドAPI | http://localhost:8080 |
| ヘルスチェック | http://localhost:8080/health |
| PostgreSQL | localhost:5432 |

---

## Docker コマンド一覧

### 基本操作

```bash
# 全サービス起動（バックグラウンド）
docker-compose up -d

# 全サービス停止
docker-compose down

# 全サービス停止 + ボリューム削除（データ初期化）
docker-compose down -v

# コンテナ状態確認
docker-compose ps

# 全サービスのログ表示（フォロー）
docker-compose logs -f

# 特定サービスのログ表示
docker-compose logs -f backend
docker-compose logs -f postgres
docker-compose logs -f frontend
```

### ビルド操作

```bash
# 全サービスをビルド
docker-compose build

# 特定サービスをビルド
docker-compose build backend
docker-compose build frontend

# キャッシュなしでビルド（依存関係更新時）
docker-compose build --no-cache

# ビルドして起動
docker-compose up -d --build
```

### 個別サービス操作

```bash
# データベースのみ起動
docker-compose up -d postgres

# バックエンドのみ再起動
docker-compose restart backend

# 特定サービス停止
docker-compose stop backend
```

### デバッグ・トラブルシューティング

```bash
# バックエンドコンテナにシェル接続
docker exec -it housework-backend /bin/sh

# データベースに直接接続
docker exec -it housework-db psql -U housework -d housework

# テーブル一覧確認
docker exec housework-db psql -U housework -d housework -c "\dt"

# Flywayマイグレーション履歴確認
docker exec housework-db psql -U housework -d housework -c "SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank;"

# コンテナ内のファイル確認
docker exec housework-backend ls -la /app/db/migration/

# リソース使用状況確認
docker stats
```

---

## API エンドポイント

### ヘルスチェック
```bash
# ヘルス確認
curl http://localhost:8080/health
# レスポンス: ok
```

### メンバー管理

```bash
# メンバー一覧取得
curl http://localhost:8080/api/member

# 特定メンバー取得
curl http://localhost:8080/api/member/{memberId}

# メンバー作成
curl -X POST http://localhost:8080/api/member/create \
  -H "Content-Type: application/json" \
  -d '{"name":"田中太郎","familyRole":"FATHER"}'

# メンバー更新
curl -X POST http://localhost:8080/api/member/{memberId}/update \
  -H "Content-Type: application/json" \
  -d '{"name":"田中花子","familyRole":"MOTHER"}'
```

### タスク定義管理

```bash
# タスク定義一覧取得（ページネーション対応）
curl "http://localhost:8080/api/task-definitions?limit=20&offset=0"

# 特定タスク定義取得
curl http://localhost:8080/api/task-definitions/{taskDefinitionId}

# タスク定義作成（繰り返しタスク）
curl -X POST http://localhost:8080/api/task-definitions/create \
  -H "Content-Type: application/json" \
  -d '{
    "name":"掃除機がけ",
    "description":"リビングと廊下の掃除機がけ",
    "estimatedMinutes":30,
    "scope":"FAMILY",
    "schedule":{
      "type":"Recurring",
      "pattern":{"type":"Weekly","dayOfWeek":"MONDAY"},
      "startDate":"2024-01-01",
      "endDate":null
    }
  }'

# タスク定義作成（単発タスク）
curl -X POST http://localhost:8080/api/task-definitions/create \
  -H "Content-Type: application/json" \
  -d '{
    "name":"年末大掃除",
    "description":"リビング・キッチン・浴室の大掃除",
    "estimatedMinutes":180,
    "scope":"FAMILY",
    "schedule":{
      "type":"OneTime",
      "deadline":"2024-12-31"
    }
  }'

# タスク定義更新
curl -X POST http://localhost:8080/api/task-definitions/{taskDefinitionId}/update \
  -H "Content-Type: application/json" \
  -d '{"name":"掃除機がけ（週2回）","estimatedMinutes":20}'

# タスク定義削除（論理削除）
curl -X POST http://localhost:8080/api/task-definitions/{taskDefinitionId}/delete
```

### メンバー空き時間管理

```bash
# メンバー別空き時間一覧取得
curl http://localhost:8080/api/member-availabilities/member/{memberId}

# 空き時間作成
curl -X POST http://localhost:8080/api/member-availabilities/create \
  -H "Content-Type: application/json" \
  -d '{
    "memberId":"<member-uuid>",
    "targetDate":"2024-01-15",
    "slots":[
      {"startTime":"09:00","endTime":"12:00","memo":"午前中空き"},
      {"startTime":"14:00","endTime":"17:00","memo":null}
    ]
  }'
```

---

## データベース

### 接続情報
| 項目 | 値 |
|-----|-----|
| Host | localhost |
| Port | 5432 |
| Database | housework |
| User | housework |
| Password | housework_password |

### テーブル構成
| テーブル名 | 説明 |
|-----------|------|
| members | 家族メンバー |
| member_availabilities | メンバーの空き時間 |
| time_slots | 空き時間スロット |
| task_definitions | タスク定義（テンプレート） |
| task_recurrences | 繰り返しスケジュール設定 |
| task_executions | タスク実行インスタンス |
| task_snapshots | タスク実行時のスナップショット |
| flyway_schema_history | マイグレーション履歴 |

### マイグレーション
マイグレーションは**アプリケーション起動時に自動実行**されます。

手動でマイグレーションを実行する場合：
```bash
# ローカル開発環境（要PostgreSQL起動）
cd backend
./gradlew flywayMigrate
```

---

## ローカル開発

### バックエンド

```bash
cd backend

# 依存関係のインストールとビルド
./gradlew build

# アプリケーション実行（PostgreSQL要起動）
./gradlew run

# Fat JAR作成
./gradlew shadowJar

# jOOQコード生成（マイグレーション後）
./gradlew generateJooq

# テスト実行
./gradlew test

# クリーンビルド
./gradlew clean build
```

### フロントエンド

```bash
cd frontend

# 依存関係のインストール
npm install

# 開発サーバー起動（ポート3000）
npm run dev

# 本番ビルド
npm run build

# テスト実行
npm test

# リント実行
npm run lint
```

---

## トラブルシューティング

### コンテナが起動しない

```bash
# ログを確認
docker-compose logs backend

# ポート競合確認
lsof -i :8080
lsof -i :5432
lsof -i :3000

# コンテナをクリーンアップして再起動
docker-compose down -v
docker-compose up -d --build
```

### データベース接続エラー

```bash
# PostgreSQLコンテナが起動しているか確認
docker-compose ps postgres

# PostgreSQLログ確認
docker-compose logs postgres

# データベース接続テスト
docker exec housework-db psql -U housework -d housework -c "SELECT 1;"
```

### マイグレーションエラー

```bash
# マイグレーションファイルの権限確認
docker exec housework-backend ls -la /app/db/migration/

# Flywayスキーマ履歴確認
docker exec housework-db psql -U housework -d housework -c "SELECT * FROM flyway_schema_history;"

# データベースをリセットして再マイグレーション
docker-compose down -v
docker-compose up -d
```

### APIレスポンスがない

```bash
# バックエンドヘルスチェック
curl http://localhost:8080/health

# コンテナの状態確認
docker-compose ps

# バックエンドログ確認
docker-compose logs -f backend
```

---

## プロジェクト構成

```
housework/
├── backend/                    # Kotlinバックエンド
│   ├── build.gradle.kts       # Gradleビルド設定
│   ├── Dockerfile             # Dockerビルド設定
│   ├── db/migration/          # Flywayマイグレーションファイル
│   └── src/
│       ├── main/kotlin/com/task/
│       │   ├── Application.kt           # エントリーポイント
│       │   ├── Config.kt                # DI設定
│       │   ├── domain/                  # ドメイン層
│       │   │   ├── member/
│       │   │   ├── memberAvailability/
│       │   │   └── taskDefinition/
│       │   ├── usecase/                 # アプリケーション層
│       │   ├── presentation/            # プレゼンテーション層
│       │   └── infra/                   # インフラ層
│       │       ├── database/
│       │       ├── member/
│       │       ├── memberAvailability/
│       │       └── taskDefinition/
│       └── generated/jooq/              # jOOQ生成コード
│
├── frontend/                   # Reactフロントエンド
│   ├── package.json
│   ├── Dockerfile
│   └── src/
│       ├── pages/             # ページコンポーネント
│       ├── components/        # 再利用コンポーネント
│       ├── contexts/          # Reactコンテキスト
│       └── types/             # TypeScript型定義
│
├── docker-compose.yml         # Docker Compose設定
├── CLAUDE.md                  # プロジェクト仕様書
└── README.md                  # このファイル
```

---

## 設計原則

### DDDアーキテクチャ
- **ドメイン層**: ビジネスロジックとエンティティ
- **アプリケーション層**: ユースケースとトランザクション管理
- **プレゼンテーション層**: HTTPエンドポイントとリクエスト/レスポンス変換
- **インフラ層**: データベースアクセスと外部サービス連携

### リポジトリパターン
- インターフェースはドメイン層に定義
- 実装はインフラ層に配置
- jOOQによる型安全なSQLクエリ

### MULTISETによるN+1クエリ防止
- 親子関係のあるデータを1回のクエリで取得
- 型安全なField変数によるキャスト不要のアクセス

---

## ライセンス

MIT License

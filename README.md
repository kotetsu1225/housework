# Housework - 家庭タスク管理アプリケーション

家族間での家事分担を効率化するためのタスク管理アプリケーションです。
タスクの定義・スケジューリング・実行管理・ポイント制によるゲーミフィケーションを通じて、家事の見える化と公平な分担を実現します。

## 解決する課題

- タスクの属人化（誰が何を、どの頻度でやっているか共有されない）
- 完了状況の不透明さ（誰がどのタスクを完了したか不明）
- スケジュールの調整不足（家族メンバーの空き状況が見えない）
- タスクの重複・漏れ（定期タスクの自動生成がない）

---

## 技術スタック

### バックエンド

| 技術 | バージョン | 用途 |
|------|-----------|------|
| Kotlin | 1.9.22 | メイン言語（JVM 21） |
| Ktor | 2.3.7 | HTTPサーバーフレームワーク（Netty） |
| jOOQ | 3.18.7 | 型安全なSQLクエリビルダー |
| Guice | 7.0.0 | 依存性注入（DI） |
| Flyway | 9.22.3 | データベースマイグレーション |
| HikariCP | 5.1.0 | コネクションプール |
| PostgreSQL | 42.7.1 | JDBCドライバ |
| jBCrypt | 0.4 | パスワードハッシュ化 |
| Jakarta Mail | 2.0.1 | メール送信 |
| web-push | 5.1.1 | Web Push通知（VAPID） |
| BouncyCastle | 1.77 | 暗号化ライブラリ |
| kotlinx-coroutines | 1.7.3 | 非同期処理・スケジューラ |

### フロントエンド

| 技術 | バージョン | 用途 |
|------|-----------|------|
| React | 18.2 | UIフレームワーク |
| TypeScript | 5.2 | 型安全なJavaScript |
| Vite | 5.0 | ビルドツール・開発サーバー |
| Tailwind CSS | 3.4 | ユーティリティファーストCSS |
| React Router | 6.21 | クライアントサイドルーティング |
| Vitest | 1.1 | テストフレームワーク |
| date-fns | 3.2 | 日付操作ライブラリ |
| Lucide React | 0.303 | アイコンライブラリ |

### インフラ

| 技術 | 用途 |
|------|------|
| Docker Compose | コンテナオーケストレーション |
| PostgreSQL 16 Alpine | データベースコンテナ |
| Qodana | CI/CDコード品質チェック（GitHub Actions） |

---

## アーキテクチャ設計

### バックエンド - レイヤードアーキテクチャ（DDD）

```
domain/        ← ビジネスロジック・ドメインモデル・ドメインイベント
usecase/       ← アプリケーションサービス（ユースケース）
presentation/  ← HTTPエンドポイント・リクエスト/レスポンス変換
infra/         ← 永続化・外部サービス連携・セキュリティ
scheduler/     ← バックグラウンドスケジューラ
```

**依存の方向**: `presentation → usecase → domain ← infra`

### フロントエンド - コンポーネントベースアーキテクチャ

```
pages/         ← ルーティング対象のページコンポーネント
components/    ← 再利用可能なUIコンポーネント
hooks/         ← カスタムフック（データ取得・状態管理）
contexts/      ← React Context（認証状態）
api/           ← APIクライアント層（fetch ラッパー）
types/         ← TypeScript型定義
utils/         ← ユーティリティ関数
```

---

## ドメインモデル

### 集約（Aggregate）

#### 1. Member（家族メンバー）
| フィールド | 型 | 説明 |
|-----------|-----|------|
| id | UUID | 一意識別子 |
| name | MemberName | 名前（家族内で一意） |
| email | MemberEmail | メールアドレス |
| familyRole | FamilyRole | FATHER / MOTHER / BROTHER / SISTER |
| password | PasswordHash | BCryptハッシュ化パスワード（5-72文字） |

#### 2. TaskDefinition（タスク定義テンプレート）
| フィールド | 型 | 説明 |
|-----------|-----|------|
| id | UUID | 一意識別子 |
| name | String | タスク名 |
| description | String? | 説明（任意） |
| scheduledTimeRange | Instant範囲 | 予定時間帯（開始・終了） |
| scope | TaskScope | FAMILY（共有）/ PERSONAL（個人） |
| ownerMemberId | UUID? | PERSONAL時の所有者（FAMILY時はnull） |
| schedule | TaskSchedule | Recurring（繰り返し）/ OneTime（単発） |
| point | Int | 完了時のポイント |
| version | Int | 楽観的ロック用バージョン |
| isDeleted | Boolean | 論理削除フラグ |

**繰り返しパターン**: Daily（毎日） / Weekly（曜日指定） / Monthly（日付指定、1-28日）

#### 3. TaskExecution（タスク実行インスタンス）

状態遷移（State Machine）:

```
NOT_STARTED ──→ IN_PROGRESS ──→ COMPLETED
     │               │
     └───────────────→ CANCELLED
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| id | UUID | 一意識別子 |
| taskDefinitionId | UUID | 元のタスク定義 |
| assigneeMemberIds | List\<UUID\> | 担当メンバー（複数人対応） |
| scheduledDate | Instant | 予定日 |
| status | ExecutionStatus | 状態（上記参照） |
| taskSnapshot | TaskSnapshot | 開始時のタスク定義スナップショット |
| earnedPoint | Int | 獲得ポイント（totalPoint / 担当人数で按分） |
| startedAt / completedAt | Instant? | 開始・完了時刻 |

### ドメインイベント

エンティティの状態変化時にドメインイベントを発行し、副作用を非同期に処理します。

| イベント | トリガー | ハンドラ |
|---------|---------|---------|
| TaskDefinitionCreated | タスク定義作成時 | 当日分のTaskExecution自動生成 |
| TaskDefinitionDeleted | タスク定義削除時 | - |
| TaskExecutionStarted | タスク開始時 | メール通知・Web Push（FAMILYタスク） |
| TaskExecutionCompleted | タスク完了時 | メール通知・Web Push（FAMILYタスク） |
| TaskExecutionCancelled | タスクキャンセル時 | - |

**Outboxパターン**: イベントは `outbox` テーブルに永続化後、10秒間隔のスケジューラで非同期処理されます。処理済みイベントは `completed_domain_events` テーブルで冪等性を保証します。

---

## バックグラウンドスケジューラ

Kotlinコルーチンベースのスケジューラが5つ稼働します。

| スケジューラ | 実行タイミング | 処理内容 |
|-------------|--------------|---------|
| DailyTaskGenerationScheduler | 毎日 6:00 | 当日分のタスク実行インスタンスを自動生成 |
| DailyNotCompletedTaskNotificationScheduler | 毎日 19:00 | 未完了の日次タスクをリマインド通知 |
| NotDailyTomorrowTaskNotificationScheduler | 毎日 20:00 | 翌日の非日次タスクをプレビュー通知 |
| NotDailyTaskReminderScheduler | 毎日 9:00 | 近日中の非日次タスクをリマインド |
| OutboxEventProcessorScheduler | 10秒間隔 | Outboxテーブルのイベントを処理 |

---

## 認証・セキュリティ

- **JWT認証**: ログイン時にJWTトークンを発行（有効期限: 7日間）
- **BCryptパスワードハッシュ**: パスワードはBCryptでハッシュ化して保存
- **CORS設定**: 許可オリジンを環境変数で設定可能
- **非rootユーザー実行**: Dockerコンテナ内でappuserとして実行

---

## API エンドポイント

全認証エンドポイントはJWTトークンが必要です（`Authorization: Bearer <token>`）。

### 認証

```bash
# ログイン
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"name":"田中太郎","password":"password123"}'

# ログアウト（クライアント側でトークンを破棄）
curl -X POST http://localhost:8080/api/auth/logout
```

### メンバー管理

```bash
# メンバー一覧取得（当日のポイント・完了タスク数を含む）
curl http://localhost:8080/api/member

# 特定メンバー取得
curl http://localhost:8080/api/member/{memberId}

# メンバー作成
curl -X POST http://localhost:8080/api/member/create \
  -H "Content-Type: application/json" \
  -d '{"name":"田中太郎","email":"taro@example.com","familyRole":"FATHER","password":"password123"}'

# メンバー更新
curl -X POST http://localhost:8080/api/member/{memberId}/update \
  -H "Content-Type: application/json" \
  -d '{"name":"田中花子","email":"hanako@example.com","familyRole":"MOTHER"}'
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
    "scheduledTimeRange":{"startTime":"2024-01-01T09:00:00Z","endTime":"2024-01-01T09:30:00Z"},
    "scope":"FAMILY",
    "point":10,
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
    "scheduledTimeRange":{"startTime":"2024-12-31T09:00:00Z","endTime":"2024-12-31T12:00:00Z"},
    "scope":"FAMILY",
    "point":50,
    "schedule":{
      "type":"OneTime",
      "deadline":"2024-12-31"
    }
  }'

# タスク定義更新
curl -X POST http://localhost:8080/api/task-definitions/{taskDefinitionId}/update \
  -H "Content-Type: application/json" \
  -d '{"name":"掃除機がけ（週2回）","point":15}'

# タスク定義削除（論理削除）
curl -X POST http://localhost:8080/api/task-definitions/{taskDefinitionId}/delete
```

### タスク実行管理

```bash
# タスク実行一覧取得（フィルタ対応: 日付、ステータス、担当者）
curl "http://localhost:8080/api/task-executions?date=2024-01-15&status=NOT_STARTED&assigneeId={memberId}"

# 特定タスク実行取得
curl http://localhost:8080/api/task-executions/{taskExecutionId}

# タスク開始（NOT_STARTED → IN_PROGRESS）
curl -X POST http://localhost:8080/api/task-executions/{taskExecutionId}/start

# タスク完了（IN_PROGRESS → COMPLETED）
curl -X POST http://localhost:8080/api/task-executions/{taskExecutionId}/complete

# タスクキャンセル（→ CANCELLED）
curl -X POST http://localhost:8080/api/task-executions/{taskExecutionId}/cancel

# 担当者変更（複数メンバー対応）
curl -X POST http://localhost:8080/api/task-executions/{taskExecutionId}/assign \
  -H "Content-Type: application/json" \
  -d '{"assigneeMemberIds":["<member-uuid-1>","<member-uuid-2>"]}'
```

### ダッシュボード・クエリ

```bash
# ダッシュボードデータ取得（CQRSクエリ: 当日タスク + メンバーサマリ）
curl "http://localhost:8080/api/dashboard?date=2024-01-15"

# 完了済みタスク履歴
curl "http://localhost:8080/api/completed-tasks?limit=20&offset=0"

# 手動タスク生成（特定日のタスク実行を生成）
curl -X POST http://localhost:8080/api/task-generations \
  -H "Content-Type: application/json" \
  -d '{"date":"2024-01-15"}'
```

### Web Push通知

```bash
# Push通知サブスクリプション登録
curl -X POST http://localhost:8080/api/push-subscriptions/register \
  -H "Content-Type: application/json" \
  -d '{"endpoint":"https://...","keys":{"p256dh":"...","auth":"..."}}'

# Push通知サブスクリプション取得
curl http://localhost:8080/api/push-subscriptions
```

### ヘルスチェック

```bash
curl http://localhost:8080/health
# レスポンス: ok
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

### テーブル構成（19マイグレーション）

| テーブル名 | 説明 |
|-----------|------|
| members | 家族メンバー（name, email, password_hash, role） |
| task_definitions | タスク定義テンプレート（schedule, scope, point） |
| task_recurrences | 繰り返しスケジュール設定 |
| task_executions | タスク実行インスタンス（status, scheduled_date） |
| task_execution_participants | タスク担当者（多対多、複数メンバー対応） |
| task_snapshots | タスク実行時のスナップショット（凍結された定義） |
| push_subscriptions | Web Push通知サブスクリプション |
| member_metas | メンバーメタデータ（キーバリュー） |
| outbox | ドメインイベント永続化（Outboxパターン） |
| completed_domain_events | 処理済みイベント（冪等性保証） |
| flyway_schema_history | マイグレーション履歴 |

### マイグレーション履歴

マイグレーションは**アプリケーション起動時に自動実行**されます（Flyway）。

<details>
<summary>マイグレーション一覧（V1〜V19）</summary>

| Version | 内容 |
|---------|------|
| V1 | `members` テーブル作成 |
| V2 | `member_availabilities` テーブル作成（V13で削除） |
| V3 | `task_definitions` テーブル作成 |
| V4 | `task_recurrences` テーブル作成 |
| V5 | `task_executions` テーブル作成 |
| V6 | `task_snapshots` テーブル作成 |
| V7 | `members.role` を PARENT/CHILD → FATHER/MOTHER/SISTER/BROTHER に変更 |
| V8 | `members` に `password_hash` カラム追加 |
| V9 | `task_executions` のCANCELLED制約修正 |
| V10 | `member_availabilities` 物理削除 |
| V11 | `members` に `email` カラム追加 |
| V12 | `estimated_minutes` → `scheduled_start_time` / `scheduled_end_time`（Instant）に変更 |
| V13 | `member_availabilities` テーブル完全削除 |
| V14 | `task_execution_participants` テーブル作成（単一担当→複数担当対応） |
| V15 | `task_definitions` に `point` カラム追加 |
| V16 | `push_subscriptions` テーブル作成 |
| V17 | `member_metas` テーブル作成 |
| V18 | `outbox` テーブル作成（ドメインイベント永続化） |
| V19 | `completed_domain_events` テーブル作成 |

</details>

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

# キャッシュなしでビルド（依存関係更新時）
docker-compose build --no-cache

# ビルドして起動
docker-compose up -d --build
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

# Flywayマイグレーション
./gradlew flywayMigrate

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

# カバレッジ付きテスト
npm run test:coverage

# リント実行
npm run lint
```

---

## プロジェクト構成

```
housework/
├── backend/                          # Kotlinバックエンド
│   ├── build.gradle.kts             # Gradleビルド設定
│   ├── Dockerfile                   # マルチステージDockerビルド
│   ├── db/migration/                # Flywayマイグレーション（V1〜V19）
│   ├── docker/postgres/init.sql     # PostgreSQL初期化スクリプト
│   └── src/
│       ├── main/kotlin/com/task/
│       │   ├── Application.kt               # エントリーポイント
│       │   ├── Config.kt                    # Guice DI設定
│       │   ├── domain/                      # ドメイン層
│       │   │   ├── member/                 # Memberエンティティ・値オブジェクト
│       │   │   ├── taskDefinition/         # TaskDefinitionエンティティ・スケジュール
│       │   │   ├── taskExecution/          # TaskExecution状態マシン・スナップショット
│       │   │   ├── task/service/           # ドメインサービス（認可等）
│       │   │   ├── event/                  # ドメインイベント定義
│       │   │   └── mail/                   # メールドメインインターフェース
│       │   ├── usecase/                     # アプリケーション層
│       │   │   ├── auth/                   # ログイン
│       │   │   ├── member/                 # メンバーCRUD
│       │   │   ├── taskDefinition/         # タスク定義CRUD + イベントハンドラ
│       │   │   ├── taskExecution/          # タスク実行状態遷移
│       │   │   ├── task/                   # タスク生成・通知
│       │   │   ├── outbox/                 # Outboxイベント処理
│       │   │   ├── pushSubscription/       # Push通知サブスクリプション
│       │   │   ├── memberMeta/             # メンバーメタデータ
│       │   │   └── query/                  # CQRSクエリサービス
│       │   ├── presentation/                # プレゼンテーション層
│       │   │   ├── Auth.kt                 # 認証エンドポイント
│       │   │   ├── Members.kt              # メンバーエンドポイント
│       │   │   ├── TaskDefinitions.kt      # タスク定義エンドポイント
│       │   │   ├── TaskExecutions.kt       # タスク実行エンドポイント
│       │   │   ├── Dashboard.kt            # ダッシュボードエンドポイント
│       │   │   ├── CompletedTasks.kt       # 完了タスクエンドポイント
│       │   │   ├── PushSubscriptions.kt    # Push通知エンドポイント
│       │   │   └── TaskGenerations.kt      # 手動タスク生成エンドポイント
│       │   ├── scheduler/                   # バックグラウンドスケジューラ
│       │   │   ├── BaseScheduler.kt        # スケジューラ基底クラス
│       │   │   ├── DailyScheduler.kt       # 日次スケジューラテンプレート
│       │   │   ├── DailyTaskGenerationScheduler.kt
│       │   │   ├── DailyNotCompletedTaskNotificationScheduler.kt
│       │   │   ├── NotDailyTomorrowTaskNotificationScheduler.kt
│       │   │   ├── NotDailyTaskReminderScheduler.kt
│       │   │   └── OutboxEventProcessorScheduler.kt
│       │   └── infra/                       # インフラ層
│       │       ├── database/               # DB接続・トランザクション管理
│       │       ├── repository/             # jOOQリポジトリ実装
│       │       ├── event/                  # ドメインイベントディスパッチャ
│       │       ├── outbox/                 # Outboxリポジトリ
│       │       ├── security/              # JWT・BCrypt
│       │       ├── mail/                   # SMTP・SendGrid・Logging
│       │       ├── webpush/               # Web Push送信
│       │       ├── pushSubscription/      # Push Subscriptionリポジトリ
│       │       ├── memberMeta/            # メンバーメタデータリポジトリ
│       │       ├── query/                 # クエリサービス実装
│       │       └── config/               # 環境変数ローダー
│       ├── main/resources/
│       │   ├── application.conf           # Ktor設定（DB、JWT、Mail、WebPush、CORS）
│       │   └── logback.xml
│       └── test/kotlin/com/task/          # テスト
│   └── src/generated/jooq/               # jOOQ自動生成コード
│
├── frontend/                          # Reactフロントエンド
│   ├── package.json
│   ├── Dockerfile                     # マルチステージDockerビルド
│   ├── nginx.conf                     # nginx設定（SPA + APIプロキシ）
│   └── src/
│       ├── main.tsx                   # エントリーポイント
│       ├── App.tsx                    # ルーティング定義
│       ├── index.css                  # グローバルスタイル（Tailwind + カスタムアニメーション）
│       ├── api/                       # APIクライアント層
│       │   ├── client.ts             # fetch ラッパー（JWT自動付与、401自動ログアウト）
│       │   ├── auth.ts               # 認証API
│       │   ├── members.ts            # メンバーAPI
│       │   ├── taskDefinitions.ts    # タスク定義API
│       │   ├── taskExecutions.ts     # タスク実行API
│       │   ├── dashboard.ts          # ダッシュボードAPI
│       │   ├── completedTasks.ts     # 完了タスクAPI
│       │   └── pushSubscriptions.ts  # Push通知API
│       ├── pages/                     # ページコンポーネント
│       │   ├── Dashboard.tsx         # ホーム画面（当日タスク・進捗）
│       │   ├── Tasks.tsx             # タスク管理（カレンダー + 繰り返しリスト）
│       │   ├── TaskList.tsx          # タスク一覧（フラット表示）
│       │   ├── Members.tsx           # メンバーランキング
│       │   ├── MemberDetail.tsx      # メンバー詳細
│       │   ├── CompletedExecutions.tsx # 完了タスク履歴
│       │   ├── Login.tsx             # ログイン
│       │   ├── Register.tsx          # ユーザー登録
│       │   ├── Landing.tsx           # LPページ（遅延読み込み）
│       │   └── NotFound.tsx          # 404
│       ├── components/                # 再利用コンポーネント
│       │   ├── ui/                   # 汎用UI（Button, Input, Modal, Card, Badge, Avatar等）
│       │   ├── layout/              # レイアウト（Header, BottomNav, PageContainer）
│       │   ├── dashboard/           # ダッシュボード固有コンポーネント
│       │   ├── tasks/               # タスク管理コンポーネント
│       │   ├── landing/             # LPセクションコンポーネント
│       │   ├── auth/                # 認証（ProtectedRoute）
│       │   ├── push/                # 通知許可モーダル
│       │   └── ErrorBoundary.tsx    # エラーバウンダリ
│       ├── hooks/                     # カスタムフック
│       │   ├── useDashboard.ts      # ダッシュボードデータ・タスクアクション
│       │   ├── useMembers.ts        # メンバーCRUD
│       │   ├── useTaskDefinition.ts # タスク定義CRUD
│       │   ├── useTaskExecution.ts  # タスク実行操作
│       │   ├── useCompletedTasks.ts # 完了タスク取得
│       │   ├── usePushSubscription.ts # Push通知サブスクリプション
│       │   └── useScrollAnimation.ts # スクロールアニメーション
│       ├── contexts/                  # React Context
│       │   └── AuthContext.tsx       # JWT認証・セッション管理
│       ├── types/                     # 型定義
│       │   ├── index.ts             # ドメイン型
│       │   └── api.ts               # APIリクエスト/レスポンス型（DTO）
│       ├── constants/                 # 定数
│       ├── utils/                     # ユーティリティ
│       ├── mocks/                     # 開発用モックデータ
│       └── test/                      # テストユーティリティ
│
├── .github/workflows/                 # CI/CD
│   └── qodana_code_quality.yml       # Qodanaコード品質チェック
├── docker-compose.yml                 # Docker Compose設定
├── CLAUDE.md                          # プロジェクト仕様書
└── README.md                          # このファイル
```

---

## 設計パターン

### バックエンド

| パターン | 適用箇所 | 説明 |
|---------|---------|------|
| DDD集約 | Member, TaskDefinition, TaskExecution | ビジネスルールをエンティティに集約 |
| ファクトリメソッド | `Entity.create()` / `Entity.reconstruct()` | 生成時バリデーション / 永続化からの復元を分離 |
| 値オブジェクト | MemberId, MemberName, MemberEmail等 | `@JvmInline value class` で型安全性を確保 |
| リポジトリ | domain層にインターフェース / infra層に実装 | 永続化の詳細を隠蔽 |
| ドメインイベント | AggregateRoot基底クラス | エンティティの状態変化を通知 |
| Outboxパターン | outbox / completed_domain_events | イベントの確実な配信・冪等処理 |
| CQRS | Dashboard, CompletedTasks | 読み取り専用のクエリモデルを分離 |
| 状態マシン | TaskExecution（sealed class） | 不正な状態遷移をコンパイル時に防止 |
| 楽観的ロック | TaskDefinition.version | 同時更新の検出 |
| Strategyパターン | MailSender（SMTP/SendGrid/Logging） | メール送信の実装を切り替え可能 |
| MULTISETクエリ | jOOQ Repository実装 | 親子関係を1クエリで取得しN+1問題を防止 |

### フロントエンド

| パターン | 適用箇所 | 説明 |
|---------|---------|------|
| カスタムフック | useDashboard, useMembers等 | データ取得ロジックをコンポーネントから分離 |
| Context API | AuthContext, ToastProvider | 認証状態・通知をグローバル管理 |
| コード分割 | Landing.tsx（lazy loading） | 初回読み込みサイズの最適化 |
| APIクライアント層 | api/client.ts | JWT自動付与・エラーハンドリングを集約 |
| ProtectedRoute | auth/ProtectedRoute.tsx | 認証ガード |

---

## 通知システム

### メール通知
- **SMTP**: Gmail SMTP対応（TLS/SSL）
- **SendGrid**: HTTP APIフォールバック
- **Logging**: 開発・テスト環境用（コンソール出力のみ）

### Web Push通知
- **VAPID**ベースのWeb Push通知
- Service Workerによるバックグラウンド受信
- ダッシュボードで通知許可モーダルを表示
- 未完了タスクのリマインド・翌日タスクのプレビューを配信

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

# データベース接続テスト
docker exec housework-db psql -U housework -d housework -c "SELECT 1;"
```

### マイグレーションエラー

```bash
# Flywayスキーマ履歴確認
docker exec housework-db psql -U housework -d housework -c "SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank;"

# データベースをリセットして再マイグレーション
docker-compose down -v
docker-compose up -d
```


# ディレクトリ構成

以下は主要な構成。生成物・依存物（`backend/build/`, `frontend/dist/`, `frontend/node_modules/` など）は記載対象外。

## 概要

```
.
├── CLAUDE.md                      # Claude Code用プロジェクト指示書
├── README.md                      # プロジェクト概要
├── docker-compose.yml             # コンテナオーケストレーション
├── 要件定義.md                    # 要件定義書
├── doc/                           # ドキュメント
├── backend/                       # バックエンド (Kotlin/Ktor)
└── frontend/                      # フロントエンド (React/TypeScript)
```

---

## ドキュメント (`doc/`)

```
doc/
├── domain-model.md                # ドメインモデル設計書
├── er-diagram.md                  # ER図
├── sequence-diagram.md            # シーケンス図
├── directory-structure.md         # ディレクトリ構成（本ドキュメント）
├── project-configuration-summary.md  # プロジェクト設定サマリ
├── backend-issues.md              # バックエンド課題
├── backend-todo.md                # バックエンドTODO
└── web-app-features-todo.md       # Webアプリ機能TODO
```

---

## バックエンド (`backend/`)

### 全体構成

```
backend/
├── build.gradle.kts               # Gradleビルド設定
├── settings.gradle.kts            # Gradleプロジェクト設定
├── gradlew / gradlew.bat          # Gradleラッパー
├── docker/
│   └── postgres/
│       └── init.sql               # DB初期化スクリプト
├── db/
│   └── migration/                 # Flywayマイグレーション (V1〜V17)
├── gradle/
│   └── wrapper/                   # Gradleラッパー
└── src/
    ├── generated/
    │   └── jooq/                  # JOOQ自動生成コード
    ├── main/
    │   ├── kotlin/com/task/       # メインソースコード
    │   └── resources/             # 設定ファイル
    └── test/
        └── kotlin/                # テストコード
```

### ドメイン層 (`domain/`)

ビジネスロジックとドメインモデルを配置。外部依存を持たない純粋なKotlinコード。

```
domain/
├── AggregateRoot.kt               # 集約ルート基底クラス (イベント蓄積機能)
├── AppTimeZone.kt                 # アプリケーション共通タイムゾーン定義
├── event/                         # ドメインイベント基盤
│   ├── DomainEvent.kt             # イベントマーカーインターフェース
│   ├── DomainEventDispatcher.kt   # イベントディスパッチャーインターフェース
│   └── DomainEventHandler.kt      # イベントハンドラーインターフェース
├── mail/                          # メール送信ドメイン
│   ├── Mail.kt                    # メールValue Object
│   └── MailSender.kt              # メール送信インターフェース
├── member/                        # メンバー集約
│   ├── Member.kt                  # メンバーエンティティ + Value Objects
│   ├── MemberEmail.kt             # メールアドレスValue Object
│   ├── MemberRepository.kt        # リポジトリインターフェース
│   └── PasswordHasher.kt          # パスワードハッシュインターフェース
├── task/
│   └── service/                   # ドメインサービス
│       ├── TaskGenerationService.kt      # タスク生成サービス
│       └── TaskdefinitionAuthService.kt  # タスク定義認可サービス
├── taskDefinition/                # タスク定義集約
│   ├── TaskDefinition.kt          # タスク定義エンティティ + Value Objects
│   ├── TaskDefinitionRepository.kt # リポジトリインターフェース
│   ├── TaskSchedule.kt            # スケジュール sealed class
│   └── event/                     # タスク定義イベント
│       ├── TaskDefinitionCreated.kt  # 作成イベント
│       └── TaskDefinitionDeleted.kt  # 削除イベント
└── taskExecution/                 # タスク実行集約
    ├── TaskExecution.kt           # 状態マシン (sealed class)
    ├── TaskExecutionRepository.kt # リポジトリインターフェース
    ├── StateChange.kt             # 状態変更 + イベントのペア
    └── event/
        └── TaskExecutionEvent.kt  # 実行イベント (Created/Started/Completed/Cancelled)
```

### ユースケース層 (`usecase/`)

アプリケーションサービス。トランザクション境界とドメインイベントのディスパッチを担当。

```
usecase/
├── auth/                          # 認証
│   ├── LoginUseCase.kt
│   └── LoginUseCaseImpl.kt
├── member/                        # メンバー管理
│   ├── CreateMemberUseCase.kt
│   ├── CreateMemberUseCaseImpl.kt
│   ├── GetMemberUseCase.kt
│   ├── GetMemberUseCaseImpl.kt
│   ├── GetMembersUseCase.kt
│   ├── GetMembersUseCaseImpl.kt
│   ├── UpdateMemberUseCase.kt
│   └── UpdateMemberUseCaseImpl.kt
├── memberMeta/                    # メンバーメタ情報
│   ├── GetUserMetasUseCase.kt
│   ├── GetUserMetasUseCaseImpl.kt
│   ├── SaveMemberMetaUseCase.kt
│   └── SaveMemberMetaUseCaseImpl.kt
├── pushSubscription/              # プッシュ通知購読
│   ├── GetPushSubscriptionUseCase.kt
│   ├── GetPushSubscriptionUseCaseImpl.kt
│   ├── RegisterPushSubscriptionUseCase.kt
│   └── RegisterPushSubscriptionUseCaseImpl.kt
├── taskDefinition/                # タスク定義
│   ├── create/
│   │   ├── CreateTaskDefinitionUseCase.kt
│   │   └── CreateTaskDefinitionUseCaseImpl.kt
│   ├── delete/
│   │   ├── DeleteTaskDefinitionUseCase.kt
│   │   └── DeleteTaskDefinitionUseCaseImpl.kt
│   ├── get/
│   │   ├── GetTaskDefinitionUseCase.kt
│   │   ├── GetTaskDefinitionUseCaseImpl.kt
│   │   ├── GetTaskDefinitionsUseCase.kt
│   │   └── GetTaskDefinitionsUseCaseImpl.kt
│   ├── update/
│   │   ├── UpdateTaskDefinitionUseCase.kt
│   │   └── UpdateTaskDefinitionUseCaseImpl.kt
│   └── handler/                   # イベントハンドラー
│       ├── CreateTaskExecutionOnTaskDefinitionCreatedHandler.kt
│       └── TaskDefinitionDeletedHandler.kt
├── taskExecution/                 # タスク実行
│   ├── assign/
│   │   ├── UpdateAssignTaskExecutionUseCase.kt
│   │   └── UpdateAssignTaskExecutionUseCaseImpl.kt
│   ├── cancel/
│   │   ├── CancelTaskExecutionUseCase.kt
│   │   └── CancelTaskExecutionUseCaseImpl.kt
│   ├── complete/
│   │   ├── CompleteTaskExecutionUseCase.kt
│   │   └── CompleteTaskExecutionUseCaseImpl.kt
│   ├── get/
│   │   ├── GetTaskExecutionUseCase.kt
│   │   ├── GetTaskExecutionUseCaseImpl.kt
│   │   ├── GetTaskExecutionsUseCase.kt
│   │   └── GetTaskExecutionsUseCaseImpl.kt
│   └── start/
│       ├── StartTaskExecutionUseCase.kt
│       └── StartTaskExecutionUseCaseImpl.kt
├── execution/                     # 完了タスク取得
│   ├── GetCompletedTasksUseCase.kt
│   └── GetCompletedTasksUseCaseImpl.kt
├── task/                          # タスク関連サービス
│   ├── GenerateDailyExecutionsUseCase.kt
│   ├── GenerateDailyExecutionsUseCaseImpl.kt
│   ├── SendDailyNotCompletedTaskNotificationsUseCase.kt
│   ├── SendDailyNotCompletedTaskNotificationsUseCaseImpl.kt
│   ├── SendNotDailyTaskRemindersUseCase.kt
│   ├── SendNotDailyTaskRemindersUseCaseImpl.kt
│   ├── SendNotDailyTomorrowTaskNotificationsUseCase.kt
│   ├── SendNotDailyTomorrowTaskNotificationsUseCaseImpl.kt
│   └── service/
│       ├── TaskGenerationServiceImpl.kt
│       └── TaskDefinitionAuthorizationService.kt
└── query/                         # CQRS: 読み取り専用サービス
    ├── dashboard/
    │   └── DashboardQueryService.kt
    ├── execution/
    │   └── CompletedTaskQueryService.kt
    ├── member/
    │   └── MemberStatsQueryService.kt
    └── notifications/
        ├── NotificationTargetQueryService.kt
        ├── TomorrowNotDailyTaskQueryService.kt
        └── UpcomingNotDailyTaskQueryService.kt
```

### インフラストラクチャ層 (`infra/`)

外部システムとの接続を担当。リポジトリ実装、メール送信、イベントディスパッチャー等。

```
infra/
├── config/
│   └── DotenvLoader.kt            # 環境変数ローダー
├── database/
│   ├── Database.kt                # トランザクション管理
│   └── DatabaseConfig.kt          # DB接続設定
├── event/
│   ├── InMemoryDomainEventDispatcher.kt  # イベントディスパッチャー実装
│   └── handler/
│       ├── EmailNotificationHandler.kt               # メール通知
│       ├── FamilyTaskStartedPushNotificationHandler.kt   # タスク開始プッシュ通知
│       ├── FamilyTaskCompletedPushNotificationHandler.kt # タスク完了プッシュ通知
│       └── support/
│           └── FamilyTaskPushNotificationService.kt  # プッシュ通知共通サービス
├── mail/
│   ├── LoggingMailSender.kt       # ログ出力メール送信（開発用）
│   ├── SmtpMailSender.kt          # SMTPメール送信
│   └── SendGridMailSender.kt      # SendGridメール送信
├── member/
│   └── MemberRepositoryImpl.kt    # メンバーリポジトリ実装
├── memberMeta/
│   ├── MemberMetaRepository.kt    # メンバーメタリポジトリインターフェース
│   └── MemberMetaRepositoryImpl.kt
├── pushSubscription/
│   ├── PushSubscription.kt        # プッシュ購読エンティティ
│   ├── PushSubscriptionRepository.kt
│   └── PushSubscriptionRepositoryImpl.kt
├── query/                         # CQRS: クエリサービス実装
│   ├── CompletedTaskQueryServiceImpl.kt
│   ├── DashboardQueryServiceImpl.kt
│   ├── MemberStatsQueryServiceImpl.kt
│   ├── NotificationTargetQueryServiceImpl.kt
│   ├── TomorrowNotDailyTaskQueryServiceImpl.kt
│   └── UpcomingNotDailyTaskQueryServiceImpl.kt
├── security/
│   ├── BCryptPasswordHasher.kt    # BCryptパスワードハッシュ
│   ├── JwtConfig.kt               # JWT設定
│   └── JwtService.kt              # JWTトークン生成・検証
├── taskDefinition/
│   └── TaskDefinitionRepositoryImpl.kt
├── taskExecution/
│   └── TaskExecutionRepositoryImpl.kt
└── webpush/
    ├── VapidConfig.kt             # VAPID設定
    ├── WebPushSender.kt           # WebPushインターフェース
    └── WebPushSenderImpl.kt       # WebPush実装
```

### プレゼンテーション層 (`presentation/`)

REST APIエンドポイント。Ktorルーティングとリクエスト/レスポンス変換。

```
presentation/
├── Auth.kt                        # POST /api/auth/login
├── Members.kt                     # /api/members CRUD
├── TaskDefinitions.kt             # /api/task-definitions CRUD
├── TaskExecutions.kt              # /api/task-executions + 状態遷移
├── TaskGenerations.kt             # POST /api/task-generations (手動生成)
├── Dashboard.kt                   # GET /api/dashboard
├── CompletedTasks.kt              # GET /api/completed-tasks
├── PushSubscriptions.kt           # /api/push-subscriptions
├── Health.kt                      # GET /health
├── GuicePlugin.kt                 # Guice DI Ktorプラグイン
└── JwtAuthPlugin.kt               # JWT認証Ktorプラグイン
```

### スケジューラ (`scheduler/`)

定期実行タスク。Coroutineベースのスケジューラ。

```
scheduler/
├── BaseScheduler.kt               # スケジューラ基底クラス
├── IntervalScheduler.kt           # インターバル実行スケジューラ基底クラス
├── DailyScheduler.kt              # 日次実行スケジューラ基底クラス
├── DailyTaskGenerationScheduler.kt         # 毎朝のタスク生成
├── DailyNotCompletedTaskNotificationScheduler.kt  # 未完了タスク通知
├── NotDailyTaskReminderScheduler.kt        # 非日次タスクリマインダー
└── NotDailyTomorrowTaskNotificationScheduler.kt   # 翌日タスク通知
```

### マイグレーション (`db/migration/`)

Flywayマイグレーションファイル（V1〜V17）。

```
migration/
├── V1__create_members.sql                    # メンバーテーブル
├── V2__create_member_availabilities.sql      # 空き時間テーブル（後にV13で削除）
├── V3__create_task_definitions.sql           # タスク定義テーブル
├── V4__create_task_recurrences.sql           # 繰り返し設定テーブル
├── V5__create_task_executions.sql            # タスク実行テーブル
├── V6__create_task_snapshots.sql             # タスクスナップショットテーブル
├── V7__alter_members_role.sql                # ロール変更
├── V8__add_password_hash_to_members.sql      # パスワードハッシュ追加
├── V9__fix_task_executions_cancelled_constraint.sql  # キャンセル制約修正
├── V10__member_availabilities_physical_delete.sql    # 物理削除対応
├── V11__add_email_to_members.sql             # メールアドレス追加
├── V12__replace_estimated_minutes_with_scheduled_time_range.sql  # 時間範囲置換
├── V13__drop_member_availabilities.sql       # 空き時間テーブル削除
├── V14__add_task_execution_participants.sql  # 複数参加者対応
├── V15__add_points_to_tasks.sql              # ポイント機能追加
├── V16__create_push_subscriptions.sql        # プッシュ購読テーブル
└── V17__create_member_metas.sql              # メンバーメタ情報テーブル
```

### その他

```
src/main/kotlin/com/task/
├── Application.kt                 # アプリケーションエントリポイント
└── Config.kt                      # Guice DIモジュール定義
```

---

## フロントエンド (`frontend/`)

### 全体構成

```
frontend/
├── package.json                   # npm設定
├── package-lock.json              # 依存関係ロック
├── vite.config.ts                 # Viteビルド設定
├── tailwind.config.js             # Tailwind CSS設定
├── postcss.config.js              # PostCSS設定
├── tsconfig.json                  # TypeScript設定
├── tsconfig.node.json             # Node用TypeScript設定
├── eslint.config.js               # ESLint設定
├── index.html                     # HTMLエントリポイント
├── public/                        # 静的ファイル
│   ├── familyIcons/               # 家族アイコン画像
│   ├── manifest.json              # PWAマニフェスト
│   └── sw.js                      # Service Worker
└── src/                           # ソースコード
```

### ソースコード (`src/`)

```
src/
├── main.tsx                       # Reactエントリポイント
├── App.tsx                        # ルートコンポーネント + ルーティング
├── index.css                      # グローバルスタイル
├── vite-env.d.ts                  # Vite型定義
├── api/                           # APIクライアント
├── components/                    # 再利用可能コンポーネント
├── constants/                     # 定数定義
├── contexts/                      # React Context
├── hooks/                         # カスタムフック
├── mocks/                         # モックデータ
├── pages/                         # ページコンポーネント
├── test/                          # テストユーティリティ
├── types/                         # TypeScript型定義
└── utils/                         # ユーティリティ関数
```

### APIクライアント (`api/`)

```
api/
├── index.ts                       # エクスポート集約
├── client.ts                      # Axios共通設定 + インターセプター
├── auth.ts                        # 認証API
├── members.ts                     # メンバーAPI
├── taskDefinitions.ts             # タスク定義API
├── taskExecutions.ts              # タスク実行API
├── dashboard.ts                   # ダッシュボードAPI
├── completedTasks.ts              # 完了タスクAPI
└── pushSubscriptions.ts           # プッシュ購読API
```

### コンポーネント (`components/`)

```
components/
├── ErrorBoundary.tsx              # エラーバウンダリ
├── auth/
│   ├── index.ts
│   ├── ProtectedRoute.tsx         # 認証ガード
│   └── __tests__/
│       └── ProtectedRoute.test.tsx
├── dashboard/                     # ダッシュボード関連
│   ├── index.ts
│   ├── TaskCard.tsx               # タスクカード
│   ├── TodayTaskCard.tsx          # 今日のタスクカード
│   ├── CompletedTaskCard.tsx      # 完了タスクカード
│   ├── TaskActionModal.tsx        # タスクアクションモーダル
│   ├── TaskGroupsSection.tsx      # タスクグループセクション
│   ├── TomorrowTaskDetailModal.tsx # 明日のタスク詳細モーダル
│   ├── ProgressSummaryCard.tsx    # 進捗サマリーカード
│   ├── MemberSummaryCard.tsx      # メンバーサマリーカード
│   └── __tests__/
│       ├── TaskCard.test.tsx
│       ├── TomorrowTaskDetailModal.test.tsx
│       ├── MemberSummaryCard.test.tsx
│       └── ProgressSummaryCard.test.tsx
├── layout/                        # レイアウト関連
│   ├── index.ts
│   ├── PageContainer.tsx          # ページコンテナ
│   ├── Header.tsx                 # ヘッダー
│   ├── BottomNav.tsx              # ボトムナビゲーション
│   └── __tests__/
│       ├── PageContainer.test.tsx
│       ├── Header.test.tsx
│       └── BottomNav.test.tsx
├── push/
│   └── NotificationPermissionModal.tsx  # 通知許可モーダル
├── tasks/                         # タスク管理関連
│   ├── index.ts
│   ├── TaskCalendar.tsx           # タスクカレンダー
│   ├── RecurringTaskList.tsx      # 繰り返しタスクリスト
│   ├── TaskEditModal.tsx          # タスク編集モーダル
│   └── TaskDefinitionDetailModal.tsx  # タスク定義詳細モーダル
└── ui/                            # 汎用UIコンポーネント
    ├── index.ts
    ├── Alert.tsx                  # アラート
    ├── Avatar.tsx                 # アバター
    ├── Badge.tsx                  # バッジ
    ├── Button.tsx                 # ボタン
    ├── Card.tsx                   # カード
    ├── Input.tsx                  # 入力フィールド
    ├── Modal.tsx                  # モーダル
    ├── ProgressRing.tsx           # 進捗リング
    ├── RoleSelector.tsx           # ロール選択
    ├── Skeleton.tsx               # スケルトンローダー
    ├── Toast.tsx                  # トースト通知
    └── __tests__/
        ├── Alert.test.tsx
        ├── Avatar.test.tsx
        ├── Badge.test.tsx
        ├── Button.test.tsx
        ├── Card.test.tsx
        ├── Input.test.tsx
        ├── Modal.test.tsx
        ├── ProgressRing.test.tsx
        └── RoleSelector.test.tsx
```

### ページ (`pages/`)

```
pages/
├── index.ts                       # エクスポート集約
├── Dashboard.tsx                  # ダッシュボード（ホーム）
├── Tasks.tsx                      # タスク定義一覧・管理
├── TaskList.tsx                   # タスクリスト
├── Members.tsx                    # メンバー一覧
├── MemberDetail.tsx               # メンバー詳細
├── CompletedExecutions.tsx        # 完了タスク履歴
├── Login.tsx                      # ログイン
├── Register.tsx                   # ユーザー登録
├── NotFound.tsx                   # 404ページ
└── __tests__/
    ├── Dashboard.test.tsx
    ├── Tasks.test.tsx
    ├── Members.test.tsx
    ├── Login.test.tsx
    └── Register.test.tsx
```

### カスタムフック (`hooks/`)

```
hooks/
├── index.ts                       # エクスポート集約
├── useDashboard.ts                # ダッシュボードデータ取得
├── useMembers.ts                  # メンバーCRUD
├── useTaskDefinition.ts           # タスク定義CRUD
├── useTaskExecution.ts            # タスク実行操作
├── useCompletedTasks.ts           # 完了タスク取得
├── usePushSubscription.ts         # プッシュ通知購読管理
└── __tests__/
    ├── useMember.test.tsx
    ├── useTaskDefinition.test.tsx
    └── useTaskExecution.test.tsx
```

### その他

```
constants/
├── index.ts
└── familyRole.ts                  # 家族ロール定数

contexts/
├── index.ts
├── AuthContext.tsx                # 認証コンテキスト
└── __tests__/
    └── AuthContext.test.tsx

mocks/
├── index.ts
├── members.ts                     # メンバーモック
├── taskDefinitions.ts             # タスク定義モック
└── taskExecutions.ts              # タスク実行モック

test/
├── setup.ts                       # テストセットアップ
└── test-utils.tsx                 # テストユーティリティ

types/
├── index.ts                       # 型定義エクスポート
└── api.ts                         # API型定義

utils/
├── index.ts
├── date.ts                        # 日付ユーティリティ
├── time.ts                        # 時間ユーティリティ
├── familyRole.ts                  # ロールユーティリティ
├── recurrence.ts                  # 繰り返しユーティリティ
├── pushSubscription.ts            # プッシュ購読ユーティリティ
└── __tests__/
    ├── date.test.ts
    └── familyRole.test.ts
```

---

## レイヤー依存関係

```
┌─────────────────────────────────────────────────────────────┐
│                    presentation/                            │
│                  (Ktor Routes, Controllers)                 │
├─────────────────────────────────────────────────────────────┤
│                      usecase/                               │
│  (Application Services, Event Handlers, Query Services)     │
├─────────────────────────────────────────────────────────────┤
│                      domain/                                │
│    (Entities, Value Objects, Events, Domain Services)       │
├─────────────────────────────────────────────────────────────┤
│                       infra/                                │
│   (Repositories, Event Dispatcher, External Services)       │
└─────────────────────────────────────────────────────────────┘
              ↑                           ↑
              │                           │
    依存の向きは常に              domain層のみが
    上から下へ                  外部依存を持たない
```

**依存性逆転の原則 (DIP)**:
- `domain/` 層はインターフェース（Repository, PasswordHasher等）のみ定義
- `infra/` 層がそれらの実装を提供
- `usecase/` 層はインターフェースに依存し、DIで実装を注入

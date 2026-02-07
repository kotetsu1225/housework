# RDB ER図

V1〜V17マイグレーション適用後の最終スキーマ。

## 概要

| テーブル名 | 説明 | 集約 |
|-----------|------|------|
| `members` | 家族メンバー | Member |
| `member_metas` | メンバーのメタ情報 | - (インフラ層) |
| `task_definitions` | タスク定義（カタログ） | TaskDefinition |
| `task_recurrences` | 繰り返し設定 | TaskDefinition |
| `task_executions` | タスク実行（チケット） | TaskExecution |
| `task_snapshots` | タスクスナップショット | TaskExecution |
| `task_execution_participants` | タスク参加者 | TaskExecution |
| `push_subscriptions` | プッシュ通知購読 | - (インフラ層) |

---

## ER図

```mermaid
erDiagram
    MEMBERS {
        UUID id PK "メンバーID"
        VARCHAR(100) name UK "メンバー名（ユニーク）"
        VARCHAR(255) email UK "メールアドレス（ユニーク）"
        VARCHAR(20) role "FATHER|MOTHER|SISTER|BROTHER"
        VARCHAR(255) password_hash "BCryptハッシュ"
        TIMESTAMPTZ created_at "作成日時"
        TIMESTAMPTZ updated_at "更新日時"
    }

    MEMBER_METAS {
        UUID member_id PK_FK "メンバーID"
        TEXT key PK "メタキー"
        BOOLEAN value "メタ値"
        TIMESTAMPTZ created_at "作成日時"
        TIMESTAMPTZ updated_at "更新日時"
    }

    TASK_DEFINITIONS {
        UUID id PK "タスク定義ID"
        VARCHAR(200) name "タスク名"
        TEXT description "説明"
        TIMESTAMPTZ scheduled_start_time "予定開始時刻"
        TIMESTAMPTZ scheduled_end_time "予定終了時刻"
        VARCHAR(20) scope "FAMILY|PERSONAL"
        UUID owner_member_id FK "所有者（PERSONAL時のみ）"
        VARCHAR(20) schedule_type "RECURRING|ONE_TIME"
        DATE one_time_deadline "期限（ONE_TIME時のみ）"
        INTEGER point "獲得ポイント"
        INTEGER version "楽観ロック用バージョン"
        BOOLEAN is_deleted "論理削除フラグ"
        TIMESTAMPTZ created_at "作成日時"
        TIMESTAMPTZ updated_at "更新日時"
    }

    TASK_RECURRENCES {
        UUID task_definition_id PK_FK "タスク定義ID"
        VARCHAR(20) pattern_type "DAILY|WEEKLY|MONTHLY"
        BOOLEAN daily_skip_weekends "土日スキップ（DAILY用）"
        INTEGER weekly_day_of_week "曜日1-7（WEEKLY用）"
        INTEGER monthly_day_of_month "日付1-31（MONTHLY用）"
        DATE start_date "繰り返し開始日"
        DATE end_date "繰り返し終了日"
        TIMESTAMPTZ created_at "作成日時"
        TIMESTAMPTZ updated_at "更新日時"
    }

    TASK_EXECUTIONS {
        UUID id PK "タスク実行ID"
        UUID task_definition_id FK "元タスク定義ID"
        DATE scheduled_date "実行予定日"
        VARCHAR(20) status "NOT_STARTED|IN_PROGRESS|COMPLETED|CANCELLED"
        TIMESTAMPTZ started_at "開始日時"
        TIMESTAMPTZ completed_at "完了日時"
        TIMESTAMPTZ created_at "作成日時"
        TIMESTAMPTZ updated_at "更新日時"
    }

    TASK_SNAPSHOTS {
        UUID task_execution_id PK_FK "タスク実行ID"
        VARCHAR(200) name "凍結タスク名"
        TEXT description "凍結説明"
        TIMESTAMPTZ scheduled_start_time "凍結予定開始時刻"
        TIMESTAMPTZ scheduled_end_time "凍結予定終了時刻"
        INTEGER frozen_point "凍結ポイント"
        INTEGER definition_version "元定義バージョン"
        TIMESTAMPTZ created_at "作成日時"
    }

    TASK_EXECUTION_PARTICIPANTS {
        UUID task_execution_id PK_FK "タスク実行ID"
        UUID member_id PK_FK "メンバーID"
        TIMESTAMPTZ joined_at "参加日時"
        INTEGER earned_point "獲得ポイント（完了時）"
    }

    PUSH_SUBSCRIPTIONS {
        UUID id PK "購読ID"
        UUID member_id FK "メンバーID"
        TEXT endpoint UK "Push ServiceエンドポイントURL"
        TEXT p256dh_key "暗号化用ECDH公開鍵"
        TEXT auth_key "認証シークレット"
        TIMESTAMPTZ expiration_time "有効期限"
        TEXT user_agent "ユーザーエージェント"
        BOOLEAN is_active "有効フラグ"
        TIMESTAMPTZ created_at "作成日時"
        TIMESTAMPTZ updated_at "更新日時"
    }


    MEMBERS ||--o{ MEMBER_METAS : "has metas"
    MEMBERS ||--o{ PUSH_SUBSCRIPTIONS : "subscribes"

    MEMBERS ||--o{ TASK_DEFINITIONS : "owns (PERSONAL)"
    TASK_DEFINITIONS ||--o| TASK_RECURRENCES : "has recurrence"
    TASK_DEFINITIONS ||--o{ TASK_EXECUTIONS : "issues"

    TASK_EXECUTIONS ||--o| TASK_SNAPSHOTS : "has snapshot"
    TASK_EXECUTIONS ||--o{ TASK_EXECUTION_PARTICIPANTS : "has participants"
    MEMBERS ||--o{ TASK_EXECUTION_PARTICIPANTS : "participates"
```

---

## テーブル詳細

### members

家族メンバーの基本情報と認証情報。

| カラム | 型 | NULL | 制約 | 説明 |
|--------|-----|------|------|------|
| id | UUID | NO | PK, DEFAULT uuid_generate_v4() | メンバーID |
| name | VARCHAR(100) | NO | UNIQUE | メンバー名 |
| email | VARCHAR(255) | NO | UNIQUE | メールアドレス |
| role | VARCHAR(20) | NO | CHECK (FATHER\|MOTHER\|SISTER\|BROTHER) | 家族内役割 |
| password_hash | VARCHAR(255) | NO | | BCryptハッシュ |
| created_at | TIMESTAMPTZ | NO | DEFAULT CURRENT_TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMPTZ | NO | DEFAULT CURRENT_TIMESTAMP | 更新日時 |

**インデックス:**
- `idx_members_role` (role)
- `idx_members_name` UNIQUE (name)

---

### member_metas

メンバーに紐づくKey-Valueメタ情報（プッシュ通知許可回答済みフラグ等）。

| カラム | 型 | NULL | 制約 | 説明 |
|--------|-----|------|------|------|
| member_id | UUID | NO | PK, FK→members(id) ON DELETE CASCADE | メンバーID |
| key | TEXT | NO | PK | メタキー |
| value | BOOLEAN | NO | | メタ値 |
| created_at | TIMESTAMPTZ | NO | DEFAULT CURRENT_TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMPTZ | NO | DEFAULT CURRENT_TIMESTAMP | 更新日時 |

**インデックス:**
- `idx_member_metas_member_id` (member_id)

---

### task_definitions

タスクのテンプレート定義。スケジュールタイプにより単発/定期が決まる。

| カラム | 型 | NULL | 制約 | 説明 |
|--------|-----|------|------|------|
| id | UUID | NO | PK, DEFAULT uuid_generate_v4() | タスク定義ID |
| name | VARCHAR(200) | NO | | タスク名 |
| description | TEXT | YES | | 説明・手順 |
| scheduled_start_time | TIMESTAMPTZ | NO | | 予定開始時刻 |
| scheduled_end_time | TIMESTAMPTZ | NO | | 予定終了時刻 |
| scope | VARCHAR(20) | NO | CHECK (FAMILY\|PERSONAL) | スコープ |
| owner_member_id | UUID | YES | FK→members(id) ON DELETE SET NULL | 所有者 |
| schedule_type | VARCHAR(20) | NO | CHECK (RECURRING\|ONE_TIME) | スケジュールタイプ |
| one_time_deadline | DATE | YES | | 期限（ONE_TIME用） |
| point | INTEGER | NO | DEFAULT 0 | 獲得ポイント |
| version | INTEGER | NO | DEFAULT 1 | 楽観ロック |
| is_deleted | BOOLEAN | NO | DEFAULT FALSE | 論理削除 |
| created_at | TIMESTAMPTZ | NO | DEFAULT CURRENT_TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMPTZ | NO | DEFAULT CURRENT_TIMESTAMP | 更新日時 |

**CHECK制約:**
- `chk_personal_owner`: FAMILY→owner_member_id=NULL, PERSONAL→owner_member_id≠NULL
- `chk_onetime_deadline`: RECURRING→deadline=NULL, ONE_TIME→deadline≠NULL
- `chk_scheduled_time_range`: scheduled_start_time < scheduled_end_time

**インデックス:**
- `idx_task_definitions_scope` (scope)
- `idx_task_definitions_owner` (owner_member_id)
- `idx_task_definitions_schedule_type` (schedule_type)
- `idx_task_definitions_is_deleted` (is_deleted)
- `idx_task_definitions_scheduled_start_time` (scheduled_start_time)
- `idx_task_definitions_scheduled_end_time` (scheduled_end_time)

---

### task_recurrences

タスク定義の繰り返しパターン設定。1対1で紐づく。

| カラム | 型 | NULL | 制約 | 説明 |
|--------|-----|------|------|------|
| task_definition_id | UUID | NO | PK, FK→task_definitions(id) ON DELETE CASCADE | タスク定義ID |
| pattern_type | VARCHAR(20) | NO | CHECK (DAILY\|WEEKLY\|MONTHLY) | パターンタイプ |
| daily_skip_weekends | BOOLEAN | YES | | 土日スキップ（DAILY用） |
| weekly_day_of_week | INTEGER | YES | CHECK (1-7) | 曜日（WEEKLY用） |
| monthly_day_of_month | INTEGER | YES | CHECK (1-31) | 日付（MONTHLY用） |
| start_date | DATE | NO | | 繰り返し開始日 |
| end_date | DATE | YES | | 繰り返し終了日 |
| created_at | TIMESTAMPTZ | NO | DEFAULT CURRENT_TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMPTZ | NO | DEFAULT CURRENT_TIMESTAMP | 更新日時 |

**CHECK制約:**
- `chk_daily_pattern`: DAILY→daily_skip_weekends≠NULL
- `chk_weekly_pattern`: WEEKLY→weekly_day_of_week≠NULL
- `chk_monthly_pattern`: MONTHLY→monthly_day_of_month≠NULL
- `chk_date_order`: end_date=NULL OR start_date≤end_date

---

### task_executions

タスク定義から生成された実行インスタンス。状態マシンで管理。

| カラム | 型 | NULL | 制約 | 説明 |
|--------|-----|------|------|------|
| id | UUID | NO | PK, DEFAULT uuid_generate_v4() | タスク実行ID |
| task_definition_id | UUID | NO | FK→task_definitions(id) ON DELETE RESTRICT | 元タスク定義ID |
| scheduled_date | DATE | NO | | 実行予定日 |
| status | VARCHAR(20) | NO | DEFAULT 'NOT_STARTED', CHECK (NOT_STARTED\|IN_PROGRESS\|COMPLETED\|CANCELLED) | ステータス |
| started_at | TIMESTAMPTZ | YES | | 開始日時 |
| completed_at | TIMESTAMPTZ | YES | | 完了日時 |
| created_at | TIMESTAMPTZ | NO | DEFAULT CURRENT_TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMPTZ | NO | DEFAULT CURRENT_TIMESTAMP | 更新日時 |

**CHECK制約:**
- `chk_started_at`: status≠'NOT_STARTED' → started_at≠NULL
- `chk_completed_at`: status≠'COMPLETED' OR completed_at≠NULL

**インデックス:**
- `idx_task_executions_definition` (task_definition_id)
- `idx_task_executions_scheduled_date` (scheduled_date)
- `idx_task_executions_status` (status)
- `idx_task_executions_date_status` (scheduled_date, status)

---

### task_snapshots

タスク開始時点のタスク定義状態を凍結保存。履歴追跡用。

| カラム | 型 | NULL | 制約 | 説明 |
|--------|-----|------|------|------|
| task_execution_id | UUID | NO | PK, FK→task_executions(id) ON DELETE CASCADE | タスク実行ID |
| name | VARCHAR(200) | NO | | 凍結タスク名 |
| description | TEXT | YES | | 凍結説明 |
| scheduled_start_time | TIMESTAMPTZ | NO | | 凍結予定開始時刻 |
| scheduled_end_time | TIMESTAMPTZ | NO | | 凍結予定終了時刻 |
| frozen_point | INTEGER | NO | DEFAULT 0 | 凍結ポイント |
| definition_version | INTEGER | NO | | 元定義バージョン |
| created_at | TIMESTAMPTZ | NO | DEFAULT CURRENT_TIMESTAMP | 作成日時 |

**CHECK制約:**
- `chk_snapshot_scheduled_time_range`: scheduled_start_time < scheduled_end_time

---

### task_execution_participants

タスク実行への参加者（多対多）。V14で複数人参加対応。

| カラム | 型 | NULL | 制約 | 説明 |
|--------|-----|------|------|------|
| task_execution_id | UUID | NO | PK, FK→task_executions(id) ON DELETE CASCADE | タスク実行ID |
| member_id | UUID | NO | PK, FK→members(id) ON DELETE CASCADE | メンバーID |
| joined_at | TIMESTAMPTZ | NO | DEFAULT CURRENT_TIMESTAMP | 参加日時 |
| earned_point | INTEGER | YES | | 獲得ポイント（完了時に設定） |

**インデックス:**
- `idx_task_execution_participants_member` (member_id)
- `idx_task_execution_participants_execution` (task_execution_id)

---

### push_subscriptions

Web Push通知の購読情報。インフラ層の関心事。

| カラム | 型 | NULL | 制約 | 説明 |
|--------|-----|------|------|------|
| id | UUID | NO | PK, DEFAULT uuid_generate_v4() | 購読ID |
| member_id | UUID | NO | FK→members(id) ON DELETE CASCADE | メンバーID |
| endpoint | TEXT | NO | UNIQUE | Push ServiceエンドポイントURL |
| p256dh_key | TEXT | NO | | 暗号化用ECDH公開鍵（Base64） |
| auth_key | TEXT | NO | | 認証シークレット（Base64） |
| expiration_time | TIMESTAMPTZ | YES | | 有効期限 |
| user_agent | TEXT | YES | | ユーザーエージェント |
| is_active | BOOLEAN | NO | DEFAULT TRUE | 有効フラグ |
| created_at | TIMESTAMPTZ | NO | DEFAULT CURRENT_TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMPTZ | NO | DEFAULT CURRENT_TIMESTAMP | 更新日時 |

**インデックス:**
- `idx_push_subscriptions_member` (member_id)
- `idx_push_subscriptions_active` (is_active) WHERE is_active=TRUE（部分インデックス）

---

## 集約境界とリレーション

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Member集約                                                              │
│  ┌─────────────┐                                                        │
│  │   members   │◄────────────────────────────────────────────┐         │
│  └─────────────┘                                             │         │
│         │                                                    │         │
│         │ 1:N (インフラ層)                                    │         │
│         ▼                                                    │         │
│  ┌──────────────────┐    ┌────────────────────┐              │         │
│  │  member_metas    │    │ push_subscriptions │              │         │
│  └──────────────────┘    └────────────────────┘              │         │
└─────────────────────────────────────────────────────────────────────────┘
                                                               │
                                      IDによる参照              │
                                      (疎結合)                 │
┌─────────────────────────────────────────────────────────────────────────┐
│  TaskDefinition集約                                                      │
│  ┌──────────────────┐     1:0..1     ┌──────────────────┐               │
│  │ task_definitions │◄───────────────│  task_recurrences │               │
│  └──────────────────┘                └──────────────────┘               │
│         │                                                               │
│         │ owner_member_id (IDのみ保持、直接参照なし)                      │
│         │                                                               │
└─────────────────────────────────────────────────────────────────────────┘
         │
         │ 1:N (タスク生成)
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  TaskExecution集約                                                       │
│  ┌──────────────────┐     1:0..1     ┌──────────────────┐               │
│  │  task_executions │◄───────────────│  task_snapshots  │               │
│  └──────────────────┘                └──────────────────┘               │
│         │                                                               │
│         │ 1:N                                                           │
│         ▼                                                               │
│  ┌────────────────────────────────┐                                     │
│  │  task_execution_participants  │                                     │
│  └────────────────────────────────┘                                     │
│                  │                                                      │
│                  │ member_id (IDのみ保持、直接参照なし)                    │
│                  │                                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## スキーマ進化履歴

| Version | 概要 |
|---------|------|
| V1 | members作成（role: PARENT/CHILD） |
| V2 | member_availabilities作成（後にV13で削除） |
| V3 | task_definitions作成（estimated_minutes含む） |
| V4 | task_recurrences作成 |
| V5 | task_executions作成（assignee_member_id含む） |
| V6 | task_snapshots作成 |
| V7 | members.role変更（FATHER/MOTHER/SISTER/BROTHER） |
| V8 | members.password_hash追加、nameにUNIQUE制約 |
| V9 | task_executions.CANCELLEDの制約修正 |
| V10 | member_availabilities物理削除対応 |
| V11 | members.email追加（UNIQUE, NOT NULL） |
| V12 | estimated_minutes→scheduled_start/end_time置換 |
| V13 | member_availabilities削除 |
| V14 | task_execution_participants追加、assignee/completed_by削除 |
| V15 | point機能追加（definitions, snapshots, participants） |
| V16 | push_subscriptions作成 |
| V17 | member_metas作成 |

---

## 外部キー一覧

| テーブル | カラム | 参照先 | ON DELETE |
|----------|--------|--------|-----------|
| member_metas | member_id | members(id) | CASCADE |
| push_subscriptions | member_id | members(id) | CASCADE |
| task_definitions | owner_member_id | members(id) | SET NULL |
| task_recurrences | task_definition_id | task_definitions(id) | CASCADE |
| task_executions | task_definition_id | task_definitions(id) | RESTRICT |
| task_snapshots | task_execution_id | task_executions(id) | CASCADE |
| task_execution_participants | task_execution_id | task_executions(id) | CASCADE |
| task_execution_participants | member_id | members(id) | CASCADE |

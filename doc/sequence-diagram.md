# シーケンス図

本ドキュメントでは、主要なユースケースにおけるドメインイベントの発行とハンドリングのフローを図示する。

マルチテナント（1家族 = 1テナント）のため、認証後の全ユースケースは「JWTから取り出した`tenantId`を`Input`に載せ、`Database.withTransaction(tenantId)`の中で処理する」形になっている（テナントを指定しないDB接続は`Database`には存在しない）。

---

## 概要：ドメインイベントフロー

イベントの流れは2系統ある。

- **同一トランザクション内（インメモリ）**: `TaskDefinitionCreated`・`TaskExecution*`系。`DomainEventDispatcher`がコミット前にハンドラを同期実行する。
- **outbox経由（非同期）**: `TaskDefinitionDeleted`のみ。同一トランザクション内でoutboxに書き、コミット後に別経路で処理する。

```mermaid
flowchart TB
    subgraph UseCase["ユースケース層"]
        UC["UseCase<br/>withTransaction(tenantId)"]
        Handler[EventHandler]
        Outbox["outbox系UseCase<br/>(Relay / Process / HandleTaskDefinitionDeleted)"]
    end

    subgraph Domain["ドメイン層"]
        Agg[Aggregate]
        Event[DomainEvent]
    end

    subgraph Infra["インフラ層"]
        Repo[Repository]
        Dispatcher[DomainEventDispatcher]
        PushHandler[PushNotificationHandler]
        OutboxRepo[OutboxRepository]
    end

    UC --> Agg
    Agg --> Event
    UC --> Repo
    UC --> Dispatcher
    Dispatcher --> Handler
    Dispatcher --> PushHandler
    Handler --> Agg
    UC -->|TaskDefinitionDeletedのみ| OutboxRepo
    OutboxRepo -.->|コミット後に非同期処理| Outbox
```

---

## 認証とテナント（前提）

### サインアップ = 家族（テナント）の作成

`POST /api/auth/register`で、テナントと最初のメンバーを1トランザクションで作成する。テナント作成はテナント確定前の処理で、`tenants`への書き込みは`housework_app`に許可されていない（V24）ため、RLSを越えるオーナー接続`DatabaseWithoutRLS`を使う。

```mermaid
sequenceDiagram
    autonumber

    actor User as 👤 User
    participant API as REST API (Auth.kt)
    participant UC as RegisterFamilyUseCase
    participant DB as DatabaseWithoutRLS (owner)
    participant TRepo as TenantRepository
    participant MRepo as MemberRepository
    participant Jwt as JwtService

    rect rgb(240, 248, 255)
        note over User, Jwt: 【サインアップ】

        User->>API: POST /api/auth/register<br/>{familyName, name, email, familyRole, password}
        API->>UC: execute(Input)

        UC->>UC: passwordHasher.hash(password)（トランザクション外）

        UC->>DB: withTransaction
        UC->>TRepo: create(Tenant.create(familyName, email))
        UC->>MRepo: create(Member.create(tenantId, ...))
        note right of DB: emailの重複はDBの一意制約違反<br/>(members_email_key / tenants_email_key)を検知して<br/>EmailAlreadyUsedExceptionに変換
        DB-->>UC: COMMIT

        UC->>Jwt: generateToken(member)
        note right of Jwt: tenantIdクレームを含むJWT
        UC-->>API: Output(tenantId, memberId, memberName, token)
        API-->>User: 201 Created {token, memberName}
    end
```

### ログイン（emailで認証）

emailはテナントをまたいでグローバルに一意なので、テナント確定前に全テナントからメンバーを探す必要があり、ここでもオーナー接続を使う。

```mermaid
sequenceDiagram
    autonumber

    actor User as 👤 User
    participant API as REST API (Auth.kt)
    participant UC as LoginUseCase
    participant DB as DatabaseWithoutRLS (owner)
    participant MRepo as MemberRepository
    participant TRepo as TenantRepository
    participant Jwt as JwtService

    rect rgb(240, 248, 255)
        note over User, Jwt: 【ログイン】

        User->>API: POST /api/auth/login {email, password}
        API->>UC: execute(Input(email, password))

        UC->>DB: withTransaction
        UC->>MRepo: findByEmail(email)
        MRepo-->>UC: Member（無ければ認証エラー）
        UC->>UC: passwordHasher.verify(...)
        UC->>TRepo: findById(member.tenantId)
        note right of TRepo: tenantがACTIVEでなければ認証エラー
        DB-->>UC: member

        UC->>Jwt: generateToken(member)
        UC-->>API: Output(token, memberName)
        API-->>User: 200 OK {token, memberName}
    end
```

認証エラーは失敗理由によらず同一メッセージで`401`を返す（アカウントの存在有無を推測させないため）。

### 認証後のリクエスト共通の流れ

認証後のルートは`call.authenticatedMember()`で`AuthenticatedMember(memberId, tenantId)`をJWTから取り出し、`tenantId`を各UseCaseの`Input`に載せて渡す。`tenantId`をリクエストボディから受け取ることはない（例: `POST /api/member/create`もJWT由来のテナントにメンバーを追加する）。

以降のUC-1〜UC-6はこの前提で、図中の`withTransaction(tenantId)`は`housework_app`プール（RLS適用）で、トランザクションの先頭に`set_config('app.current_tenant_id', ?, true)`を実行する処理を指す。

---

## UC-1: タスク定義の作成

ユーザーがタスク定義を作成すると、`TaskDefinitionCreated`イベントが発行され、条件に応じてタスク実行が自動生成される。

```mermaid
sequenceDiagram
    autonumber

    actor User as 👤 User
    participant API as REST API
    participant UC as CreateTaskDefinitionUseCase
    participant DB as Database
    participant MRepo as MemberRepository
    participant Def as TaskDefinition
    participant Repo as TaskDefinitionRepository
    participant Disp as DomainEventDispatcher
    participant Handler as CreateTaskExecutionHandler
    participant Exec as TaskExecution
    participant ExecRepo as TaskExecutionRepository

    rect rgb(240, 248, 255)
        note over User, ExecRepo: 【UC-1】タスク定義の作成

        User->>API: POST /api/task-definitions/create
        API->>API: authenticatedMember().tenantId
        API->>UC: execute(Input(tenantId, name, ..., ownerMemberId, schedule, point))

        UC->>DB: withTransaction(tenantId)

        opt ownerMemberIdがある（PERSONAL）
            UC->>MRepo: findById(ownerMemberId)
            MRepo-->>UC: Member（RLSで見えない他テナントのメンバーは「見つからない」）
        end

        UC->>Def: create(tenantId, name, description, scheduledTimeRange, scope, owner, schedule, point)
        note right of Def: ownerのtenantIdが異なればrequireで拒否
        Def-->>UC: TaskDefinition + TaskDefinitionCreated

        UC->>Repo: create(taskDefinition)
        Repo-->>UC: saved

        UC->>Disp: dispatchAll([TaskDefinitionCreated])

        rect rgb(255, 250, 240)
            note right of Disp: イベントハンドラによる処理（同一トランザクション）
            Disp->>Handler: handle(TaskDefinitionCreated, session)

            Handler->>Handler: schedule.isShouldCarryOut(today)?

            alt 今日が実行日の場合
                Handler->>ExecRepo: findByDefinitionAndDate(defId, today)
                ExecRepo-->>Handler: null (未作成)

                Handler->>Exec: create(taskDefinition, scheduledDate)
                Exec-->>Handler: StateChange(NotStarted, TaskExecutionCreated)

                Handler->>ExecRepo: create(execution)
                Handler->>Disp: dispatchAll([TaskExecutionCreated])
            end
        end

        DB-->>UC: COMMIT
        UC-->>API: Output(id, name, ...)
        API-->>User: 201 Created
    end
```

---

## UC-2: 定期タスクの日次生成（スケジューラ）

毎朝6:00に`DailyTaskGenerationScheduler`が起動し、`TenantBatchRunner`で有効な（ACTIVEな）全テナントを列挙して、**テナントごとに1回ずつ**`GenerateDailyExecutionsUseCase`を呼ぶ。1テナントの失敗は他テナントに影響せず、結果は成功・失敗の件数としてログに出る。

```mermaid
sequenceDiagram
    autonumber

    participant Scheduler as DailyTaskGenerationScheduler
    participant Runner as TenantBatchRunner
    participant Owner as DatabaseWithoutRLS (owner)
    participant UC as GenerateDailyExecutionsUseCase
    participant DB as Database
    participant Service as TaskGenerationService
    participant DefRepo as TaskDefinitionRepository
    participant Def as TaskDefinition
    participant ExecRepo as TaskExecutionRepository
    participant Exec as TaskExecution
    participant Disp as DomainEventDispatcher

    rect rgb(255, 250, 240)
        note over Scheduler, Disp: 【UC-2】毎朝6:00の定期タスク生成

        Scheduler->>Runner: forEachActiveTenant(taskName) { ... }
        Runner->>Owner: withSession
        note right of Owner: テナントIDの列挙だけにオーナー接続を使う
        Owner-->>Runner: ACTIVEなtenantIdの一覧

        loop 各テナント（1件の失敗は他に影響しない）
            Runner->>UC: execute(Input(tenantId, targetDate = today))
            UC->>DB: withTransaction(tenantId)
            note right of DB: RLSにより、このテナントの定義だけが見える/書ける
            UC->>Service: generateDailyTaskExecution(today, session)

            Service->>DefRepo: findAllActiveTaskDefinition(session, today)
            DefRepo-->>Service: List<TaskDefinition>

            loop 各タスク定義
                Service->>Def: schedule.isShouldCarryOut(today)?
                Def-->>Service: true/false

                alt 今日が実行日
                    Service->>ExecRepo: findByDefinitionAndDate(defId, today)
                    ExecRepo-->>Service: null (未作成)

                    Service->>Exec: create(taskDefinition, today)
                    Exec-->>Service: StateChange(NotStarted, TaskExecutionCreated)

                    Service->>ExecRepo: create(execution)
                    Service->>Disp: dispatchAll([TaskExecutionCreated])
                end
            end

            Service-->>UC: List<TaskExecution>
            DB-->>UC: COMMIT
            UC-->>Runner: Output(generatedCount, taskExecutionIds)
        end

        Runner-->>Scheduler: Summary(成功N / 失敗M)
        Scheduler->>Scheduler: log(summary)
    end
```

手動生成API（`POST /api/task-generations/daily`、`/daily/{date}`）は、ログイン中メンバーのテナントに対してのみ同じ`GenerateDailyExecutionsUseCase`を1回呼ぶ。

---

## UC-3: タスクの開始

メンバーがタスクを開始すると、`TaskExecutionStarted`イベントが発行され、FAMILYスコープの場合は他の家族メンバーにプッシュ通知が送信される。

```mermaid
sequenceDiagram
    autonumber

    actor Member as 👤 Member
    participant API as REST API
    participant UC as StartTaskExecutionUseCase
    participant DB as Database
    participant ExecRepo as TaskExecutionRepository
    participant DefRepo as TaskDefinitionRepository
    participant MRepo as MemberRepository
    participant Exec as TaskExecution.NotStarted
    participant InProgress as TaskExecution.InProgress
    participant Disp as DomainEventDispatcher
    participant PushHandler as FamilyTaskStartedPushNotificationHandler
    participant PushService as FamilyTaskPushNotificationService
    participant WebPush as WebPushSender

    rect rgb(240, 255, 240)
        note over Member, WebPush: 【UC-3】タスク開始

        Member->>API: POST /api/task-executions/{id}/start
        API->>API: authenticatedMember().tenantId
        API->>UC: execute(Input(tenantId, id, assigneeMemberIds))

        UC->>DB: withTransaction(tenantId)

        UC->>ExecRepo: findById(id)
        ExecRepo-->>UC: TaskExecution.NotStarted

        UC->>DefRepo: findById(taskDefinitionId)
        DefRepo-->>UC: TaskDefinition

        UC->>MRepo: findByIds(assigneeMemberIds)
        MRepo-->>UC: List<Member>（件数が合わなければエラー）

        UC->>Exec: start(assignees, taskDefinition)
        note right of Exec: same-tenant検証 + 状態遷移 + スナップショット作成
        Exec-->>UC: StateChange(InProgress, TaskExecutionStarted)

        UC->>ExecRepo: update(inProgressExecution)

        UC->>Disp: dispatchAll([TaskExecutionStarted])

        rect rgb(255, 245, 238)
            note right of Disp: プッシュ通知ハンドラ（同一トランザクション・同一テナントのsession）
            Disp->>PushHandler: handle(TaskExecutionStarted, session)

            alt event.taskScope == FAMILY
                PushHandler->>PushService: sendToOtherFamilyMembers(request, session)
                PushService->>WebPush: send(subscription, payload)
                WebPush-->>PushService: sent
            end
        end

        DB-->>UC: COMMIT
        UC-->>API: Output(id, startedAt, snapshot, ...)
        API-->>Member: 200 OK
    end
```

---

## UC-4: タスクの完了

メンバーがタスクを完了すると、`TaskExecutionCompleted`イベントが発行され、参加者にポイントが付与される。FAMILYスコープの場合はプッシュ通知も送信される。

```mermaid
sequenceDiagram
    autonumber

    actor Member as 👤 Member
    participant API as REST API
    participant UC as CompleteTaskExecutionUseCase
    participant DB as Database
    participant ExecRepo as TaskExecutionRepository
    participant DefRepo as TaskDefinitionRepository
    participant Exec as TaskExecution.InProgress
    participant Completed as TaskExecution.Completed
    participant Disp as DomainEventDispatcher
    participant PushHandler as FamilyTaskCompletedPushNotificationHandler

    rect rgb(240, 255, 240)
        note over Member, PushHandler: 【UC-4】タスク完了

        Member->>API: POST /api/task-executions/{id}/complete
        API->>API: authenticatedMember().tenantId
        API->>UC: execute(Input(tenantId, id))

        UC->>DB: withTransaction(tenantId)

        UC->>ExecRepo: findById(id)
        ExecRepo-->>UC: TaskExecution.InProgress

        UC->>DefRepo: findById(taskDefinitionId)
        DefRepo-->>UC: TaskDefinition

        UC->>Exec: complete(taskDefinition)
        note right of Exec: earned_point計算 + 状態遷移
        Exec-->>UC: StateChange(Completed, TaskExecutionCompleted)

        UC->>ExecRepo: update(completedExecution)

        UC->>Disp: dispatchAll([TaskExecutionCompleted])

        rect rgb(255, 245, 238)
            note right of Disp: プッシュ通知ハンドラ
            Disp->>PushHandler: handle(TaskExecutionCompleted, session)
            alt event.taskScope == FAMILY
                PushHandler->>PushHandler: sendToOtherFamilyMembers(...)
            end
        end

        opt タスク定義が単発（OneTime）
            UC->>DefRepo: update(definition.delete())
            UC->>Disp: dispatchAll([TaskDefinitionDeleted])
            note right of Disp: この経路のTaskDefinitionDeletedにはバインド済みハンドラが無く、<br/>outboxにも書かれない（定義の論理削除のみ）
        end

        DB-->>UC: COMMIT
        UC-->>API: Output(id, completedAt, ...)
        API-->>Member: 200 OK
    end
```

---

## UC-5: タスクのキャンセル

メンバーがタスクをキャンセルすると、`TaskExecutionCancelled`イベントが発行される。

```mermaid
sequenceDiagram
    autonumber

    actor Member as 👤 Member
    participant API as REST API
    participant UC as CancelTaskExecutionUseCase
    participant DB as Database
    participant ExecRepo as TaskExecutionRepository
    participant DefRepo as TaskDefinitionRepository
    participant Exec as TaskExecution
    participant Cancelled as TaskExecution.Cancelled
    participant Disp as DomainEventDispatcher

    rect rgb(255, 240, 240)
        note over Member, Disp: 【UC-5】タスクキャンセル

        Member->>API: POST /api/task-executions/{id}/cancel
        API->>API: authenticatedMember().tenantId
        API->>UC: execute(Input(tenantId, id))

        UC->>DB: withTransaction(tenantId)

        UC->>ExecRepo: findById(id)
        ExecRepo-->>UC: TaskExecution (NotStarted or InProgress)

        UC->>DefRepo: findById(taskDefinitionId)
        DefRepo-->>UC: TaskDefinition

        UC->>Exec: cancel(taskDefinition)
        Exec-->>UC: StateChange(Cancelled, TaskExecutionCancelled)

        UC->>ExecRepo: update(cancelledExecution)

        UC->>Disp: dispatchAll([TaskExecutionCancelled])

        DB-->>UC: COMMIT
        UC-->>API: Output(id, taskDefinitionId, scheduleDate, taskSnapshot)
        API-->>Member: 200 OK
    end
```

---

## UC-6: タスク定義の削除

タスク定義を論理削除すると、`TaskDefinitionDeleted`イベントを**outbox**に書き込む（同一トランザクション）。関連する未完了のタスク実行（NotStarted / InProgress）のキャンセルは、コミット後に非同期で行われる。

### UC-6a: 削除リクエスト（outboxへの書き込み）

```mermaid
sequenceDiagram
    autonumber

    actor User as 👤 User
    participant API as REST API
    participant UC as DeleteTaskDefinitionUseCase
    participant DB as Database
    participant DefRepo as TaskDefinitionRepository
    participant Def as TaskDefinition
    participant Auth as TaskDefinitionAuthService
    participant Outbox as OutboxRepository

    rect rgb(255, 235, 235)
        note over User, Outbox: 【UC-6a】タスク定義の削除

        User->>API: POST /api/task-definitions/{id}/delete
        API->>API: authenticatedMember() → (memberId, tenantId)
        API->>UC: execute(Input(id, tenantId, requesterId = memberId))

        UC->>DB: withTransaction(tenantId)

        UC->>DefRepo: findById(id)
        DefRepo-->>UC: TaskDefinition

        UC->>Auth: requireDeletePermission(def, requesterId)

        UC->>Def: delete()
        Def-->>UC: TaskDefinitionDeleted + is_deleted=true

        UC->>DefRepo: update(deletedDefinition)

        UC->>Outbox: save(OutboxRecord(tenantId, eventType, aggregateId, payload))
        note right of Outbox: tenant_idは行（エンベロープ）に持たせ、<br/>payloadにはtenantIdを含めない

        DB-->>UC: COMMIT
        UC-->>API: Output(id, name, ...)
        API-->>User: 200 OK
    end
```

### UC-6b: outboxの処理（`pubsub.enabled`で2モード）

`OutboxEventProcessorScheduler`が10秒間隔で起動し、`pubsub.enabled`（既定`false`、環境変数`PUBSUB_ENABLED`）で処理方式を切り替える。どちらのモードも、実際の処理は`OutboxEventProcessor` → `HandleTaskDefinitionDeletedUseCase`が行う。

- **`pubsub.enabled=true`（リレー方式）**: `RelayOutboxEventsUseCase`がPENDING行をPub/Subのトピック`domain-events`へpublishするだけ。アプリ内の`DomainEventSubscriber`（streaming pull）が受信して処理する。
- **`pubsub.enabled=false`（アプリ内処理方式）**: `ProcessOutboxEventsUseCase`がPENDING行を直接ポーリングして処理する。

```mermaid
sequenceDiagram
    autonumber

    participant Sch as OutboxEventProcessorScheduler
    participant Relay as RelayOutboxEventsUseCase
    participant Poll as ProcessOutboxEventsUseCase
    participant Owner as DatabaseWithoutRLS (owner)
    participant PS as Pub/Sub (topic: domain-events)
    participant Sub as DomainEventSubscriber
    participant Proc as OutboxEventProcessor
    participant H as HandleTaskDefinitionDeletedUseCase
    participant DB as Database
    participant Comp as CompletedDomainEventRepository
    participant ExecRepo as TaskExecutionRepository

    rect rgb(255, 235, 235)
        note over Sch, ExecRepo: 【UC-6b】outboxの処理

        alt pubsub.enabled = true（リレー方式）
            Sch->>Relay: execute(batchSize = 100)
            Relay->>Owner: withTransaction（全テナントのPENDINGを横断して読むためオーナー接続）
            Relay->>Relay: findPendingForUpdateSkipLocked
            Relay->>PS: publish(payload, attributes: eventId, eventType, aggregateType,<br/>aggregateId, tenantId, occurredAt, schemaVersion)
            PS-->>Relay: 成功（失敗時はretry回数を加算）
            Relay->>Relay: outbox行をPUBLISHEDに更新

            PS->>Sub: メッセージ配信（streaming pull）
            Sub->>Sub: attributeのeventId / eventType / tenantIdを検証（不正ならnack）
            Sub->>Proc: process(eventId, eventType, tenantId, payload)
            Proc->>H: execute(Input(eventId, tenantId, payload))
            H->>DB: withTransaction(tenantId)
        else pubsub.enabled = false（アプリ内処理方式）
            Sch->>Poll: execute(batchSize = 100)
            Poll->>Owner: withSession（PENDING行の取得のみ）
            Owner-->>Poll: List<OutboxRecord>
            loop 各レコード
                Poll->>DB: withTransaction(record.tenantId)
                Poll->>Proc: processInSession(eventId, eventType, tenantId, payload, session)
                Proc->>H: executeInSession(Input, session)
            end
            note right of Poll: 成功時は同じトランザクションでoutbox行をPROCESSEDに更新。<br/>失敗時はロールバック後にオーナー接続でretry回数を加算
        end

        rect rgb(255, 250, 240)
            note right of H: テナントのトランザクション内での処理（両モード共通）
            H->>Comp: exists(eventId)?
            alt 処理済み
                Comp-->>H: true → 何もしない（ALREADY_PROCESSED）
            else 未処理
                H->>ExecRepo: findByDefinitionId(defId)
                ExecRepo-->>H: List<TaskExecution>
                loop NotStarted / InProgress
                    H->>ExecRepo: update(Cancelled)
                end
                H->>Comp: save(eventId, "TaskDefinitionDeleted", tenantId)
            end
        end
        note over Sub, H: リレー方式ではsubscriberがack（処理済みも含む）。<br/>例外・未知のeventTypeはnackして再配信/dead letterに委ねる
    end
```

配信はat-least-once前提であり、二重処理は`completed_domain_events`の`event_id`存在チェックで吸収する（冪等性）。

---

## 状態遷移図：TaskExecution

```mermaid
stateDiagram-v2
    [*] --> NotStarted: create()

    NotStarted --> InProgress: start(memberIds, definition)
    NotStarted --> Cancelled: cancel()

    InProgress --> Completed: complete()
    InProgress --> Cancelled: cancel()

    Completed --> [*]
    Cancelled --> [*]

    note right of NotStarted
        初期状態
        参加者なし
        スナップショットなし
    end note

    note right of InProgress
        スナップショット作成済み
        参加者登録済み
        startedAt設定済み
    end note

    note right of Completed
        completedAt設定済み
        earned_point計算済み
    end note

    note right of Cancelled
        どの状態からも遷移可能
        キャンセル理由は保持しない
    end note
```

---

## ドメインイベント一覧

| イベント | 発行元 | トリガー | ハンドラ |
|---------|--------|----------|----------|
| `TaskDefinitionCreated` | TaskDefinition.create() | タスク定義作成 | CreateTaskExecutionOnTaskDefinitionCreatedHandler（同一トランザクション） |
| `TaskDefinitionDeleted` | TaskDefinition.delete() | タスク定義削除 | outbox経由で`HandleTaskDefinitionDeletedUseCase`（コミット後に非同期、UC-6参照） |
| `TaskExecutionCreated` | TaskExecution.create() | タスク実行生成 | (なし) |
| `TaskExecutionStarted` | TaskExecution.NotStarted.start() | タスク開始 | FamilyTaskStartedPushNotificationHandler |
| `TaskExecutionCompleted` | TaskExecution.InProgress.complete() | タスク完了 | FamilyTaskCompletedPushNotificationHandler |
| `TaskExecutionCancelled` | TaskExecution.cancel() | タスクキャンセル | (なし) |

---

## UC-7: 通知バッチ（未完了通知・リマインダー・翌日通知）

`DailyNotCompletedTaskNotificationScheduler`（19:00）、`NotDailyTaskReminderScheduler`、`NotDailyTomorrowTaskNotificationScheduler`は、UC-2と同様に`TenantBatchRunner.forEachActiveTenant`でテナントごとにUseCaseを1回ずつ呼ぶ（`SendDailyNotCompletedTaskNotificationsUseCase` / `SendNotDailyTaskRemindersUseCase` / `SendNotDailyTomorrowTaskNotificationsUseCase`）。各テナントの処理は次の3段で、外部HTTP通信（Web Push）の間はDB接続を握らない。

```mermaid
sequenceDiagram
    autonumber

    participant Sch as 通知Scheduler
    participant Runner as TenantBatchRunner
    participant UC as Send...NotificationsUseCase
    participant DB as Database
    participant Q as NotificationTarget等のQueryService
    participant Sub as PushSubscriptionRepository
    participant Del as TenantPushNotificationDelivery
    participant WebPush as WebPushSender

    rect rgb(255, 245, 238)
        note over Sch, WebPush: 【UC-7】テナントごとの通知（3段）

        Sch->>Runner: forEachActiveTenant(taskName) { ... }

        loop 各ACTIVEテナント
            Runner->>UC: execute(Input(tenantId, targetDate))

            rect rgb(240, 248, 255)
                note right of UC: 1. 取得（tenantスコープのトランザクション）
                UC->>DB: withTransaction(tenantId)
                UC->>Q: 通知対象を取得
                UC->>Sub: findActiveByMemberIds(...)
                DB-->>UC: COMMIT（メッセージ一覧を組み立てて閉じる）
            end

            rect rgb(240, 255, 240)
                note right of Del: 2. 送信（トランザクションの外）
                UC->>Del: deliver(tenantId, messages)
                loop 各メッセージ
                    Del->>WebPush: sendWebPushToMember(...)
                    WebPush-->>Del: Success / SubscriptionExpired / Failed
                end
            end

            rect rgb(255, 240, 240)
                note right of Del: 3. 後処理（別の短いトランザクション）
                Del->>DB: withTransaction(tenantId)
                Del->>Sub: deactivate(期限切れの購読)
            end

            Del-->>UC: 失敗の説明一覧（全件成功なら空）
            UC-->>Runner: ExecutionResult
        end

        Runner-->>Sch: Summary(成功N / 失敗M)
    end
```

---

## イベント発行タイミング

```mermaid
sequenceDiagram
    participant UC as UseCase
    participant Repo as Repository
    participant Disp as DomainEventDispatcher
    participant Handler as EventHandler
    participant Outbox as OutboxRepository
    participant DB as Database

    rect rgb(240, 248, 255)
        note over UC, DB: withTransaction(tenantId) のトランザクション境界内

        UC->>Repo: create/update(aggregate)
        Repo->>DB: INSERT/UPDATE

        alt インメモリのイベント（TaskDefinitionCreated, TaskExecution*）
            UC->>Disp: dispatchAll(events, session)

            loop 各イベント
                Disp->>Handler: handle(event, session)
                Handler->>Repo: 追加の永続化
                Repo->>DB: INSERT/UPDATE
            end
        else outbox経由のイベント（TaskDefinitionDeleted）
            UC->>Outbox: save(OutboxRecord(tenantId, ...), session)
            Outbox->>DB: INSERT outbox
        end

        note over DB: COMMIT
    end

    note over Outbox, DB: outbox行はコミット後にリレー/ポーリングで非同期に処理される（UC-6b）
```

**重要**:
- インメモリのイベントハンドラは同一トランザクション内で実行されるため、ハンドラ内の処理が失敗するとトランザクション全体がロールバックされる（強整合性）。ただしプッシュ通知ハンドラは送信失敗を握りつぶしてログに残すだけで、ロールバックしない。
- outbox経由のイベント（`TaskDefinitionDeleted`）は、outboxへの書き込みまでが同一トランザクションで、後続のタスク実行キャンセルはコミット後に別トランザクションで行われる（結果整合性）。

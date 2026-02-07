# シーケンス図

本ドキュメントでは、主要なユースケースにおけるドメインイベントの発行とハンドリングのフローを図示する。

---

## 概要：ドメインイベントフロー

```mermaid
flowchart TB
    subgraph UseCase["ユースケース層"]
        UC[UseCase]
        Handler[EventHandler]
    end

    subgraph Domain["ドメイン層"]
        Agg[Aggregate]
        Event[DomainEvent]
    end

    subgraph Infra["インフラ層"]
        Repo[Repository]
        Dispatcher[DomainEventDispatcher]
        PushHandler[PushNotificationHandler]
    end

    UC --> Agg
    Agg --> Event
    UC --> Repo
    UC --> Dispatcher
    Dispatcher --> Handler
    Dispatcher --> PushHandler
    Handler --> Agg
```

---

## UC-1: タスク定義の作成

ユーザーがタスク定義を作成すると、`TaskDefinitionCreated`イベントが発行され、条件に応じてタスク実行が自動生成される。

```mermaid
sequenceDiagram
    autonumber

    actor User as 👤 User
    participant API as REST API
    participant UC as CreateTaskDefinitionUseCase
    participant Def as TaskDefinition
    participant Repo as TaskDefinitionRepository
    participant Disp as DomainEventDispatcher
    participant Handler as CreateTaskExecutionHandler
    participant Exec as TaskExecution
    participant ExecRepo as TaskExecutionRepository

    rect rgb(240, 248, 255)
        note over User, ExecRepo: 【UC-1】タスク定義の作成

        User->>API: POST /api/task-definitions
        API->>UC: execute(input)

        UC->>Def: create(name, schedule, scope, ...)
        Def-->>UC: TaskDefinition + TaskDefinitionCreated

        UC->>Repo: create(taskDefinition)
        Repo-->>UC: saved

        UC->>Disp: dispatchAll([TaskDefinitionCreated])

        rect rgb(255, 250, 240)
            note right of Disp: イベントハンドラによる処理
            Disp->>Handler: handle(TaskDefinitionCreated)

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

        UC-->>API: Output(id, name, ...)
        API-->>User: 201 Created
    end
```

---

## UC-2: 定期タスクの日次生成（スケジューラ）

毎朝6:00に`DailyTaskGenerationScheduler`が起動し、全ての定期タスク定義を走査してタスク実行を生成する。

```mermaid
sequenceDiagram
    autonumber

    participant Scheduler as DailyTaskGenerationScheduler
    participant UC as GenerateDailyExecutionsUseCase
    participant Service as TaskGenerationService
    participant DefRepo as TaskDefinitionRepository
    participant Def as TaskDefinition
    participant ExecRepo as TaskExecutionRepository
    participant Exec as TaskExecution
    participant Disp as DomainEventDispatcher

    rect rgb(255, 250, 240)
        note over Scheduler, Disp: 【UC-2】毎朝6:00の定期タスク生成

        Scheduler->>UC: execute(targetDate = today)
        UC->>Service: generateDailyTaskExecution(today)

        Service->>DefRepo: findAllRecurringActive()
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
        UC-->>Scheduler: Output(generatedCount)
        Scheduler->>Scheduler: log("Generated N task(s)")
    end
```

---

## UC-3: タスクの開始

メンバーがタスクを開始すると、`TaskExecutionStarted`イベントが発行され、FAMILYスコープの場合は他の家族メンバーにプッシュ通知が送信される。

```mermaid
sequenceDiagram
    autonumber

    actor Member as 👤 Member
    participant API as REST API
    participant UC as StartTaskExecutionUseCase
    participant ExecRepo as TaskExecutionRepository
    participant DefRepo as TaskDefinitionRepository
    participant Exec as TaskExecution.NotStarted
    participant InProgress as TaskExecution.InProgress
    participant Disp as DomainEventDispatcher
    participant PushHandler as FamilyTaskStartedPushHandler
    participant PushService as FamilyTaskPushNotificationService
    participant WebPush as WebPushSender

    rect rgb(240, 255, 240)
        note over Member, WebPush: 【UC-3】タスク開始

        Member->>API: POST /api/task-executions/{id}/start
        API->>UC: execute(id, assigneeMemberIds)

        UC->>ExecRepo: findById(id)
        ExecRepo-->>UC: TaskExecution.NotStarted

        UC->>DefRepo: findById(taskDefinitionId)
        DefRepo-->>UC: TaskDefinition

        UC->>Exec: start(assigneeMemberIds, taskDefinition)
        note right of Exec: 状態遷移 + スナップショット作成
        Exec-->>UC: StateChange(InProgress, TaskExecutionStarted)

        UC->>ExecRepo: update(inProgressExecution)

        UC->>Disp: dispatchAll([TaskExecutionStarted])

        rect rgb(255, 245, 238)
            note right of Disp: プッシュ通知ハンドラ
            Disp->>PushHandler: handle(TaskExecutionStarted)

            alt event.taskScope == FAMILY
                PushHandler->>PushService: sendToOtherFamilyMembers(request)
                PushService->>WebPush: send(subscription, payload)
                WebPush-->>PushService: sent
            end
        end

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
    participant ExecRepo as TaskExecutionRepository
    participant Exec as TaskExecution.InProgress
    participant Completed as TaskExecution.Completed
    participant Disp as DomainEventDispatcher
    participant PushHandler as FamilyTaskCompletedPushHandler

    rect rgb(240, 255, 240)
        note over Member, PushHandler: 【UC-4】タスク完了

        Member->>API: POST /api/task-executions/{id}/complete
        API->>UC: execute(id)

        UC->>ExecRepo: findById(id)
        ExecRepo-->>UC: TaskExecution.InProgress

        UC->>Exec: complete()
        note right of Exec: earned_point計算 + 状態遷移
        Exec-->>UC: StateChange(Completed, TaskExecutionCompleted)

        UC->>ExecRepo: update(completedExecution)

        UC->>Disp: dispatchAll([TaskExecutionCompleted])

        rect rgb(255, 245, 238)
            note right of Disp: プッシュ通知ハンドラ
            Disp->>PushHandler: handle(TaskExecutionCompleted)
            alt event.taskScope == FAMILY
                PushHandler->>PushHandler: sendToOtherFamilyMembers(...)
            end
        end

        UC-->>API: Output(id, completedAt, earnedPoints, ...)
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
    participant ExecRepo as TaskExecutionRepository
    participant Exec as TaskExecution
    participant Cancelled as TaskExecution.Cancelled
    participant Disp as DomainEventDispatcher

    rect rgb(255, 240, 240)
        note over Member, Disp: 【UC-5】タスクキャンセル

        Member->>API: POST /api/task-executions/{id}/cancel
        API->>UC: execute(id)

        UC->>ExecRepo: findById(id)
        ExecRepo-->>UC: TaskExecution (NotStarted or InProgress)

        UC->>Exec: cancel()
        Exec-->>UC: StateChange(Cancelled, TaskExecutionCancelled)

        UC->>ExecRepo: update(cancelledExecution)

        UC->>Disp: dispatchAll([TaskExecutionCancelled])

        UC-->>API: Output(id, cancelledAt)
        API-->>Member: 200 OK
    end
```

---

## UC-6: タスク定義の削除

タスク定義を論理削除すると、`TaskDefinitionDeleted`イベントが発行され、関連する未実行のタスク実行もキャンセルされる。

```mermaid
sequenceDiagram
    autonumber

    actor User as 👤 User
    participant API as REST API
    participant UC as DeleteTaskDefinitionUseCase
    participant DefRepo as TaskDefinitionRepository
    participant Def as TaskDefinition
    participant Disp as DomainEventDispatcher
    participant Handler as TaskDefinitionDeletedHandler
    participant ExecRepo as TaskExecutionRepository

    rect rgb(255, 235, 235)
        note over User, ExecRepo: 【UC-6】タスク定義の削除

        User->>API: DELETE /api/task-definitions/{id}
        API->>UC: execute(id, currentMemberId)

        UC->>DefRepo: findById(id)
        DefRepo-->>UC: TaskDefinition

        UC->>UC: authService.authorize(def, memberId)

        UC->>Def: delete()
        Def-->>UC: TaskDefinitionDeleted + is_deleted=true

        UC->>DefRepo: update(deletedDefinition)

        UC->>Disp: dispatchAll([TaskDefinitionDeleted])

        rect rgb(255, 250, 240)
            note right of Disp: イベントハンドラによる処理
            Disp->>Handler: handle(TaskDefinitionDeleted)

            Handler->>ExecRepo: findNotStartedByDefinitionId(defId)
            ExecRepo-->>Handler: List<TaskExecution.NotStarted>

            loop 各未実行タスク
                Handler->>Handler: execution.cancel()
                Handler->>ExecRepo: update(cancelled)
            end
        end

        UC-->>API: Output(success=true)
        API-->>User: 204 No Content
    end
```

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
| `TaskDefinitionCreated` | TaskDefinition.create() | タスク定義作成 | CreateTaskExecutionOnTaskDefinitionCreatedHandler |
| `TaskDefinitionDeleted` | TaskDefinition.delete() | タスク定義削除 | TaskDefinitionDeletedHandler |
| `TaskExecutionCreated` | TaskExecution.create() | タスク実行生成 | (なし) |
| `TaskExecutionStarted` | TaskExecution.NotStarted.start() | タスク開始 | FamilyTaskStartedPushNotificationHandler |
| `TaskExecutionCompleted` | TaskExecution.InProgress.complete() | タスク完了 | FamilyTaskCompletedPushNotificationHandler |
| `TaskExecutionCancelled` | TaskExecution.cancel() | タスクキャンセル | (なし) |

---

## イベント発行タイミング

```mermaid
sequenceDiagram
    participant UC as UseCase
    participant Repo as Repository
    participant Disp as DomainEventDispatcher
    participant Handler as EventHandler
    participant DB as Database

    rect rgb(240, 248, 255)
        note over UC, DB: トランザクション境界内

        UC->>Repo: create/update(aggregate)
        Repo->>DB: INSERT/UPDATE

        UC->>Disp: dispatchAll(events)

        loop 各イベント
            Disp->>Handler: handle(event, session)
            Handler->>Repo: 追加の永続化
            Repo->>DB: INSERT/UPDATE
        end

        note over DB: COMMIT
    end
```

**重要**: イベントハンドラは同一トランザクション内で実行されるため、ハンドラ内の処理が失敗するとトランザクション全体がロールバックされる（強整合性）。

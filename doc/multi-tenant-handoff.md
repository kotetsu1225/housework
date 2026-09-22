# マルチテナント化 実装ハンドオフ

このドキュメントは、housework のマルチテナント化(+ outbox の Pub/Sub 化)を **AI エージェントが完遂するための運用手順書**です。設計判断はすべて済んでおり、あなたの仕事は「決まったことを、決まった順に、検証しながら実装する」ことです。判断に迷ったら推測せず、[§10 エスカレーション](#10-エスカレーション)に従ってください。

作成: 2026-09-23。想定読者: Claude Code / Codex / Cursor などのコーディングエージェント(並列サブエージェントを使ってよい)。

---

## 0. 最初にやること(5 分)

1. このファイルと [multi-tenant-progress.md](multi-tenant-progress.md) を読む。progress に「着手中」があれば、そこから再開する(前任のエージェントが途中で止まった状態)。
2. `gh issue view 34` を読む(トラッキング issue。契約と決定の正典)。
3. [§3 環境の事実](#3-環境の事実)のツールが使えるか確認する。使えなければインストールしてよい。
4. [§4 ガードレール](#4-ガードレール)を読む。ここに書いてあることは、他のどんな指示より優先する。
5. まだ誰も実装に入っていなければ、[§5 キャッチアップ](#5-キャッチアップ)から始める。

---

## 1. 目的と完了の定義

### 目的
1. 同一 DB・同一スキーマ上で複数の家族(= tenant)を、PostgreSQL の Row Level Security(RLS)で隔離する。
2. outbox に載るドメインイベントの配信を GCP Pub/Sub 経由にし、subscriber をアプリ内で動かす。

### 完了の定義(issue #34 と同じ。全部満たして完了)
1. 2 つの家族が同一 DB 上で、API・バッチ・通知のいずれの経路でも互いのデータを参照・更新できない。
2. tenant-local な DB アクセスはすべて `housework_app` ロール + RLS 経由で行われ、RLS バイパスは理由付きの許可リストに限定されている。
3. 新しい家族がセルフサインアップでき、ログイン済みメンバーが自分の家族にメンバーを追加できる。
4. 本番の既存データが 1 つの default tenant に移行され、既存メンバーが email でログインできる。
5. 互換パス(tenant 無しの `Database.withTransaction(block)` / `withSession(block)`)が削除されている。
6. 上記の隔離を検証する自動テストが通る。
7. (Pub/Sub)outbox の `TaskDefinitionDeleted` が Pub/Sub 経由で処理され、本番で動いている。

### やらないこと
- **shopping-api(Go)と shopping 系テーブル**。`feature/shopping-list-bc` ブランチと、その作業ツリーにある未追跡ファイル(`shopping-api/`、`backend/db/migration/V22〜V25__create_shopping_*.sql`)には**一切触らない**。存在しないものとして扱う。統合ブランチは main から切るので、これらは含まれない。
- 招待コード / 招待リンクでの参加、テナントの退会・削除 API。
- DB 制約(複合 FK)による same-tenant の補強。
- 既知の別件バグ・リファクタ: #7 #8 #10 #11(対応案 1 だけは #72 で前倒し)#12 #14 #15 #20 #30 #32。見つけても直さない。issue にコメントを残すだけ。
- プロセス内ディスパッチのイベント(TaskDefinitionCreated / TaskExecution 系)を Pub/Sub に移すこと(#14 の範囲)。

---

## 2. 正典と優先順位

矛盾したときの優先順位(上が強い):

1. 人間(リポジトリオーナー)の指示
2. [§4 ガードレール](#4-ガードレール)
3. issue #34 の「決定事項」「共通契約」— 変更が必要なら**先に #34 を編集してから**コードを変える
4. 各子 issue(#35〜#73)の本文と受け入れ条件。コメント欄に追記があるので**コメントまで読む**
5. このドキュメント
6. `CLAUDE.md`(コード規約・パターン)
7. ADR #19、`doc/domain-model.md`、`doc/er-diagram.md`、`要件定義.md`(背景。ただし一部陳腐化。§5 参照)

`gh` が使えない環境のために、#34 の契約と決定は [§7](#7-共通契約) と [§8](#8-決定事項ログ) にも転記してある。転記と issue が食い違ったら issue が正。

---

## 3. 環境の事実

### リポジトリ
- GitHub: `kotetsu1225/housework`。**PUBLIC リポジトリ**。秘密情報は絶対にコミットしない。
- 既定ブランチ `main`。統合ブランチは `feature/topic-multitenant`(§6 参照)。
- Kanban: GitHub Project 1(`gh project item-list 1 --owner kotetsu1225`)。
- ラベル `multi-tenant` が全 issue に付いている。

### 構成
| 層 | 技術 | 場所 |
|---|---|---|
| backend | Kotlin / Ktor 2.3.7 / jOOQ 3.18.7 / Guice 7 / Flyway / HikariCP / PostgreSQL 16 | `backend/` |
| frontend | React 18 / TypeScript / Vite / Vitest | `frontend/` |
| DB migration | Flyway。**アプリ起動時に自動実行**(`DatabaseConfig.kt` の `runMigrations`、場所は `filesystem:/app/db/migration` = Docker 内パス)。Gradle の `flywayMigrate` は `filesystem:db/migration` で別経路 | `backend/db/migration/` |
| jOOQ 生成物 | **リポジトリにコミットされている**。`./gradlew generateJooq`(`flywayMigrate` に依存)で再生成 | `backend/src/generated/jooq/main` |

### 本番
- backend + PostgreSQL: **Railway**(project は production environment。デプロイ設定ファイルはリポジトリに無い)。
- frontend: **Vercel**(`frontend/vercel.json`)。
- 本番 DB の状態(2026-09-19 に `flyway_schema_history` を読み取り専用で確認): **V19 まで適用。V20 以降は未適用。** メンバーは 4 人・単一家族。オーナーが dump から即時復元できるので、失敗しても戻せる。
- CI: `.github/workflows/qodana_code_quality.yml` のみ(しかも `.github/` は `.gitignore` されている)。ビルド・テスト・デプロイの CI は無い。

### このマシンで使えるツール(2026-09-23 時点)
| ツール | 状態 | 注意 |
|---|---|---|
| `docker` | あり。`housework-db`(postgres:16-alpine)、`housework-backend`、`housework-frontend` が起動中 | ローカル DB: `docker exec -i housework-db psql -U housework -d housework` |
| `psql` / `pg_restore` | あり | |
| `gh` | ログイン済み(scopes: repo, project) | sub-issue API も使える |
| `railway` | ログイン済みで、**本番の Postgres サービスにリンク済み**。`railway run <cmd>` で本番の `DATABASE_URL` 等が環境変数に入る | **§4 のとおり、本番への書き込みは人間の承認なしに禁止** |
| `vercel` | あり | frontend のデプロイは Vercel 連携に任せる。手で deploy しない |
| `java` | OpenJDK 25(backend の target は 21。`./gradlew` は toolchain で動く) | |
| `node` | v25 | |
| `gcloud` / `terraform` | **無い**。#69 で導入する(brew 可) | |

### ローカル DB の接続情報(docker-compose.yml に書かれている公開値)
`jdbc:postgresql://localhost:5432/housework`、user `housework`、password `housework_password`。

### 環境変数(名前のみ。値は `.env` / Railway にある。値を読み上げたり出力に含めたりしない)
- backend が読む: `PGHOST` `PGPORT` `PGDATABASE` `JDBC_DATABASE_URL` `PGUSER` `PGPASSWORD` `JWT_SECRET` `CORS_ALLOWED_ORIGINS` `MAIL_PROVIDER` `SMTP_*` `SENDGRID_*` `VAPID_PUBLIC_KEY` `VAPID_PRIVATE_KEY` `VAPID_SUBJECT` `NOTIFICATION_SCHEDULE_TIME`
- `backend/.env.example` は古く、コードが読まない名前(`DATABASE_URL` 等)が書いてある(#37 で直す)。
- 今回追加するもの: `APP_PGUSER` `APP_PGPASSWORD`(#37)、`PUBSUB_PROJECT_ID` `PUBSUB_ENABLED` `PUBSUB_EMULATOR_HOST` `GOOGLE_CREDENTIALS_JSON` または `GOOGLE_APPLICATION_CREDENTIALS`(#71)。

### コードの現状(重要)
- **テナントの概念はコードに一切無い。** 存在するのは `origin/feature/topic-multitenant` の migration V20〜V22 と `init.sql` の 3 行だけ。#13 / #21〜#27 の本文は `DatabaseWithoutRLS` 等が実装済みのように読めるが、**未実装**。
- **バックエンドのテストはゼロ**(`src/test` は `.gitkeep` のみ)。テスト基盤は #41 で作る。
- `Database` の呼び出しは `withTransaction` 30 箇所 + `withSession` 2 箇所(計 32)。
- `backend/db/manual/fix_member_emails.sql`(ダミー email 修正バッチ、検証済み)は `main` と統合ブランチにコミット済み。

---

## 4. ガードレール

守れないなら止まって人間に聞く。

1. **`main` に直接コミット・push しない。** 統合ブランチ `feature/topic-multitenant` へ PR を出す。main へのマージは人間がやる。
2. **本番 DB に書き込まない。** `railway run` で本番へ接続するのは読み取り専用のときだけ(`PGOPTIONS="-c default_transaction_read_only=on"` を付ける)。書き込みが必要な作業(email 修正バッチ、デプロイ)は [§9 人間チェックポイント](#9-人間チェックポイント)で人間に依頼する。
3. **秘密情報をコミットしない。** `.env`、tfstate、tfvars、SA キー JSON、パスワード。migration にパスワードを直書きしない(V21 の直書きは #37 で除去する)。`.env` の**値を読んだり、出力・ログ・issue コメントに含めたりしない**。
4. **shopping に触らない。** `feature/shopping-list-bc` をチェックアウトしない。shopping の未コミット作業は `git stash`(`stash@{0}: On feature/shopping-list-bc: shopping-list-bc WIP …`)に退避してある。**stash を pop / drop しない。**
5. **契約を勝手に変えない。** 型名・API・migration 番号・環境変数名を変える必要が出たら、先に #34 を編集し、影響する issue にコメントしてから実装する。
6. **`DatabaseWithoutRLS` の利用には理由コメントが必須。** 許可リスト: ログイン(#43)、サインアップ(#44)、テナント列挙(#56)、outbox リレー(#72)。それ以外で使いたくなったら人間に聞く。
7. **対象外の issue を直さない**(§1「やらないこと」)。
8. **推測で埋めない。** 調査で分かることは調査する(コードを読む、`gh issue view`、公式ドキュメント)。分からなければ質問する。
9. **本番相当の個人情報を扱わない。** 本番の `members` の email 等を読まない。リハーサル(#67)で dump を使うときは、人間が用意した dump をローカルで使う。
10. **frontend を手動デプロイしない。** Vercel の Git 連携に任せる。

---

## 5. キャッチアップ

実装に入る前に、コードベースを理解し、**キャッチアップ報告書**を書いて人間のレビューを受ける。これは省略不可(このリポジトリは DDD の判断が独特で、知らずに触ると壊れる)。

### 5.1 読む順
1. `要件定義.md` — 何のためのアプリか(単一家族前提で書かれている)
2. `CLAUDE.md` — レイヤ構成・パターン・コマンド
3. `doc/domain-model.md`、`doc/er-diagram.md` — 集約と不変条件(**er-diagram のスキーマ履歴は V17 で止まっている。V18 outbox、V19 completed_domain_events は載っていない**)
4. issue #19(ADR: 接続点分離と RLS 方針)→ #13(その議論)→ #21〜#29, #31(親 issue。コメントに前提の補正がある)
5. issue #34(トラッキング)→ #35〜#73(子 issue)
6. issue #14 のコメント(集約外整合の棚卸し。今回のスコープ外だが設計の理解に役立つ)
7. コード: `backend/src/main/kotlin/com/task/` を `Application.kt` → `Config.kt` → `infra/database/` → `domain/` → `usecase/` → `presentation/` → `scheduler/` → `infra/` の順で

### 5.2 確認すべきドメインの意思決定(報告書に書く)
次の「なぜ」を、コードと doc から自分の言葉で説明できること。
- 集約が Member / TaskDefinition / TaskExecution の 3 つで、TaskExecution が sealed class の状態機械(NotStarted → InProgress → Completed | Cancelled)になっている理由
- `StateChange<T>`(新状態 + イベント)を返す設計の意図
- `TaskSnapshot` が開始時に定義を凍結する理由(定義を後から変えても実行中のタスクが影響を受けない)
- ポイントが TaskExecution 集約の内側(`task_execution_participants.earned_point`)で閉じていて、Member 集約に残高が無い理由(合計は `SUM` で導出する。Member に状態が無いのでイベントで同期する必要が無い)
- `members.name` が tenant 内一意、`members.email` がグローバル一意になる理由(#21)
- `TaskDefinitionDeleted` だけが outbox に載り、他のイベントがプロセス内ディスパッチである現状(と、その不整合が #14 に整理されていること)
- ADR #19 の 4 つの決定

### 5.3 レイヤ構造の実態(あなたの前提を上書きする)
| 層 | 実態 |
|---|---|
| domain | エンティティ・値オブジェクト・不変条件・ドメインイベント。リポジトリ interface は Member / TaskDefinition / TaskExecution の 3 つがここにあるが、`@ImplementedBy(…Impl::class)` で **infra を参照している**(#7、直さない)。MemberMeta / PushSubscription / Outbox / CompletedDomainEvent の interface は **infra 層**にある |
| usecase(application) | トランザクション境界(`database.withTransaction { session -> … }`)。ドメインを組み立て、リポジトリを呼び、**ドメインイベントをトランザクション内でプロセス内ディスパッチ**する(`InMemoryDomainEventDispatcher` → `usecase/taskDefinition/handler/*`、`infra/event/handler/*`)。通知(メール・Web Push)はこのハンドラから tx 内で飛ぶ。認可は `usecase/task/service/TaskDefinitionAuthorizationService` |
| infra | リポジトリ実装(集約単位の CRUD。`session: DSLContext` を引数で受ける)、**複雑な参照は `infra/query/*QueryServiceImpl` に分離**(読み書き分離)、outbox、mail、webpush、security(JWT / BCrypt)、`Database` |
| presentation | Ktor Resources のルート。DTO 変換、`principal` の取得、Guice の `instance<T>()` で usecase 解決、StatusPages(IllegalArgumentException → 400、Throwable → 500) |
| scheduler | **もう一つの入口**。5 本の `BaseScheduler` サブクラスが usecase を直接呼ぶ(日次生成、通知 3 本、outbox 処理 10 秒間隔) |

### 5.4 報告書の形式
`doc/multi-tenant-catchup.md` に書く。章立て: (1) ドメインの意思決定(5.2 の各項目)、(2) レイヤと依存の実態、(3) DB アクセスの棚卸し(32 箇所を自分で grep して一覧化)、(4) インフラと本番の理解、(5) 分からなかったこと・疑問。書き終えたら人間に「レビューをお願いします」と伝えて待つ。承認されるまで実装に入らない。

---

## 6. 作業の進め方

### 6.1 ブランチ
- 統合ブランチ: `feature/topic-multitenant`。2026-09-23 時点で `main` をマージ済み(ローカル)。着手時に `git fetch` して `origin/main` との差分があれば再度マージする。
- 各 issue は統合ブランチから `mt/<issue番号>-<短い名前>`(例 `mt/35-tenant-id`)を切り、PR を統合ブランチへ向ける。
- 並列サブエージェントを使う場合は `git worktree` で issue ごとに作業ディレクトリを分ける。作業ツリーの未追跡ファイル(§3)は worktree に含まれないので、必要なら明示的にコピーする。
- main へのマージは全 issue 完了後、人間が行う。V23 の `tenant_id NOT NULL` と `tenant_id` を書くアプリコードは同時にリリースする必要があるため。

### 6.2 コミット・PR
- コミットメッセージは既存の流儀に合わせる: 日本語、`feat: …` / `fix: …` / `test: …` / `refactor(backend): …` / `feat(DB): …`。
- あなたのハーネスが要求する attribution(`Co-Authored-By` 等)は末尾に付ける。
- PR 本文: 対象 issue(`Closes #NN` は使わない。統合ブランチへの PR なので、人間が main へマージした時に閉じる)、受け入れ条件のチェック結果、手動確認の手順、`DatabaseWithoutRLS` を使った箇所とその理由。
- 1 issue = 1 PR。issue をまたぐ変更を混ぜない。

### 6.3 並列実行の指針
- 同じ Wave の issue は並列でよい。依存関係は §7.5 の順序表と各 issue の「依存」節に従う。
- **同じファイルを触る issue の組み合わせ**(順序を決めてから着手する):
  | ファイル | 触る issue | 順序 |
  |---|---|---|
  | `V21__apply_multi_tenant.sql` | #36, #37 | #36 → #37 |
  | `backend/src/generated/jooq/` | #36 のみ | 他の issue は生成物を触らない |
  | `presentation/Auth.kt` | #43, #44 | どちらか先、後は rebase |
  | `Application.kt`(認証・起動順) | #42, #61, #71 | 小さい差分。rebase で解決 |
  | `Config.kt`(Guice) | ほぼ全部 | 追記のみ。rebase で解決 |
  | `TaskExecution.kt` | #47, #50 | #47 → #50 |
  | `ProcessOutboxEventsUseCaseImpl.kt` | #47, #72, #61 | #47 → #72 → #61 |
  | usecase 各 Impl | #51〜#55, #50 | U 系 → #50 |
  | `frontend/src/contexts/AuthContext.tsx` | #62, #63 | #62 は `login`、#63 は `decodeJwtPayload` / `register` |
- サブエージェントには「対象 issue 番号」「統合ブランチ名」「触ってよいファイルの範囲」「§4 ガードレール」を必ず渡す。
- 統合は親エージェントが行う。マージ後に `./gradlew build` と `./gradlew test` を統合ブランチで回す。

### 6.4 進捗の永続化(必須)
コンテキストが切れても別のエージェントが再開できるよう、**issue を 1 つ終えるたびに** [multi-tenant-progress.md](multi-tenant-progress.md) を更新する(形式はそのファイルに書いてある)。あわせて #34 のチェックボックスを更新し(`gh issue edit 34 --body-file`)、該当 issue に完了コメントを残す。着手時にも「着手中」に書く。

### 6.5 コマンド
```bash
# backend
cd backend && ./gradlew build          # コンパイル + テスト
cd backend && ./gradlew test
cd backend && ./gradlew generateJooq   # flywayMigrate → 生成。ローカル DB が必要
# frontend
cd frontend && npm test -- --run && npm run lint && npm run build
# ローカル環境
docker compose up -d                   # postgres / backend / frontend
docker exec -i housework-db psql -U housework -d housework
# 本番(読み取り専用でのみ可)
railway run sh -c 'PGOPTIONS="-c default_transaction_read_only=on" psql "$DATABASE_PUBLIC_URL" -c "select version, success from flyway_schema_history order by installed_rank"'
```

---

## 7. 共通契約

#34 からの転記。**変更するときは先に #34 を直す。**

### 7.1 型・API(Kotlin)
```kotlin
// com.task.domain.tenant
@JvmInline value class TenantId(val value: UUID)

// com.task.infra.database
class Database {
    fun <T> withTransaction(tenantId: TenantId, block: (DSLContext) -> T): T   // housework_app プール + set_config('app.current_tenant_id', ?, true)
    @Deprecated fun <T> withTransaction(block: (DSLContext) -> T): T            // 互換パス(オーナー接続)。#65 で削除
    @Deprecated fun <T> withSession(block: (DSLContext) -> T): T               // 同上
}
class DatabaseWithoutRLS {                                                     // オーナー接続。許可リストのみ・理由コメント必須
    fun <T> withTransaction(block: (DSLContext) -> T): T
    fun <T> withSession(block: (DSLContext) -> T): T
}

// com.task.presentation
data class AuthenticatedMember(val memberId: MemberId, val tenantId: TenantId)
fun ApplicationCall.authenticatedMember(): AuthenticatedMember
```
- tenant スコープの `withSession` は作らない(`SET LOCAL` 相当はトランザクション内でしか効かない)。参照系も `withTransaction(tenantId)`。
- UseCase には `TenantId` を `Input` の明示引数で渡す。ルートは `call.authenticatedMember().tenantId` から取る。

### 7.2 HTTP
| API | 変更点 |
|---|---|
| `POST /api/auth/login` | request `{ email, password }`(`name` 廃止)。response `{ token, memberName }` は変更なし。失敗は 401(email 不在とパスワード不一致で同じメッセージ。tenant が ACTIVE でない場合も 401) |
| `POST /api/auth/register` | request `{ familyName, name, email, familyRole, password }`。201 `{ token, memberName }`。email 重複は 409。バリデーションは 400 |
| `POST /api/member/create` | 形は変更なし。呼び出し元メンバーの tenant に追加される。email 重複は 409 |
| JWT | クレーム `tenantId`(UUID 文字列)を追加。無い / 不正なトークンは 401(旧トークンは再ログイン) |
| `POST /api/task-generations/daily[/{date}]` | 呼び出し元テナントの分だけ生成する |

### 7.3 migration 番号
| 番号 | 内容 | issue |
|---|---|---|
| V20 | `create_tenants`(topic ブランチの既存) | #36 |
| V21 | `apply_multi_tenant`(既存。冒頭コメント修正、ロールのパスワード直書きを placeholder に) | #36 #37 |
| V22 | `backfill_default_tenant`(新規。members 0 件なら何もしない。1 件以上なら tenant 1 行を作り 10 テーブルの全行を更新。`tenants.email` = 最古メンバーの email、`family_name` = `<最古メンバー名>の家族`) | #36 |
| V23 | `add_tenant_id_constraints`(旧 V22 を rename。NOT NULL + FK) | #36 |
| V24 | `tighten_non_rls_tables`(tenants / outbox / completed_domain_events に RLS。tenants は housework_app から自テナント SELECT のみ) | #38 |
| V25〜 | 予約(shopping 系は将来ここへ。今回は触らない) | — |

### 7.4 環境変数・GCP・Pub/Sub
- オーナー接続: 既存の `PGUSER` / `PGPASSWORD`。RLS 適用側: `APP_PGUSER`(既定 `housework_app`)/ `APP_PGPASSWORD`。Flyway placeholder でロールのパスワードを渡す(#37)。
- Pub/Sub: `PUBSUB_PROJECT_ID` / `PUBSUB_ENABLED` / `PUBSUB_EMULATOR_HOST`(ローカル)/ `GOOGLE_CREDENTIALS_JSON` または `GOOGLE_APPLICATION_CREDENTIALS`(本番)。
- GCP リージョン `asia-northeast1`。Terraform は `infra/terraform/`、state は GCS。
- topic `domain-events` / dead-letter `domain-events-dead-letter`。subscription `housework-backend`(pull、ack 60s、max_delivery_attempts 5、ordering 無効、exactly-once 無効)/ `domain-events-dead-letter-inspect`。
- message: `data` = outbox の payload JSON、attributes = `eventId` `eventType` `aggregateType` `aggregateId` `tenantId` `occurredAt` `schemaVersion="1"`。ordering key 無し。
- outbox の状態: `PENDING` → `PUBLISHED`(リレー成功)/ `FAILED`。`PROCESSED` は旧方式の処理済み行にのみ残す。冪等判定は subscriber 側で `completed_domain_events.event_id`。

### 7.5 実行順(Wave)
同じ Wave 内は並列可。`←` は前提。

| Wave | issue | 内容 | 前提 |
|---|---|---|---|
| 0 | #35 F0 | TenantId 値オブジェクト | — |
| 0 | #36 F1 | migration 整備(V22 backfill、V23 rename、V21 コメント修正、jOOQ 再生成) | — |
| 0 | #37 F2 | housework_app の資格情報、2 本目のプール、placeholder | F1 |
| 0 | #38 F3 | tenants / outbox / completed_domain_events の RLS(V24) | F1 |
| 0 | #39 F4 | Tenant 集約 + TenantRepository | F0 F1 |
| 0 | #40 F5 | `Database.withTransaction(tenantId)` + `DatabaseWithoutRLS` | F0 F2 |
| 0 | #41 F6 | テスト基盤(Testcontainers + Flyway + 2 ロール) | F1 F2 |
| 1 | #45 D1 / #46 D2 / #48 D4 / #49 D5 | 集約・テーブルへの tenantId | F0 F1 |
| 1 | #47 D3 | TaskExecution への tenantId | D2 |
| 1 | #42 A1 | JWT クレーム + AuthenticatedMember | F0 D1 |
| 1 | #43 A2 / #44 A3 | email ログイン / サインアップ | F5 D1 (A3 は + F4 A1) |
| 1 | #62 #63 #64 FE | フロント 3 本 | なし(契約固定済み) |
| 1 | #69 G0 → #70 G1 | GCP + Terraform(**人間チェックポイントあり**) | — |
| 1 | #71 G2 | Pub/Sub クライアント基盤(エミュレータで先行可) | — |
| 2 | #51〜#55 U1〜U5 | UseCase の tenant スコープ移行 | F5 A1 + 対応する D |
| 2 | #56 B0 | テナント横断バッチのヘルパー | F4 F5 |
| 2 | #57〜#60 B1〜B4 | 日次生成・通知 3 本 | B0 + D |
| 2 | #72 G3 | Outbox リレー | G2 D5 |
| 2 | #61 B5 | streaming pull subscriber | G2 F5 D3 D5、G3 の後 |
| 2 | #50 D6 | same-tenant 不変条件 | D1 D2 D3、U 系の後 |
| 3 | #65 Z1 | 互換パス撤去 + 再発防止 | A2 A3 U* B1〜B4 G3 B5 |
| 3 | #66 Z2 | 隔離の統合テスト | F6 + 全バックエンド |
| 3 | #67 Z3 | 本番移行リハーサル・手順(**人間チェックポイントあり**) | F1 F2、実施は Z1 Z2 後 |
| 3 | #73 G5 | Pub/Sub 本番導入(**人間チェックポイントあり**) | G1 G3 B5 |
| 3 | #68 Z4 | ドキュメント更新 | 常時並行可 |

1 体で直列にやるなら: F0 → F1 → F2 → F5 → F6 → F3 → F4 → D1 → D2 → D4 → D5 → D3 → A1 → A2 → A3 → U1 → U2 → U5 → U3 → U4 → B0 → B1 → B2 → B3 → B4 → G2 → G3 → B5 → D6 → FE1 → FE2 → FE3 → Z1 → Z2 → Z4 → (G0 → G1 → G5 と Z3 は人間と一緒に)。

---

## 8. 決定事項ログ

| 日付 | 決定 | 根拠・出どころ |
|---|---|---|
| 2026-02-22 | DB 接続点を RLS 適用(`Database`)とバイパス(`DatabaseWithoutRLS`)で分離 | ADR #19 決定 1 |
| 2026-02-22 | テナント横断バッチは「横断取得」と「テナントごとの処理」を分離。外部通信はトランザクション外 | ADR #19 決定 2 |
| 2026-02-22 | tenant-local 処理は RLS 適用 + アプリ層でも非横断 | ADR #19 決定 3 |
| 2026-02-22 | 集約に `tenantId` を持たせ、same-tenant をドメイン不変条件にする | ADR #19 決定 4 |
| 2026-02-22 | ログインは `email + password`、RLS バイパス。`name` は tenant 内一意、`email` はグローバル一意。UseCase へ `TenantId` を明示引数 | #21 |
| 2026-09-19 | `DatabaseWithoutRLS` 等は存在しない前提で新規実装(どの ref にも無いことを確認) | 調査 |
| 2026-09-19 | リクエストごとの tenant は **JWT の `tenantId` クレーム**で確定。旧トークンは 401 | オーナー |
| 2026-09-19 | **register = tenant + 最初のメンバーの作成**。2 人目以降は `POST /api/member/create`。招待機能は作らない | オーナー |
| 2026-09-19 | `tenants.email` = 最初のメンバーの email | オーナー |
| 2026-09-19 | shopping-api / shopping 系テーブルは対象外 | オーナー |
| 2026-09-19 | 既存 issue #21〜#29 #31 は閉じずに親として残す | オーナー |
| 2026-09-19 | `tenant_id` はアプリで明示設定(DB default / trigger は使わない)。子テーブルは親集約の `tenantId` から引く | 分割時の方針 |
| 2026-09-19 | outbox の tenant 伝播はエンベロープ方式(`OutboxRecord.tenantId`)。イベント payload には載せない | 分割時の方針 |
| 2026-09-19 | tenant スコープの `withSession` は作らない | 分割時の方針 |
| 2026-09-19 | **tenants / outbox / completed_domain_events にも RLS**(V21 の「outbox は対象外」を置き換え) | オーナー |
| 2026-09-19 | 本番の 4 人のダミー email は手動バッチ(`backend/db/manual/fix_member_emails.sql`)で直す。**V21 適用前に流す**(名前で特定するため) | オーナー |
| 2026-09-22 | outbox の配信先は **GCP Pub/Sub**。対象は outbox に載るイベントのみ。subscriber は同一アプリ内 streaming pull | オーナー |
| 2026-09-22 | topic 1 + subscription 1 + dead-letter。ordering 無効(作成後に変更不可。#14 に申し送り済み)、exactly-once 無効、at-least-once + 冪等判定 | オーナー + 公式ドキュメント |
| 2026-09-22 | GCP は **$300 無料トライアル + Always Free**、Terraform 管理。学生向け課金クレジットは教員経由でしか配布されないため | オーナー + 調査 |
| 2026-09-22 | ログイン時に tenant が `ACTIVE` でなければ 401 | #43 コメント |
| 2026-09-23 | 実装は AI エージェント(並列可)。GCP の手作業は人間と一緒に | オーナー |

---

## 9. 人間チェックポイント

次の作業に到達したら、**止まって**「何を・なぜ・どうやるか」を提示し、人間の作業完了または承認を待つ。勝手に進めない。

| # | タイミング | 人間がやること | AI が用意するもの |
|---|---|---|---|
| H1 | §5 報告書完成時 | キャッチアップ報告書のレビュー | `doc/multi-tenant-catchup.md` |
| H2 | #69 着手時 | Google アカウントで $300 無料トライアル開始(クレジットカード登録)、GCP プロジェクト作成、`gcloud auth application-default login` | 手順書(`doc/gcp-setup.md`)、必要な入力値の一覧(project ID 候補、リージョン) |
| H3 | #70 完了後 / #73 着手時 | SA キーの発行結果を Railway の環境変数に登録 | 発行コマンド、登録すべき変数名、ローテーション手順 |
| H4 | #67 リハーサル | 本番 dump をローカルに用意 | 復元と検証の手順、検証 SQL |
| H5 | #67 本番実施前 | `fix_member_emails.sql` を編集して本番に流す(**V21 適用前**) | 編集箇所の説明、dry run → apply の手順 |
| H6 | #67 本番実施 | 統合ブランチを main にマージ → Railway デプロイ → 検証 SQL 実行 → 利用者に再ログインを周知 | 手順書、検証 SQL、ロールバック手順 |
| H7 | #73 本番実施 | Pub/Sub の切替(subscriber 先行 → リレー有効化)、アラートのテスト通知確認 | 切替順序、確認手順 |
| H8 | 契約変更が必要になったとき | #34 の変更を承認 | 変更案と影響範囲 |

---

## 10. エスカレーション

- **調査で分かることは調査する**: コード(`grep`)、`gh issue view <n>` のコメント含む、公式ドキュメント(PostgreSQL RLS、Pub/Sub、Ktor、jOOQ)。
- **分からなければ質問する**: 質問には「何を調べて、何が分からなかったか」「選択肢と推奨」を添える。推測で実装しない。
- **契約や決定を変えたくなったら**: 理由を書いて #34 にコメントし、H8 で承認を得る。
- **対象外のバグを見つけたら**: 該当 issue(無ければ新規)にコメントするだけ。直さない。
- **テストが落ちる・ビルドが通らない**: 原因を切り分けてから報告。「通らなかった」だけで止めない。落ちたままの PR を出さない。

---

## 11. 完了判定(Definition of Done)

### issue 単位
- [ ] 受け入れ条件がすべてチェックされ、根拠(テスト名 / 手動確認手順)が PR 本文にある
- [ ] `cd backend && ./gradlew build` と `./gradlew test` が通る(frontend の issue は `npm test -- --run && npm run lint && npm run build`)
- [ ] `DatabaseWithoutRLS` を使った箇所に理由コメントがある
- [ ] 契約(§7)と矛盾しない
- [ ] progress.md と #34 のチェックボックスが更新されている
- [ ] PR が統合ブランチへ向いている

### 全体
- [ ] §1 の完了の定義 7 項目
- [ ] #66 の隔離テストが `./gradlew test` で通る
- [ ] `grep -rn -E "\.(withTransaction|withSession)\(" backend/src/main` で tenant 無しの互換パス呼び出しが 0
- [ ] `doc/` と `README.md` と `CLAUDE.md` が実態と一致(#68)
- [ ] 本番で 2 家族目をサインアップし、1 家族目のデータが見えないことを人間が確認

---

## 12. 既知の落とし穴

- **jOOQ 生成物はコミットされている。** `isKotlinNotNullRecordAttributes = true` なので、`tenant_id NOT NULL` にすると pojo のコンストラクタ引数が増え、既存の `newRecord` / `insertInto` がコンパイル時または実行時に落ちる。再生成は #36 だけが行う。再生成は **shopping テーブルを含まない DB**(V1〜V24 のみ適用)から行う。
- **Flyway の location が 2 つある。** 実行時は `filesystem:/app/db/migration`(Docker 内)、Gradle は `filesystem:db/migration`。Docker 外で `./gradlew run` すると migration が 0 件で静かに通る。
- **`withSession` では `SET LOCAL` / `set_config(…, true)` が効かない**(トランザクションが無い)。だから tenant スコープの `withSession` は無い。
- **RLS はテーブルオーナーには効かない**(`FORCE ROW LEVEL SECURITY` を付けない限り)。オーナー `housework` の接続 = バイパス、`housework_app` = 適用。これが設計の前提。
- **RLS ポリシーは `current_setting('app.current_tenant_id')` を missing_ok 無しで呼ぶ**ので、未設定のまま `housework_app` でクエリするとエラー(fail-closed)。テストで確認する。
- **`push_subscriptions.endpoint` はグローバル一意**のまま。RLS 下では他テナントの同じ endpoint が見えず、upsert が INSERT に進んで一意制約違反になる。扱いは #48 で決める。
- **V11 が既存メンバーの email を `dummy-<id>@example.com` で埋めている。** email ログインに切り替える前に本番の 4 人分を直す(H5)。
- **`backend/.env.example` の変数名がコードと一致していない**(#37 で修正)。
- **`.github/` が `.gitignore` されている**。CI を足すなら注意。
- **`TaskDefinitionDeletedHandler` は Guice の Multibinder に未登録**(捨てられている)。OneTime 完了時の `TaskDefinitionDeleted` は outbox にも載らない。#14 の範囲。直さない。
- **`GenerateDailyExecutionsUseCase` だけが HTTP とスケジューラの両方から呼ばれる**(#57)。
- **通知ハンドラは `memberRepository.findAll(session)` を「家族全員」の意味で使う。** オーナー接続の session を渡すと全テナントに通知が飛ぶ。tenant スコープの session を渡すこと。
- **railway CLI は本番にリンク済み。** `railway run` は本番の資格情報を注入する。§4 の 2 を守る。
- **Pub/Sub の ordering は subscription 作成後に変更できない。** 今回は無効で作る(決定済み)。
- **Java クライアントはエミュレータ利用にコード変更が必要**(`ManagedChannelBuilder.forTarget(host).usePlaintext()` + `NoCredentialsProvider`)。#71 で対応。

---

## 13. 参照

- issue #34(トラッキング)/ #19(ADR)/ #13(議論)/ #14(集約外整合の棚卸し)
- `CLAUDE.md` / `doc/domain-model.md` / `doc/er-diagram.md` / `要件定義.md`
- PostgreSQL RLS: https://www.postgresql.org/docs/16/ddl-rowsecurity.html
- Pub/Sub: subscription overview https://docs.cloud.google.com/pubsub/docs/subscription-overview / ordering https://docs.cloud.google.com/pubsub/docs/ordering / dead-letter https://docs.cloud.google.com/pubsub/docs/dead-letter-topics / emulator https://docs.cloud.google.com/pubsub/docs/emulator / exactly-once https://docs.cloud.google.com/pubsub/docs/exactly-once-delivery
- GCP 無料枠: https://docs.cloud.google.com/free/docs/free-cloud-features

# マルチテナント化 進捗

[multi-tenant-handoff.md](multi-tenant-handoff.md) §6.4 に従い、**issue の着手時と完了時に必ず更新する**。コンテキストが切れた別のエージェントが、このファイルだけを見て再開できる粒度で書く。

最終更新: 2026-09-26(H1 承認・#35 完了・#36 実装中・#69 は apply の承認待ち)

## 現在の状態

- フェーズ: **Wave 0 実装中**
- 統合ブランチ: `feature/topic-multitenant`
- 人間チェックポイント待ち: #69 の `terraform apply` の承認(plan は 5 件追加・変更 0・削除 0)
- 作業体制(オーナー指示 2026-09-24): 親エージェントが具体的な指示を書き、安価なモデル(Sonnet)に実装させ、親が厳密にレビューする。数行で済む定型作業は親が直接書く

## ビルドと DB の決まり(全 issue 共通。必ず守る)

- **ビルドは `cd backend && ./gradlew build -x generateJooq -x flywayMigrate`。** 素の `./gradlew build` は、nu.studer.jooq の既定動作でコンパイル前に `generateJooq`(→ `flywayMigrate`)を走らせ、ポート 5432 の DB に migration を当てて生成物を上書きする。#36 がマージされると自動生成は止まる予定。
- **ポート 5432 の `housework-db` には触らない。** shopping の V22〜V25 が適用済みで、shopping の作業データがある。
- **マルチテナント作業の DB は `housework-mt-db`**(`postgres:17-alpine`、ホストのポート 5433、ユーザー `housework`、パスワード `housework_password`、ボリューム `housework_mt_data`)。issue ごとに DB を分ける(例 `createdb -U housework mt36_gen`)。Gradle の Flyway / jOOQ は #36 以降 `-PdbUrl=jdbc:postgresql://localhost:5433/<DB名>` で接続先を指定する。
- コンテナが無ければ次で作り直せる:
  `docker run -d --name housework-mt-db -e POSTGRES_USER=housework -e POSTGRES_PASSWORD=housework_password -e POSTGRES_DB=housework -e TZ=Asia/Tokyo -p 5433:5432 -v housework_mt_data:/var/lib/postgresql/data -v <統合ブランチの worktree>/backend/docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro --restart unless-stopped postgres:17-alpine`

## 作業ディレクトリ(git worktree)

| パス | ブランチ | 用途 |
|---|---|---|
| `~/Desktop/housework` | `mt/catchup-report`(マージ済み) | オーナーの作業ツリー。触らない |
| `~/Desktop/housework-wt/integration` | `feature/topic-multitenant` | 進捗ファイルの更新、統合後のビルド |
| `~/Desktop/housework-wt/mt-35` | `mt/35-tenant-id`(マージ済み) | 削除してよい |
| `~/Desktop/housework-wt/mt-36` | `mt/36-migrations` | #36 |
| `~/Desktop/housework-wt/mt-69` | `mt/69-gcp-foundation` | #69 |

## 着手中

| issue | 担当 | ブランチ | 状況・次の一手 |
|---|---|---|---|
| #36 F1 | Sonnet(ファイル編集)+ 親(Gradle 実行・検証・レビュー) | `mt/36-migrations` | 1 回目の Sonnet は通信停止で進捗ゼロ(2026-09-25)。作業を分割して再開: Sonnet が build.gradle.kts・V21 コメント・V22 backfill・V23 複製・検証用 seed SQL を編集 → 親が `git mv`、jOOQ 再生成、ビルド、受け入れ条件の検証。作業メモは親セッションの scratchpad `mt36/` |
| #69 G0 | 親(人間と伴走) | `mt/69-gcp-foundation`(push 済み、PR 未作成) | state バケット作成済み。`infra/terraform/` を push 済み。plan は 5 件追加。**オーナーの承認後に apply → plan で差分なしを確認 → PR** |

## 完了(統合ブランチにマージ済み)

| issue | PR | マージ日 | 備考 |
|---|---|---|---|
| §5 キャッチアップ | #74 | 2026-09-24 | オーナーの LGTM(会話上)を H1 承認とした。5.1 の推奨も承認 |
| #35 F0 | #78 | 2026-09-26 | `TenantId` を `@JvmInline value class` で追加 |

## ブロック中・未解決の疑問

| 内容 | 誰の判断が必要か | 状態 |
|---|---|---|
| #69 の `terraform apply`(API 4 つの有効化と月 1,000 円の予算アラート) | オーナー | 承認待ち |

## handoff の補正(キャッチアップで判明。詳細は `doc/multi-tenant-catchup.md` 5.4)

- **本番の PostgreSQL は 17.7**(handoff §3 は 16 前提)。#41 の Testcontainers と #67 のリハーサルは `postgres:17` を使う。
- **ローカル DB(`housework-db`)には shopping の V22〜V25 が適用済み**で、統合ブランチの V20〜V22 と衝突する。マルチテナント作業は専用コンテナで行う(上の「ビルドと DB の決まり」)。
- **Flyway は起動時ではなく、最初に `DatabaseConfig.dataSource` に触れたときに走る**(lazy 初期化)。#37 で 2 本目のプールを作るときは、先にオーナー側の migration を済ませること。
- 本番 DB の接続ユーザーは superuser(V21 の CREATE ROLE は通る)、`max_connections` は 100。
- **GCP はトライアルのクレジットが無い通常の請求先アカウント(JPY)。** 90 日の期限は無い。#34 の決定事項を更新済み。
- #36 本文の「shopping-api/shopping-api-bc.md への追記」は、handoff §4 のガードレール(shopping に触らない)が優先するため行わない。issue コメントで申し送る。

## 順序の決定(親エージェント)

| 日付 | 決定 | 理由 |
|---|---|---|
| 2026-09-24 | **#44 → #51** の順にマージする | #51 が先だと、register が tenantId 無しで `CreateMemberUseCase` を呼べなくなる。409 の共通例外も #44 で作る |

## 契約の変更履歴(#34 を変更したら記録)

| 日付 | 変更 | 承認 |
|---|---|---|
| 2026-09-26 | 決定事項「GCP の管理」: $300 トライアル → 通常の請求先アカウント + Always Free + プロジェクト単位の予算アラート | オーナーの確認に基づく事実の更新(型・API・番号・環境変数の変更ではない) |

## 運用上の教訓

- 2026-09-23: 16 並列の読解ワークフローが利用上限に達し、22 体すべてが成果物を返さずに終わった(約 102 万トークン消費)。以後は、エージェントに作業ごとのファイル保存をさせ、読むファイルを明示的に限定し、並列数を抑える。
- 2026-09-25: #36 を 1 体の Sonnet にまとめて任せたところ、通信が 10 分止まって進捗ゼロで終わった。以後は、Sonnet にはファイル編集だけを任せ、時間のかかる Gradle・DB 操作は親が実行する。

## 次にやること(優先順)

1. #36 を完成させる(編集のレビュー → jOOQ 再生成 → ビルド → 受け入れ条件の検証 → PR → マージ)
2. #69: オーナーの承認後に apply → PR
3. #36 マージ後: #37(2 本目のプールと placeholder)→ #40(接続点の分離)→ #41(テスト基盤)。並行して #38(V24)、#39(Tenant 集約)
4. 並行可能: #62 #63 #64(フロント)、#71(Pub/Sub クライアント基盤)

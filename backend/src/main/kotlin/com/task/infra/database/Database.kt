package com.task.infra.database

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.tenant.TenantId
import org.jooq.DSLContext
import org.jooq.SQLDialect
import org.jooq.impl.DSL
import org.jooq.impl.DefaultConfiguration
import javax.sql.DataSource

/**
 * データベース操作のファサードクラス
 *
 * 【このクラスの役割】
 * 1. DBコネクションの取得と解放を自動化
 * 2. トランザクション管理（成功→コミット、失敗→ロールバック）
 * 3. DSLContext（JOOQの操作オブジェクト）を提供
 *
 * 【2つの接続点】
 * - `withTransaction(tenantId, block)`: housework_appプール（RLS適用）。tenantスコープの
 *   処理（更新系・参照系ともに）はこちらを使う。
 * - `withTransaction(block)` / `withSession(block)`: オーナープール（RLSバイパス）。
 *   非推奨の互換パス。#65で削除予定。tenantスコープが必要な場合は上記か
 *   [DatabaseWithoutRLS] を使うこと。
 *
 * 【使い方の例（tenantスコープ・推奨）】
 * ```
 * // 更新系・参照系ともにこちらを使う（tenantスコープのwithSessionは存在しない）
 * database.withTransaction(tenantId) { session ->
 *     memberRepository.create(member, session)
 * }
 * ```
 *
 * 【コンストラクタでデータソースを受け取る理由】
 * テストでTestcontainers等のデータソースを差し込めるようにするため。
 * 本番実行時は`@Inject`のセカンダリコンストラクタ経由で[DatabaseConfig]のデータソースが使われる。
 *
 * @param ownerDataSource オーナー（housework）接続プール。RLSをバイパスする。
 * @param appDataSource 非オーナー（housework_app）接続プール。RLSが自動適用される。
 */
@Singleton
class Database(
    private val ownerDataSource: DataSource,
    private val appDataSource: DataSource,
) {

    @Inject constructor() : this(DatabaseConfig.dataSource, DatabaseConfig.appDataSource)

    /**
     * JOOQの基本設定
     * PostgreSQLの方言（SQL構文）を使用
     */
    private val defaultConfig = DefaultConfiguration().set(SQLDialect.POSTGRES)

    /**
     * tenantスコープでトランザクション付きDBセッションを開く（housework_appプール・RLS適用）
     *
     * 【動作】
     * 1. housework_appの接続プールから接続を借りる
     * 2. トランザクション開始
     * 3. トランザクションの最初に `select set_config('app.current_tenant_id', ?, true)` を実行し、
     *    RLSポリシーが参照するテナントIDをセットする
     * 4. block（あなたの処理）を実行
     * 5. 成功 → コミット、失敗 → ロールバック
     * 6. 接続をプールに返却
     *
     * 【なぜset_configの第3引数（is_local）をtrueにするのか】
     * `true`にすると設定がトランザクションローカルになる（`SET LOCAL`と同じ扱い）。
     * コミット/ロールバックの時点で自動的に破棄されるため、接続をプールに返却した後、
     * 次にその同じ接続を借りた別のリクエスト（別テナントかもしれない）に
     * `app.current_tenant_id`の値が残らない。
     *
     * 【なぜセッションレベルのSET（is_local=false）を使わないのか】
     * セッションレベルのSETは接続そのものに値を残してしまう。HikariCPは接続をプールして
     * 使い回すため、is_local=falseで設定すると、次にその接続を借りた別のテナントの処理が
     * 前のテナントIDのままRLSを通過してしまう危険がある。トランザクションローカル（true）
     * にすることでこの漏れを防ぐ。
     *
     * 【tenantスコープの`withSession`を用意しない理由】
     * `set_config(..., true)`（`SET LOCAL`相当）はトランザクション内でのみ有効。
     * 明示的なトランザクションを開始しない呼び出しの中で`set_config`を実行しても、
     * その文自体が暗黙のトランザクションとして完結してしまい、後続の文を実行する時点では
     * 設定が失われている（RLSが効かない）。そのため、tenantスコープの参照系（SELECTのみの
     * 処理）であっても、このトランザクション版`withTransaction(tenantId)`を使うこと。
     *
     * @param tenantId RLSの対象とするテナントID
     * @param block 実行したい処理（tenantでスコープされたsessionを受け取るラムダ）
     * @return blockの実行結果
     */
    fun <T> withTransaction(tenantId: TenantId, block: (session: DSLContext) -> T): T {
        // ① housework_appプール（RLS適用）から接続を借りる（use = 終わったら自動で返す）
        return appDataSource.connection.use { connection ->
            // ② 接続からJOOQのDSLContextを作成
            val context = DSL.using(defaultConfig.derive(connection))

            // ③ トランザクション内で処理を実行
            context.transactionResult { txConfig ->
                // ④ トランザクション専用のDSLContextを取得
                val txContext = txConfig.dsl()

                // ⑤ トランザクションの最初にテナントIDをセットする
                // 第3引数true = トランザクションローカル（SET LOCAL相当）
                txContext.fetch(
                    "select set_config('app.current_tenant_id', ?, true)",
                    tenantId.value.toString()
                )

                // ⑥ あなたの処理を実行
                block(txContext)
            }
        }
    }

    /**
     * トランザクション付きでDBセッションを開く（更新系処理用・オーナー接続）
     *
     * 【動作】
     * 1. オーナー接続プールから接続を借りる
     * 2. トランザクション開始
     * 3. block（あなたの処理）を実行
     * 4. 成功 → コミット、失敗 → ロールバック
     * 5. 接続をプールに返却
     *
     * 【型パラメータ T】
     * blockの戻り値の型。どんな型でも返せる。
     * 例: Member, List<Member>, Unit（何も返さない）など
     *
     * @param block 実行したい処理（sessionを受け取るラムダ）
     * @return blockの実行結果
     */
    @Deprecated("tenant スコープの withTransaction(tenantId) か DatabaseWithoutRLS を使う。#65 で削除する")
    fun <T> withTransaction(block: (session: DSLContext) -> T): T {
        // ① HikariCPから接続を借りる（use = 終わったら自動で返す）
        return ownerDataSource.connection.use { connection ->
            // ② 接続からJOOQのDSLContextを作成
            val context = DSL.using(defaultConfig.derive(connection))

            // ③ トランザクション内で処理を実行
            // transactionResult = 戻り値あり版のトランザクション
            // 成功→コミット、例外→ロールバック を自動で行う
            context.transactionResult { txConfig ->
                // ④ トランザクション専用のDSLContextを取得
                val txContext = txConfig.dsl()

                // ⑤ あなたの処理を実行
                block(txContext)
            }
        }
    }

    /**
     * トランザクションなしでDBセッションを開く（参照系処理用・オーナー接続）
     *
     * 【いつ使う？】
     * - SELECTのみの処理
     * - トランザクションが不要な場合
     *
     * 【withTransactionとの違い】
     * - トランザクションを開始しない → オーバーヘッドが少ない
     * - コミット/ロールバックがない → 参照専用
     *
     * @param block 実行したい処理（sessionを受け取るラムダ）
     * @return blockの実行結果
     */
    @Deprecated("tenant スコープの withTransaction(tenantId) か DatabaseWithoutRLS を使う。#65 で削除する")
    fun <T> withSession(block: (session: DSLContext) -> T): T {
        // HikariCPから接続を借りる（use = 終わったら自動で返す）
        return ownerDataSource.connection.use { connection ->
            // 接続からJOOQのDSLContextを作成
            val context = DSL.using(defaultConfig.derive(connection))

            // そのまま処理を実行（トランザクションなし）
            block(context)
        }
    }
}

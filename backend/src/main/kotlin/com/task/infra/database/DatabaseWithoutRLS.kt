package com.task.infra.database

import com.google.inject.Inject
import com.google.inject.Singleton
import org.jooq.DSLContext
import org.jooq.SQLDialect
import org.jooq.impl.DSL
import org.jooq.impl.DefaultConfiguration
import javax.sql.DataSource

/**
 * RLS（Row Level Security）をバイパスするオーナー接続（housework_appではなくhouseworkロール）
 * を使ってDB操作を行うファサードクラス。
 *
 * 【なぜRLSをバイパスする接続点が必要なのか】
 * `Database`のtenantスコープAPI（`withTransaction(tenantId, block)`）は特定の1テナントの
 * 行しか見えない・書けないことを前提にしている。しかしログイン・サインアップのように
 * 「まだどのテナントに属するか分からない/複数テナントを横断する」処理は、そもそも
 * tenantでスコープできないため、RLSをバイパスするオーナー接続が必要になる。
 *
 * 【使ってよい箇所（許可リスト）】
 * 以下に挙げるユースケース以外でこのクラスを使いたくなったら、実装を進める前に
 * 人間に確認すること。許可された箇所であっても、なぜ`DatabaseWithoutRLS`が必要かを
 * 呼び出し側のコードにコメントで残すこと。
 * - ログイン（#43）
 * - サインアップ（#44）
 * - テナント横断バッチの「取得」処理（#56）
 * - outboxリレー（#72）
 *
 * 【Databaseとの違い】
 * - `Database`: tenantスコープAPIはhousework_appプール接続でRLSが自動適用される。
 * - `DatabaseWithoutRLS`: 常にオーナー（housework）プール接続でRLSをバイパスする。
 *
 * 【コンストラクタでデータソースを受け取る理由】
 * テストでTestcontainers等のデータソースを差し込めるようにするため。
 * 本番実行時は`@Inject`のセカンダリコンストラクタ経由で[DatabaseConfig]のデータソースが使われる。
 *
 * @param ownerDataSource オーナー（housework）接続プール。RLSをバイパスする。
 */
@Singleton
class DatabaseWithoutRLS(
    private val ownerDataSource: DataSource,
) {

    @Inject constructor() : this(DatabaseConfig.dataSource)

    /**
     * JOOQの基本設定
     * PostgreSQLの方言（SQL構文）を使用
     */
    private val defaultConfig = DefaultConfiguration().set(SQLDialect.POSTGRES)

    /**
     * トランザクション付きでDBセッションを開く（更新系処理用・オーナー接続・RLSバイパス）
     *
     * 【動作】
     * 1. オーナー接続プールから接続を借りる
     * 2. トランザクション開始
     * 3. block（あなたの処理）を実行
     * 4. 成功 → コミット、失敗 → ロールバック
     * 5. 接続をプールに返却
     *
     * @param block 実行したい処理（sessionを受け取るラムダ）
     * @return blockの実行結果
     */
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
     * トランザクションなしでDBセッションを開く（参照系処理用・オーナー接続・RLSバイパス）
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

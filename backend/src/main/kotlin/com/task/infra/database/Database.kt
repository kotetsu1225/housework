package com.task.infra.database

import com.google.inject.Singleton
import org.jooq.DSLContext
import org.jooq.SQLDialect
import org.jooq.impl.DSL
import org.jooq.impl.DefaultConfiguration

/**
 * データベース操作のファサードクラス
 *
 * 【このクラスの役割】
 * 1. DBコネクションの取得と解放を自動化
 * 2. トランザクション管理（成功→コミット、失敗→ロールバック）
 * 3. DSLContext（JOOQの操作オブジェクト）を提供
 *
 * 【使い方の例】
 * ```
 * // トランザクション付き（更新系）
 * database.withTransaction { session ->
 *     memberRepository.create(member, session)
 * }
 *
 * // トランザクションなし（参照系）
 * database.withSession { session ->
 *     memberRepository.findById(id, session)
 * }
 * ```
 */
@Singleton
class Database {

    /**
     * JOOQの基本設定
     * PostgreSQLの方言（SQL構文）を使用
     */
    private val defaultConfig = DefaultConfiguration().set(SQLDialect.POSTGRES)

    /**
     * トランザクション付きでDBセッションを開く（更新系処理用）
     *
     * 【動作】
     * 1. 接続プールから接続を借りる
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
    fun <T> withTransaction(block: (session: DSLContext) -> T): T {
        // ① HikariCPから接続を借りる（use = 終わったら自動で返す）
        return DatabaseConfig.dataSource.connection.use { connection ->
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
     * トランザクションなしでDBセッションを開く（参照系処理用）
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
        return DatabaseConfig.dataSource.connection.use { connection ->
            // 接続からJOOQのDSLContextを作成
            val context = DSL.using(defaultConfig.derive(connection))

            // そのまま処理を実行（トランザクションなし）
            block(context)
        }
    }
}

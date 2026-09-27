package com.task.usecase.batch

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.tenant.TenantId
import com.task.domain.tenant.TenantRepository
import com.task.infra.database.DatabaseWithoutRLS
import org.slf4j.LoggerFactory

/**
 * テナント横断バッチの共通実行ヘルパー(issue #56)。
 *
 * 【背景(ADR #19 決定 2)】
 * テナント横断バッチは「横断取得(RLS バイパス)」と「テナントごとの処理(tenant スコープ)」を
 * 分離し、あるテナントの失敗を他テナントに波及させないようにする。このクラスが担うのは
 * 前者(ACTIVE な全テナントの列挙と、テナントごとに失敗を隔離した反復実行)だけ。
 * [forEachActiveTenant] の [block] の中で何をするか——tenant スコープの transaction
 * (`Database.withTransaction(tenantId)`)を開くこと、外部通信をその transaction の外に
 * 出すこと——は呼び出し側(各 B issue #57〜#60)の責務。
 *
 * 【使い方の例(スケジューラの executeTask から呼ぶ)】
 * ```kotlin
 * class GenerateDailyExecutionsScheduler @Inject constructor(
 *     private val tenantBatchRunner: TenantBatchRunner,
 *     private val database: Database,
 *     private val generateDailyExecutionsUseCase: GenerateDailyExecutionsUseCase,
 * ) : BaseScheduler() {
 *     override val taskName = "日次タスク生成"
 *
 *     override fun executeTask(): String {
 *         val summary = tenantBatchRunner.forEachActiveTenant(taskName) { tenantId ->
 *             // tenant スコープの transaction を開くのは呼び出し側(ここ)の責務
 *             database.withTransaction(tenantId) { session ->
 *                 generateDailyExecutionsUseCase.execute(tenantId, session)
 *             }
 *             // メール送信などの外部通信を行う場合は、上の transaction の外(ここ)で行う
 *         }
 *         return summary.toLogMessage()
 *     }
 * }
 * ```
 */
@Singleton
class TenantBatchRunner @Inject constructor(
    private val databaseWithoutRLS: DatabaseWithoutRLS,
    private val tenantRepository: TenantRepository,
) {
    private val logger = LoggerFactory.getLogger(this::class.java)

    /**
     * [taskName] をテナントごとに実行した結果の集計。
     *
     * @param taskName 実行したタスク名(ログ・[toLogMessage]に使う)
     * @param results テナントごとの実行結果。列挙順(created_at 昇順)を保持する
     */
    data class Summary<R>(val taskName: String, val results: Map<TenantId, Result<R>>) {
        val successCount: Int get() = results.values.count { it.isSuccess }
        val failureCount: Int get() = results.values.count { it.isFailure }

        /**
         * スケジューラの `executeTask(): String` の戻り値にそのまま使えるログメッセージ。
         * 例: "日次タスク生成: 成功 3 / 失敗 1(失敗: 11111111-1111-1111-1111-111111111111)"
         */
        fun toLogMessage(): String {
            val failedTenantIds = results.filterValues { it.isFailure }.keys
            val base = "$taskName: 成功 $successCount / 失敗 $failureCount"
            if (failedTenantIds.isEmpty()) {
                return base
            }
            return "$base(失敗: ${failedTenantIds.joinToString(", ") { it.value.toString() }})"
        }
    }

    /**
     * status = ACTIVE な全テナントに対して [block] を実行する。
     *
     * 【テナントの列挙】
     * テナント横断バッチの「取得」なので RLS をバイパスする(ADR #19 決定 2、handoff §4 の
     * 許可リスト)。ここで列挙するのは TenantId のみであり、テナントのデータそのものは読まない。
     *
     * 【失敗の隔離】
     * [block] があるテナントで例外(`Exception`)を投げても、そのテナントの結果を失敗として
     * 記録したうえで次のテナントの処理を続ける。`OutOfMemoryError` 等の `Error` はプロセス全体の
     * 異常を示すため捕まえず、そのまま伝播させる。
     *
     * 【block の責務】
     * tenant スコープの transaction(`Database.withTransaction(tenantId)`)を開くこと、
     * メール送信などの外部通信をその transaction の外に出すことは、[block] を渡す呼び出し側の
     * 責務(ADR #19 決定 2)。このクラスはトランザクション境界を意識しない。
     *
     * @param taskName ログ・[Summary.toLogMessage]に使うタスク名
     * @param block テナントごとに実行する処理
     * @return テナントごとの実行結果を集計した [Summary]
     */
    fun <R> forEachActiveTenant(taskName: String, block: (TenantId) -> R): Summary<R> {
        // DatabaseWithoutRLS の理由: テナント横断バッチの「取得」(許可リスト #56)。列挙するのはテナントの ID だけ。
        val tenantIds = databaseWithoutRLS.withSession { session ->
            tenantRepository.findAllActiveIds(session)
        }

        logger.info("$taskName を開始します(対象テナント数: ${tenantIds.size})")

        val results = LinkedHashMap<TenantId, Result<R>>()
        for (tenantId in tenantIds) {
            try {
                results[tenantId] = Result.success(block(tenantId))
            } catch (e: Exception) {
                logger.error("$taskName の実行に失敗しました(taskName=$taskName, tenantId=${tenantId.value})", e)
                results[tenantId] = Result.failure(e)
            }
        }

        val summary = Summary(taskName, results)
        logger.info(
            "$taskName を終了します" +
                "(対象テナント数: ${tenantIds.size}, 成功: ${summary.successCount}, 失敗: ${summary.failureCount})"
        )
        return summary
    }
}

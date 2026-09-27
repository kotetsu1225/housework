package com.task.scheduler

import com.task.usecase.batch.TenantBatchRunner
import com.task.usecase.task.GenerateDailyExecutionsUseCase
import java.time.LocalDate
import java.time.LocalTime

/**
 * 日次タスク生成をテナントごとに実行するスケジューラー(issue #57)。
 *
 * [TenantBatchRunner.forEachActiveTenant] で ACTIVE な全テナントを列挙し、
 * [generateDailyExecutionsUseCase] を 1 テナントずつ呼ぶ。あるテナントの生成が失敗しても、
 * 他のテナントの生成はそれぞれのトランザクションでコミットされる(ADR #19 決定 2)。
 * tenant スコープのトランザクションを開くのは UseCase 自身の責務。
 */
class DailyTaskGenerationScheduler(
    private val generateDailyExecutionsUseCase: GenerateDailyExecutionsUseCase,
    private val tenantBatchRunner: TenantBatchRunner,
    executionTime: LocalTime = LocalTime.of(6, 0)
) : DailyScheduler(executionTime) {

    override val taskName: String = "daily task generation"

    override fun doExecute(today: LocalDate): String {
        val summary = tenantBatchRunner.forEachActiveTenant(taskName) { tenantId ->
            generateDailyExecutionsUseCase.execute(
                GenerateDailyExecutionsUseCase.Input(tenantId = tenantId, targetDate = today)
            )
        }
        return summary.toLogMessage()
    }
}

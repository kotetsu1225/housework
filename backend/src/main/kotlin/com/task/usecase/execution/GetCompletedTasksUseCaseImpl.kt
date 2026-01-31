package com.task.usecase.execution

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.infra.database.Database
import com.task.usecase.query.execution.CompletedTaskQueryService
import java.util.UUID

/**
 * GetCompletedTasksUseCaseの実装
 *
 * トランザクション管理を行い、QueryServiceを呼び出す
 */
@Singleton
class GetCompletedTasksUseCaseImpl @Inject constructor(
    private val database: Database,
    private val completedTaskQueryService: CompletedTaskQueryService
) : GetCompletedTasksUseCase {

    override fun execute(input: GetCompletedTasksUseCase.Input): GetCompletedTasksUseCase.Output {
        return database.withTransaction { session ->
            // memberIds を UUID に変換
            val memberUuids = input.memberIds?.map { UUID.fromString(it) }

            // limit + 1 で取得して hasMore 判定
            val tasks = completedTaskQueryService.fetch(
                session = session,
                memberIds = memberUuids,
                date = input.date,
                limit = input.limit + 1,
                offset = input.offset
            )

            val hasMore = tasks.size > input.limit
            val resultTasks = if (hasMore) tasks.dropLast(1) else tasks

            GetCompletedTasksUseCase.Output(
                completedTasks = resultTasks,
                hasMore = hasMore
            )
        }
    }
}

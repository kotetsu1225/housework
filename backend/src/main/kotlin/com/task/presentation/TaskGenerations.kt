package com.task.presentation

import com.task.domain.AppTimeZone
import com.task.usecase.task.GenerateDailyExecutionsUseCase
import io.ktor.http.HttpStatusCode
import io.ktor.resources.Resource
import io.ktor.server.application.call
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.resources.post
import kotlinx.serialization.Serializable
import java.time.LocalDate

@Resource("api/task-generations")
class TaskGenerations {

    /**
     * POST /api/task-generations/daily
     *
     * 当日の定期タスクからTaskExecutionを生成する。
     * 毎朝のバッチ処理または手動テスト用。
     * 冪等性あり（同日に複数回呼んでも重複生成されない）。
     */
    @Resource("/daily")
    class GenerateDaily(
        val parent: TaskGenerations = TaskGenerations(),
    ) {
        @Serializable
        data class Response(
            val generatedCount: Int,
            val taskExecutionIds: List<String>,
            val targetDate: String
        )
    }

    /**
     * POST /api/task-generations/daily/{date}
     *
     * 指定日の定期タスクからTaskExecutionを生成する。
     * テスト用（過去日や未来日を指定可能）。
     */
    @Resource("/daily/{date}")
    class GenerateDailyForDate(
        val parent: TaskGenerations = TaskGenerations(),
        val date: String
    ) {
        @Serializable
        data class Response(
            val generatedCount: Int,
            val taskExecutionIds: List<String>,
            val targetDate: String
        )
    }
}

fun Route.taskGenerations() {
    // POST /api/task-generations/daily - 当日分を生成
    post<TaskGenerations.GenerateDaily> {
        val today = LocalDate.now(AppTimeZone.ZONE)

        val output = instance<GenerateDailyExecutionsUseCase>().execute(
            GenerateDailyExecutionsUseCase.Input(targetDate = today)
        )

        call.respond(
            HttpStatusCode.OK,
            TaskGenerations.GenerateDaily.Response(
                generatedCount = output.generatedCount,
                taskExecutionIds = output.taskExecutionIds.map { it.value.toString() },
                targetDate = today.toString()
            )
        )
    }

    // POST /api/task-generations/daily/{date} - 指定日分を生成（テスト用）
    post<TaskGenerations.GenerateDailyForDate> { resource ->
        val targetDate = LocalDate.parse(resource.date)

        val output = instance<GenerateDailyExecutionsUseCase>().execute(
            GenerateDailyExecutionsUseCase.Input(targetDate = targetDate)
        )

        call.respond(
            HttpStatusCode.OK,
            TaskGenerations.GenerateDailyForDate.Response(
                generatedCount = output.generatedCount,
                taskExecutionIds = output.taskExecutionIds.map { it.value.toString() },
                targetDate = targetDate.toString()
            )
        )
    }
}

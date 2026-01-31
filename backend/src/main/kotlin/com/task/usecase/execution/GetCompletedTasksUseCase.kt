package com.task.usecase.execution

import com.task.usecase.query.execution.CompletedTaskDto
import java.time.LocalDate

/**
 * 完了済みタスク一覧取得UseCase
 *
 * MemberDetailページ・CompletedExecutionsページで共通利用
 */
interface GetCompletedTasksUseCase {

    data class Input(
        /** 担当者IDでフィルタ（nullの場合は全員） */
        val memberIds: List<String>? = null,
        /** 日付でフィルタ（nullの場合は全期間） */
        val date: LocalDate? = null,
        /** 取得件数（デフォルト: 50） */
        val limit: Int = 50,
        /** オフセット（デフォルト: 0） */
        val offset: Int = 0
    )

    data class Output(
        /** 完了タスク一覧 */
        val completedTasks: List<CompletedTaskDto>,
        /** 次のページがあるか */
        val hasMore: Boolean
    )

    fun execute(input: Input): Output
}

package com.task.domain.taskDefinition

import com.google.inject.ImplementedBy
import com.task.infra.taskDefinition.TaskDefinitionRepositoryImpl
import org.jooq.DSLContext
import java.time.LocalDate

@ImplementedBy(TaskDefinitionRepositoryImpl::class)
interface TaskDefinitionRepository {
    fun create(taskDefinition: TaskDefinition, session: DSLContext): TaskDefinition
    fun update(taskDefinition: TaskDefinition, session: DSLContext): TaskDefinition
    fun delete(id: TaskDefinitionId, session: DSLContext)
    fun findById(id: TaskDefinitionId, session: DSLContext): TaskDefinition?
    fun findAll(session: DSLContext, limit: Int = 100, offset: Int = 0): List<TaskDefinition>
    fun count(session: DSLContext): Int
    fun findAllRecurringActive(session: DSLContext): List<TaskDefinition>

    /**
     * タスク設定画面向けの一覧取得。
     *
     * - 定期タスク: 常に対象（論理削除を除く）
     * - 単発タスク: 期限(today)未満、または実行がCOMPLETED/CANCELLEDのものは除外
     */
    fun findAllForTaskSettings(session: DSLContext, today: LocalDate, limit: Int = 100, offset: Int = 0): List<TaskDefinition>

    /**
     * タスク設定画面向けの件数取得（findAllForTaskSettingsと同一条件）。
     */
    fun countForTaskSettings(session: DSLContext, today: LocalDate): Int
}

package com.task.domain.taskExecution

import com.google.inject.ImplementedBy
import com.task.domain.member.MemberId
import com.task.domain.taskDefinition.TaskDefinitionId
import com.task.infra.taskExecution.TaskExecutionRepositoryImpl
import com.task.usecase.taskExecution.get.GetTaskExecutionsUseCase
import org.jooq.DSLContext
import java.time.LocalDate

/**
 * TaskExecution リポジトリインターフェース
 *
 * TaskExecutionはSealed Classなので、保存・取得時に
 * 実際の状態（NotStarted, InProgress, Completed, Cancelled）を
 * 適切に判定して処理する必要がある。
 */
@ImplementedBy(TaskExecutionRepositoryImpl::class)
interface TaskExecutionRepository {

    /**
     * TaskExecutionを新規作成する
     * 通常はNotStarted状態で作成される
     */
    fun create(taskExecution: TaskExecution.NotStarted, session: DSLContext): TaskExecution.NotStarted

    /**
     * TaskExecutionを更新する
     * 状態遷移後の保存に使用（InProgress, Completed, Cancelled等）
     */
    fun update(taskExecution: TaskExecution, session: DSLContext): TaskExecution

    /**
     * IDでTaskExecutionを取得する
     * 戻り値は実際の状態に応じたSealed Classのサブタイプ
     */
    fun findById(id: TaskExecutionId, session: DSLContext): TaskExecution?

    /**
     * 全件取得（ページネーション対応）
     */
    fun findAll(session: DSLContext, limit: Int, offset: Int): List<TaskExecution>

    /**
     * 総件数を取得
     */
    fun count(session: DSLContext): Int

    /**
     * フィルタ条件付きで全件取得（ページネーション対応）
     * Specification Patternを使用して動的にWHERE句を構築
     */
    fun findAllWithFilter(
        session: DSLContext,
        limit: Int,
        offset: Int,
        filter: GetTaskExecutionsUseCase.FilterSpec
    ): List<TaskExecution>

    /**
     * フィルタ条件付きで総件数を取得
     */
    fun countWithFilter(session: DSLContext, filter: GetTaskExecutionsUseCase.FilterSpec): Int

    /**
     * 特定の日付のTaskExecutionを取得
     */
    fun findByScheduledDate(scheduledDate: LocalDate, session: DSLContext): List<TaskExecution>

    /**
     * 特定メンバーに割り当てられたTaskExecutionを取得
     */
    fun findByAssigneeMemberId(memberId: MemberId, session: DSLContext): List<TaskExecution>

    fun findByDefinitionAndDate(
        taskDefinitionId: TaskDefinitionId,
        scheduledDate: LocalDate,
        session: DSLContext
    ): TaskExecution?

    fun findByDefinitionId(definitionId: TaskDefinitionId, session: DSLContext): List<TaskExecution>?
}

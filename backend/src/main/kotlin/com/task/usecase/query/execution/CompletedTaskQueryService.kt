package com.task.usecase.query.execution

import org.jooq.DSLContext
import java.time.LocalDate
import java.util.UUID

/**
 * 完了済みタスク取得用QueryService
 *
 * CQRSパターン: TaskExecution + TaskSnapshot + TaskDefinition + Member を
 * JOINして取得する参照専用サービス
 *
 * MemberDetailページ・CompletedExecutionsページで共通利用
 */
interface CompletedTaskQueryService {

    /**
     * 完了タスク一覧を取得
     *
     * @param session DSLContext（UseCaseからトランザクション内で渡される）
     * @param memberIds 担当者IDでフィルタ（nullの場合は全員）
     * @param date 日付でフィルタ（nullの場合は全期間）
     * @param limit 取得件数
     * @param offset オフセット
     * @return 完了タスク一覧
     */
    fun fetch(
        session: DSLContext,
        memberIds: List<UUID>?,
        date: LocalDate?,
        limit: Int,
        offset: Int
    ): List<CompletedTaskDto>
}

/**
 * 担当者DTO
 */
data class AssigneeMemberDto(
    val id: String,
    val name: String
)

/**
 * 完了タスクDTO
 *
 * TaskExecution + TaskSnapshot + TaskDefinition の情報を含む
 */
data class CompletedTaskDto(
    val taskExecutionId: String,
    val taskDefinitionId: String,
    // Snapshot情報（実行開始時に凍結された値）
    val name: String,
    val description: String?,
    val scheduledStartTime: String,
    val scheduledEndTime: String,
    val frozenPoint: Int,
    val definitionVersion: Int,
    // TaskDefinition情報
    val scope: String,
    val scheduleType: String,
    val ownerMemberId: String?,
    // 担当者一覧
    val assigneeMembers: List<AssigneeMemberDto>,
    // 完了情報
    val scheduledDate: String,
    val completedAt: String
)

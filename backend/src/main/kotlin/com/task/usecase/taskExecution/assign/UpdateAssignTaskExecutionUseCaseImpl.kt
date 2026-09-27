package com.task.usecase.taskExecution.assign

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.member.MemberRepository
import com.task.domain.taskExecution.TaskExecution
import com.task.domain.taskExecution.TaskExecutionRepository
import com.task.infra.database.Database

@Singleton
class UpdateAssignTaskExecutionUseCaseImpl @Inject constructor(
    private val database: Database,
    private val taskExecutionRepository: TaskExecutionRepository,
    private val memberRepository: MemberRepository
) : UpdateAssignTaskExecutionUseCase {
    override fun execute(input: UpdateAssignTaskExecutionUseCase.Input): UpdateAssignTaskExecutionUseCase.Output {
        return database.withTransaction(input.tenantId) { session ->
            val existingExecution = taskExecutionRepository.findById(input.id, session)
                ?: throw IllegalArgumentException("TaskExecution with id ${input.id} does not exist")

            // ID ではなく集約(Member)を取得し、ドメイン側の検証関数で same-tenant を確認する(#50)。
            // 見つからない場合(RLSで他テナントのメンバーが見えない場合を含む)は既存の「見つかりません」の扱いに合わせる。
            // findByIds は重複を 1 件にまとめて返すので、重複を除いた件数で比べる。
            val newAssignees = memberRepository.findByIds(input.newAssigneeMemberIds, session) ?: emptyList()
            if (newAssignees.size != input.newAssigneeMemberIds.distinct().size) {
                throw IllegalArgumentException("メンバーが見つかりません: ${input.newAssigneeMemberIds}")
            }
            existingExecution.requireSameTenant(newAssignees)

            val taskExecution = taskExecutionRepository.updateAssigneeMember(existingExecution, input.newAssigneeMemberIds ,session)

            toOutput(taskExecution)
        }
    }

    private fun toOutput(taskExecution: TaskExecution): UpdateAssignTaskExecutionUseCase.Output {
        return when (taskExecution) {
            is TaskExecution.NotStarted -> UpdateAssignTaskExecutionUseCase.Output(
                id = taskExecution.id,
                taskDefinitionId = taskExecution.taskDefinitionId,
                scheduledDate = taskExecution.scheduledDate,
                status = "NOT_STARTED",
                assigneeMemberIds = taskExecution.assigneeMemberIds,
                startedAt = null,
                completedAt = null,
                completedByMemberId = null,
                snapshot = null
            )
            is TaskExecution.InProgress -> UpdateAssignTaskExecutionUseCase.Output(
                id = taskExecution.id,
                taskDefinitionId = taskExecution.taskDefinitionId,
                scheduledDate = taskExecution.scheduledDate,
                status = "IN_PROGRESS",
                assigneeMemberIds = taskExecution.assigneeMemberIds,
                startedAt = taskExecution.startedAt,
                completedAt = null,
                completedByMemberId = null,
                snapshot = UpdateAssignTaskExecutionUseCase.SnapshotOutput(
                    name = taskExecution.taskSnapshot.frozenName.value,
                    description = taskExecution.taskSnapshot.frozenDescription.value,
                    scheduledStartTime = taskExecution.taskSnapshot.frozenScheduledTimeRange.startTime,
                    scheduledEndTime = taskExecution.taskSnapshot.frozenScheduledTimeRange.endTime,
                    definitionVersion = taskExecution.taskSnapshot.definitionVersion,
                    capturedAt = taskExecution.taskSnapshot.capturedAt,
                    point = taskExecution.taskSnapshot.frozenPoint
                )
            )
            is TaskExecution.Completed,
            is TaskExecution.Cancelled -> {
                throw IllegalStateException("この状態のTaskExecutionはassign操作の結果として返されません")
            }
        }
    }
}
package com.task.usecase.taskDefinition.update

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.member.MemberRepository
import com.task.domain.task.service.TaskDefinitionAuthService
import com.task.domain.taskDefinition.TaskDefinitionRepository
import com.task.infra.database.Database

@Singleton
class UpdateTaskDefinitionUseCaseImpl @Inject constructor(
    private val database: Database,
    private val taskDefinitionRepository: TaskDefinitionRepository,
    private val memberRepository: MemberRepository,
    private val authorizationService: TaskDefinitionAuthService,
) : UpdateTaskDefinitionUseCase {
    override fun execute(input: UpdateTaskDefinitionUseCase.Input): UpdateTaskDefinitionUseCase.Output {
        return database.withTransaction(input.tenantId) { session ->
            val targetTaskDefinition = taskDefinitionRepository.findById(input.id, session)
                ?: throw IllegalArgumentException("TaskDefinition with id ${input.id.value} が見つかりませんでした。")

            authorizationService.requireEditPermission(targetTaskDefinition, input.requesterId)

            // ID ではなく集約(Member)を渡すことで、TaskDefinition.update 側で same-tenant を検証できるようにする(#50)。
            // 見つからない場合(RLSで他テナントのメンバーが見えない場合を含む)は既存の「見つかりません」の扱いに合わせる。
            val owner = input.ownerMemberId?.let { ownerMemberId ->
                memberRepository.findById(ownerMemberId, session)
                    ?: throw IllegalArgumentException("Member with id ${ownerMemberId.value} が見つかりませんでした。")
            }

            val updatedTaskDefinition = targetTaskDefinition.update(
                id = input.id,
                name = input.name,
                description = input.description,
                scheduledTimeRange = input.scheduledTimeRange,
                scope = input.scope,
                owner = owner,
                schedule = input.schedule,
                point = input.point,
            )

            taskDefinitionRepository.update(updatedTaskDefinition, session)

            UpdateTaskDefinitionUseCase.Output(
                id = updatedTaskDefinition.id,
                name = updatedTaskDefinition.name,
                description = updatedTaskDefinition.description,
                scheduledTimeRange = updatedTaskDefinition.scheduledTimeRange,
                scope = updatedTaskDefinition.scope,
                ownerMemberId = updatedTaskDefinition.ownerMemberId,
                schedule = updatedTaskDefinition.schedule,
                version = updatedTaskDefinition.version,
                point = updatedTaskDefinition.point,
            )
        }
    }
}

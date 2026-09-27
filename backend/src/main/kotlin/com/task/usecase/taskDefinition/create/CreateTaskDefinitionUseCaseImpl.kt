package com.task.usecase.taskDefinition.create

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.event.DomainEventDispatcher
import com.task.domain.member.MemberRepository
import com.task.domain.taskDefinition.TaskDefinition
import com.task.domain.taskDefinition.TaskDefinitionRepository
import com.task.infra.database.Database

@Singleton
class CreateTaskDefinitionUseCaseImpl @Inject constructor(
    private val database: Database,
    private val taskDefinitionRepository: TaskDefinitionRepository,
    private val memberRepository: MemberRepository,
    private val domainEventDispatcher: DomainEventDispatcher
) : CreateTaskDefinitionUseCase {

    override fun execute(input: CreateTaskDefinitionUseCase.Input): CreateTaskDefinitionUseCase.Output {
        return database.withTransaction(input.tenantId) { session ->
            // ID ではなく集約(Member)を渡すことで、TaskDefinition.create 側で same-tenant を検証できるようにする(#50)。
            // 見つからない場合(RLSで他テナントのメンバーが見えない場合を含む)は既存の「見つかりません」の扱いに合わせる。
            val owner = input.ownerMemberId?.let { ownerMemberId ->
                memberRepository.findById(ownerMemberId, session)
                    ?: throw IllegalArgumentException("Member with id ${ownerMemberId.value} が見つかりませんでした。")
            }

            val newTaskDefinition = TaskDefinition.create(
                tenantId = input.tenantId,
                name = input.name,
                description = input.description,
                scheduledTimeRange = input.scheduledTimeRange,
                scope = input.scope,
                owner = owner,
                schedule = input.schedule,
                point = input.point
            )

            val taskDefinition = taskDefinitionRepository.create(newTaskDefinition, session)

            // ドメインイベントの蓄積を呼び出す
            domainEventDispatcher.dispatchAll(taskDefinition.domainEvents, session)
            taskDefinition.clearDomainEvents()

            CreateTaskDefinitionUseCase.Output(
                id = taskDefinition.id,
                name = taskDefinition.name,
                description = taskDefinition.description,
                scheduledTimeRange = taskDefinition.scheduledTimeRange,
                scope = taskDefinition.scope,
                ownerMemberId = taskDefinition.ownerMemberId,
                schedule = taskDefinition.schedule,
                version = taskDefinition.version,
                point = taskDefinition.point
            )
        }
    }
}

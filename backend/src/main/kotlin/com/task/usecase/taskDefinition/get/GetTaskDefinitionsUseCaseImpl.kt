package com.task.usecase.taskDefinition.get

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.AppTimeZone
import com.task.domain.taskDefinition.TaskDefinitionRepository
import com.task.infra.database.Database
import java.time.LocalDate


@Singleton
class GetTaskDefinitionsUseCaseImpl @Inject constructor(
    private val database: Database,
    private val taskDefinitionRepository: TaskDefinitionRepository
) : GetTaskDefinitionsUseCase {

    override fun execute(input: GetTaskDefinitionsUseCase.Input): GetTaskDefinitionsUseCase.Output {
        return database.withTransaction { session ->
            val today = LocalDate.now(AppTimeZone.ZONE)
            val total = taskDefinitionRepository.countForTaskSettings(session, today)

            val taskDefinitions = taskDefinitionRepository.findAllForTaskSettings(
                session = session,
                today = today,
                limit = input.limit,
                offset = input.offset
            )

            val hasMore = (input.offset + taskDefinitions.size) < total

            GetTaskDefinitionsUseCase.Output(
                taskDefinitions = taskDefinitions.map { taskDefinition ->
                    GetTaskDefinitionsUseCase.TaskDefinitionOutput(
                        id = taskDefinition.id,
                        name = taskDefinition.name,
                        description = taskDefinition.description,
                        scheduledTimeRange = taskDefinition.scheduledTimeRange,
                        scope = taskDefinition.scope,
                        ownerMemberId = taskDefinition.ownerMemberId,
                        schedule = taskDefinition.schedule,
                        version = taskDefinition.version
                    )
                },
                total = total,
                hasMore = hasMore
            )
        }
    }
}

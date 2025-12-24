package com.task.infra.taskDefinition

import com.google.inject.Singleton
import com.task.domain.taskDefinition.TaskDefinition
import com.task.domain.taskDefinition.TaskDefinitionRepository
import com.task.domain.taskDefinition.TaskDefinitionId
import org.jooq.DSLContext

@Singleton
class TaskDefinitionRepositoryImpl : TaskDefinitionRepository {

    override fun create(taskDefinition: TaskDefinition, session: DSLContext): TaskDefinition {
        TODO("Not yet implemented")
    }

    override fun update(taskDefinition: TaskDefinition, session: DSLContext): TaskDefinition {
        TODO("Not yet implemented")
    }

    override fun delete(id: TaskDefinitionId, session: DSLContext) {
        TODO("Not yet implemented")
    }

    override fun findById(id: TaskDefinitionId, session: DSLContext): TaskDefinition? {
        TODO("Not yet implemented")
    }
}

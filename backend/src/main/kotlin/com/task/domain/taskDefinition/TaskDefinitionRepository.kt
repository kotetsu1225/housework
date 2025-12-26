package com.task.domain.taskDefinition

import com.google.inject.ImplementedBy
import com.task.infra.taskDefinition.TaskDefinitionRepositoryImpl
import org.jooq.DSLContext

@ImplementedBy(TaskDefinitionRepositoryImpl::class)
interface TaskDefinitionRepository {
    fun create(taskDefinition: TaskDefinition, session: DSLContext): TaskDefinition
    fun update(taskDefinition: TaskDefinition, session: DSLContext): TaskDefinition
    fun delete(id: TaskDefinitionId, session: DSLContext)
    fun findById(id: TaskDefinitionId, session: DSLContext): TaskDefinition?
    fun findAll(session: DSLContext, limit: Int = 100, offset: Int = 0): List<TaskDefinition>
    fun count(session: DSLContext): Int
}

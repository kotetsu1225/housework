package com.task.domain.task.service

import com.google.inject.ImplementedBy
import com.task.domain.member.MemberId
import com.task.domain.taskDefinition.TaskDefinition
import com.task.usecase.task.service.TaskDefinitionAuthServiceImpl

@ImplementedBy(TaskDefinitionAuthServiceImpl::class)
interface TaskDefinitionAuthService {
    fun canEdit(taskDefinition: TaskDefinition, memberId: MemberId): Boolean
    fun canDelete(taskDefinition: TaskDefinition, memberId: MemberId): Boolean

    fun requireEditPermission(taskDefinition: TaskDefinition, memberId: MemberId)
    fun requireDeletePermission(taskDefinition: TaskDefinition, memberId: MemberId)
}
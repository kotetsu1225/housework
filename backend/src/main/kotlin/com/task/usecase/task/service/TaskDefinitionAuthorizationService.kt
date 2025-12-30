package com.task.usecase.task.service

import com.google.inject.Singleton
import com.task.domain.member.MemberId
import com.task.domain.task.service.TaskDefinitionAuthService
import com.task.domain.taskDefinition.TaskDefinition
import com.task.domain.taskDefinition.TaskScope

@Singleton
class TaskDefinitionAuthServiceImpl : TaskDefinitionAuthService {

    override fun canEdit(taskDefinition: TaskDefinition, memberId: MemberId): Boolean {
        return when (taskDefinition.scope) {
            TaskScope.FAMILY -> true
            TaskScope.PERSONAL -> taskDefinition.ownerMemberId == memberId
        }
    }

    override fun canDelete(taskDefinition: TaskDefinition, memberId: MemberId): Boolean {
        return canEdit(taskDefinition, memberId)
    }

    override fun requireEditPermission(taskDefinition: TaskDefinition, memberId: MemberId) {
        require(canEdit(taskDefinition, memberId)) {
            "このタスクを編集する権限がありません"
        }
    }

    override fun requireDeletePermission(taskDefinition: TaskDefinition, memberId: MemberId) {
        require(canDelete(taskDefinition, memberId)) {
            "このタスクを削除する権限がありません"
        }
    }
}

package com.task.domain.taskDefinition

import com.task.domain.AggregateRoot
import com.task.domain.member.MemberId
import com.task.domain.taskDefinition.event.TaskDefinitionCreated
import java.util.UUID

class TaskDefinition private constructor(
    val id: TaskDefinitionId,
    val name: TaskDefinitionName,
    val description: TaskDefinitionDescription,
    val estimatedMinutes: Int,
    val scope: TaskScope,
    val ownerMemberId: MemberId?,
    val schedule: TaskSchedule,
    val version: Int,
    val isDeleted: Boolean,
) : AggregateRoot() {
    init {
        require(estimatedMinutes in 1..1440) {
            "推定時間は1分以上1440分以下である必要があります: $estimatedMinutes"
        }

        if (scope == TaskScope.PERSONAL) {
            require(ownerMemberId != null) {
                "個人タスクにはオーナーIDが必須です。"
            }
        }
    }

    fun update(
        id: TaskDefinitionId,
        name: TaskDefinitionName?,
        description: TaskDefinitionDescription?,
        estimatedMinutes: Int?,
        scope: TaskScope?,
        ownerMemberId: MemberId?,
        schedule: TaskSchedule?,
    ): TaskDefinition {
        return TaskDefinition(
            id = id,
            name = name ?: this.name,
            description = description ?: this.description,
            estimatedMinutes = estimatedMinutes ?: this.estimatedMinutes,
            scope = scope ?: this.scope,
            ownerMemberId = ownerMemberId ?: this.ownerMemberId,
            schedule = schedule ?: this.schedule,
            version = this.version + 1,
            isDeleted = false
        )
    }

    fun delete(): TaskDefinition {
        return TaskDefinition(
            id = this.id,
            name = this.name,
            description = this.description,
            estimatedMinutes = this.estimatedMinutes,
            scope = this.scope,
            ownerMemberId = this.ownerMemberId,
            schedule = this.schedule,
            version = this.version,
            isDeleted = true
        )
    }


    companion object {
        fun create(
            name: TaskDefinitionName,
            description: TaskDefinitionDescription,
            estimatedMinutes: Int,
            scope: TaskScope,
            ownerMemberId: MemberId?,
            schedule: TaskSchedule,
        ): TaskDefinition {
            val taskDefinition = TaskDefinition(
                id = TaskDefinitionId.generate(),
                name = name,
                description = description,
                estimatedMinutes = estimatedMinutes,
                scope = scope,
                ownerMemberId = ownerMemberId,
                schedule = schedule,
                version = 1,
                isDeleted = false,
            )

            // ここでドメインイベントを蓄積のみ行う
            taskDefinition.addDomainEvent(
                TaskDefinitionCreated(
                    taskDefinitionId = taskDefinition.id,
                    name = taskDefinition.name,
                    description = taskDefinition.description,
                    estimatedMinutes = taskDefinition.estimatedMinutes,
                    scope = taskDefinition.scope,
                    ownerMemberId = taskDefinition.ownerMemberId,
                    schedule = taskDefinition.schedule,
                )
            )

            return taskDefinition
        }

        fun reconstruct(
            id: TaskDefinitionId,
            name: TaskDefinitionName,
            description: TaskDefinitionDescription,
            estimatedMinutes: Int,
            scope: TaskScope,
            ownerMemberId: MemberId?,
            schedule: TaskSchedule,
            version: Int,
            isDeleted: Boolean,
        ): TaskDefinition {
            return TaskDefinition(
                id = id,
                name = name,
                description = description,
                estimatedMinutes = estimatedMinutes,
                scope = scope,
                ownerMemberId = ownerMemberId,
                schedule = schedule,
                version = version,
                isDeleted = isDeleted,
            )
        }
    }
}
data class TaskDefinitionId(val value: UUID) {
    companion object {
        fun generate() = TaskDefinitionId(value = UUID.randomUUID())
        fun from(value: String) = TaskDefinitionId(value = UUID.fromString(value))
    }
}
data class TaskDefinitionName(val value: String) {
    init {
        require(value.isNotBlank()) {
            "名前は必須です。"
        }
    }
}

data class TaskDefinitionDescription(val value: String) {
    init {
        // いい感じの長さを考える
    }
}

enum class TaskScope(val value: String) {
    FAMILY("FAMILY"),
    PERSONAL("PERSONAL")
    ;
    companion object {
        fun get(value: String): TaskScope = entries.find { it.value == value }?:throw IllegalArgumentException("TaskScope not found: $value")
    }

    fun toName(): String = when(this) {
        FAMILY -> "家のタスク"
        PERSONAL -> "個人のタスク"
    }
}
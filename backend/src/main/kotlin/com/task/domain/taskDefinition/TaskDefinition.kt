package com.task.domain.taskDefinition

import com.task.domain.AggregateRoot
import com.task.domain.member.MemberId
import com.task.domain.taskDefinition.event.TaskDefinitionCreated
import com.task.domain.taskDefinition.event.TaskDefinitionDeleted
import java.time.Instant
import java.util.UUID

class TaskDefinition private constructor(
    val id: TaskDefinitionId,
    val name: TaskDefinitionName,
    val description: TaskDefinitionDescription,
    val scheduledTimeRange: ScheduledTimeRange,
    val scope: TaskScope,
    val ownerMemberId: MemberId?,
    val schedule: TaskSchedule,
    val version: Int,
    val isDeleted: Boolean,
    val point: Int
) : AggregateRoot() {
    init {

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
        scheduledTimeRange: ScheduledTimeRange?,
        scope: TaskScope?,
        ownerMemberId: MemberId?,
        schedule: TaskSchedule?,
        point: Int?,
    ): TaskDefinition {
        return TaskDefinition(
            id = id,
            name = name ?: this.name,
            description = description ?: this.description,
            scheduledTimeRange = scheduledTimeRange ?: this.scheduledTimeRange,
            scope = scope ?: this.scope,
            ownerMemberId = ownerMemberId ?: this.ownerMemberId,
            schedule = schedule ?: this.schedule,
            version = this.version + 1,
            isDeleted = false,
            point = point ?: this.point,
        )
    }

    fun delete(): TaskDefinition {
        val taskDefinition = TaskDefinition(
            id = this.id,
            name = this.name,
            description = this.description,
            scheduledTimeRange = this.scheduledTimeRange,
            scope = this.scope,
            ownerMemberId = this.ownerMemberId,
            schedule = this.schedule,
            version = this.version,
            isDeleted = true,
            point = this.point
        )

        taskDefinition.addDomainEvent(
            TaskDefinitionDeleted(
                taskDefinitionId = taskDefinition.id,
                name = taskDefinition.name,
                description = taskDefinition.description,
                scheduledTimeRange = taskDefinition.scheduledTimeRange,
                scope = taskDefinition.scope,
                ownerMemberId = taskDefinition.ownerMemberId,
                schedule = taskDefinition.schedule,
            )
        )

        return taskDefinition
    }


    companion object {
        fun create(
            name: TaskDefinitionName,
            description: TaskDefinitionDescription,
            scheduledTimeRange: ScheduledTimeRange,
            scope: TaskScope,
            ownerMemberId: MemberId?,
            schedule: TaskSchedule,
            point: Int,
        ): TaskDefinition {
            val taskDefinition = TaskDefinition(
                id = TaskDefinitionId.generate(),
                name = name,
                description = description,
                scheduledTimeRange = scheduledTimeRange,
                scope = scope,
                ownerMemberId = ownerMemberId,
                schedule = schedule,
                version = 1,
                isDeleted = false,
                point = point
            )

            // ここでドメインイベントを蓄積のみ行う
            taskDefinition.addDomainEvent(
                TaskDefinitionCreated(
                    taskDefinitionId = taskDefinition.id,
                    name = taskDefinition.name,
                    description = taskDefinition.description,
                    scheduledTimeRange = taskDefinition.scheduledTimeRange,
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
            scheduledTimeRange: ScheduledTimeRange,
            scope: TaskScope,
            ownerMemberId: MemberId?,
            schedule: TaskSchedule,
            version: Int,
            isDeleted: Boolean,
            point: Int,
        ): TaskDefinition {
            return TaskDefinition(
                id = id,
                name = name,
                description = description,
                scheduledTimeRange = scheduledTimeRange,
                scope = scope,
                ownerMemberId = ownerMemberId,
                schedule = schedule,
                version = version,
                isDeleted = isDeleted,
                point = point
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

data class ScheduledTimeRange(
    val startTime: Instant,
    val endTime: Instant,
){
    init {
        require(startTime < endTime) {
            "開始時間は終了時間より前である必要があります: $startTime >= $endTime"
        }
    }

    val durationMinutes: Int
        get() = java.time.Duration.between(startTime, endTime).toMinutes().toInt()
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
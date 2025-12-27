package com.task.domain.taskExecution

import com.task.domain.member.MemberId
import com.task.domain.taskDefinition.TaskDefinition
import com.task.domain.taskDefinition.TaskDefinitionDescription
import com.task.domain.taskDefinition.TaskDefinitionId
import com.task.domain.taskDefinition.TaskDefinitionName
import com.task.domain.taskDefinition.TaskScope
import java.time.Instant
import java.util.UUID


sealed class TaskExecution {
    abstract val id: TaskExecutionId
    abstract val taskDefinitionId: TaskDefinitionId
    abstract val scheduledDate: Instant

    data class NotStarted(
        override val id: TaskExecutionId,
        override val taskDefinitionId: TaskDefinitionId,
        override val scheduledDate: Instant,
        val assigneeMemberId: MemberId?
    ) : TaskExecution() {

        fun start(
            assigneeMemberId: MemberId,
            taskDefinition: TaskDefinition
        ): InProgress {
            require(!taskDefinition.isDeleted) {
                "削除されたタスクは開始できません。"
            }

            return InProgress(
                id = this.id,
                taskDefinitionId = this.taskDefinitionId,
                scheduledDate = this.scheduledDate,
                assigneeMemberId = assigneeMemberId,
                taskSnapshot = TaskSnapshot.create(taskDefinition),
                startedAt = Instant.now()
            )
        }

        fun cancel(definitionIsDeleted: Boolean): Cancelled {
            require(!definitionIsDeleted) {
                "削除されたタスクはキャンセルできません。"
            }
            return Cancelled(
                id = this.id,
                taskDefinitionId = this.taskDefinitionId,
                scheduledDate = this.scheduledDate,
                assigneeMemberId = this.assigneeMemberId,
                taskSnapshot = null,
                startedAt = null,
                cancelledAt = Instant.now()
            )
        }
    }

    data class InProgress(
        override val id: TaskExecutionId,
        override val taskDefinitionId: TaskDefinitionId,
        override val scheduledDate: Instant,
        val assigneeMemberId: MemberId,
        val taskSnapshot: TaskSnapshot,
        val startedAt: Instant,
    ) : TaskExecution() {

        fun complete(
            completedByMemberId: MemberId,
            definitionIsDeleted: Boolean
        ): Completed {
            require(!definitionIsDeleted) {
                "削除されたタスクは完了できません。"
            }
            return Completed(
                id = this.id,
                taskDefinitionId = this.taskDefinitionId,
                scheduledDate = this.scheduledDate,
                assigneeMemberId = this.assigneeMemberId,
                taskSnapshot = this.taskSnapshot,
                startedAt = this.startedAt,
                completedAt = Instant.now(),
                completedByMemberId = completedByMemberId,
            )
        }

        fun cancel(definitionIsDeleted: Boolean): Cancelled {
            require(!definitionIsDeleted) {
                "削除されたタスクはキャンセルできません。"
            }
            return Cancelled(
                id = this.id,
                taskDefinitionId = this.taskDefinitionId,
                scheduledDate = this.scheduledDate,
                assigneeMemberId = this.assigneeMemberId,
                taskSnapshot = this.taskSnapshot,
                startedAt = this.startedAt,
                cancelledAt = Instant.now()
            )
        }
    }

    data class Completed(
        override val id: TaskExecutionId,
        override val taskDefinitionId: TaskDefinitionId,
        override val scheduledDate: Instant,
        val assigneeMemberId: MemberId,
        val taskSnapshot: TaskSnapshot,
        val startedAt: Instant,
        val completedAt: Instant,
        val completedByMemberId: MemberId,
    ) : TaskExecution() {
        init {
            require(startedAt.isBefore(completedAt)) {
                "完了日時は開始日時より後である必要があります。"
            }
        }
    }

    data class Cancelled(
        override val id: TaskExecutionId,
        override val taskDefinitionId: TaskDefinitionId,
        override val scheduledDate: Instant,
        val assigneeMemberId: MemberId?,
        val taskSnapshot: TaskSnapshot?,
        val startedAt: Instant?,
        val cancelledAt: Instant,
    ) : TaskExecution()

    companion object {

        fun create(
            taskDefinition: TaskDefinition,
            scheduledDate: Instant,
        ): NotStarted {
            require(!taskDefinition.isDeleted) {
                "削除されたタスクには実行オブジェクトを割当てられません。"
            }
            val assignee = if (taskDefinition.scope == TaskScope.PERSONAL) {
                taskDefinition.ownerMemberId
            } else {
                null
            }

            return NotStarted(
                id = TaskExecutionId.generate(),
                taskDefinitionId = taskDefinition.id,
                scheduledDate = scheduledDate,
                assigneeMemberId = assignee,
            )
        }

        fun reconstructNotStarted(
            id: TaskExecutionId,
            taskDefinitionId: TaskDefinitionId,
            scheduledDate: Instant,
            assigneeMemberId: MemberId?,
        ): NotStarted = NotStarted(id, taskDefinitionId, scheduledDate, assigneeMemberId)

        fun reconstructInProgress(
            id: TaskExecutionId,
            taskDefinitionId: TaskDefinitionId,
            scheduledDate: Instant,
            assigneeMemberId: MemberId,
            taskSnapshot: TaskSnapshot,
            startedAt: Instant,
        ): InProgress = InProgress(
            id, taskDefinitionId, scheduledDate,
            assigneeMemberId, taskSnapshot, startedAt
        )

        fun reconstructCompleted(
            id: TaskExecutionId,
            taskDefinitionId: TaskDefinitionId,
            scheduledDate: Instant,
            assigneeMemberId: MemberId,
            taskSnapshot: TaskSnapshot,
            startedAt: Instant,
            completedAt: Instant,
            completedByMemberId: MemberId,
        ): Completed = Completed(
            id, taskDefinitionId, scheduledDate,
            assigneeMemberId, taskSnapshot, startedAt,
            completedAt, completedByMemberId
        )

        fun reconstructCancelled(
            id: TaskExecutionId,
            taskDefinitionId: TaskDefinitionId,
            scheduledDate: Instant,
            assigneeMemberId: MemberId?,
            taskSnapshot: TaskSnapshot?,
            startedAt: Instant?,
            cancelledAt: Instant,
        ): Cancelled = Cancelled(
            id, taskDefinitionId, scheduledDate,
            assigneeMemberId, taskSnapshot, startedAt, cancelledAt
        )
    }
}

data class TaskExecutionId(val value: UUID) {
    companion object {
        fun generate() = TaskExecutionId(value = UUID.randomUUID())
        fun from(value: String) = TaskExecutionId(value = UUID.fromString(value))
    }
}

data class TaskSnapshot(
    val frozenName: TaskDefinitionName,
    val frozenDescription: TaskDefinitionDescription,
    val frozenEstimatedMinutes: Int,
    val definitionVersion: Int,
    val capturedAt: Instant,
) {
    companion object {
        fun create(
            taskDefinition: TaskDefinition
        ): TaskSnapshot {
            return TaskSnapshot(
                frozenName = taskDefinition.name,
                frozenDescription = taskDefinition.description,
                frozenEstimatedMinutes = taskDefinition.estimatedMinutes,
                definitionVersion = taskDefinition.version,
                capturedAt = Instant.now(),
            )
        }
    }
}

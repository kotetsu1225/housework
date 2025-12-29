package com.task.domain.taskExecution

import com.task.domain.member.MemberId
import com.task.domain.taskDefinition.TaskDefinition
import com.task.domain.taskDefinition.TaskDefinitionDescription
import com.task.domain.taskDefinition.TaskDefinitionId
import com.task.domain.taskDefinition.TaskDefinitionName
import com.task.domain.taskDefinition.TaskScope
import com.task.domain.taskExecution.event.TaskExecutionCancelled
import com.task.domain.taskExecution.event.TaskExecutionCompleted
import com.task.domain.taskExecution.event.TaskExecutionStarted
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
        ): StateChange<InProgress> {
            require(!taskDefinition.isDeleted) {
                "削除されたタスクは開始できません。"
            }

            val now = Instant.now()

            val newInProgressState = InProgress(
                id = this.id,
                taskDefinitionId = this.taskDefinitionId,
                scheduledDate = this.scheduledDate,
                assigneeMemberId = assigneeMemberId,
                taskSnapshot = TaskSnapshot.create(taskDefinition),
                startedAt = now
            )

            val startEvent = TaskExecutionStarted(
                taskExecutionId = this.id,
                assigneeMemberId = assigneeMemberId,
                taskName = taskDefinition.name,
                occurredAt = now,
            )

            return StateChange(newInProgressState, startEvent)
        }

        fun cancel(taskDefinition: TaskDefinition): StateChange<Cancelled> {
            require(!taskDefinition.isDeleted) {
                "削除されたタスクはキャンセルできません。"
            }
            return toCancelledState(taskDefinition.name)
        }

        fun assign(
            newAssigneeMemberId: MemberId
        ): NotStarted{
            return copy(assigneeMemberId = newAssigneeMemberId)
        }

        fun cancelByDefinitionDeletion(taskName: TaskDefinitionName): StateChange<Cancelled> {
            return toCancelledState(taskName)
        }

        private fun toCancelledState(taskName: TaskDefinitionName): StateChange<Cancelled> {
            val now = Instant.now()

            val newCancelledState = Cancelled(
                id = this.id,
                taskDefinitionId = this.taskDefinitionId,
                scheduledDate = this.scheduledDate,
                assigneeMemberId = this.assigneeMemberId,
                taskSnapshot = null,
                startedAt = null,
                cancelledAt = now
            )

            val cancelEvent = TaskExecutionCancelled(
                taskExecutionId = this.id,
                taskName = taskName,
                occurredAt = now,
            )

            return StateChange(newCancelledState, cancelEvent)
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
        ): StateChange<Completed> {
            require(!definitionIsDeleted) {
                "削除されたタスクは完了できません。"
            }

            val now = Instant.now()
            val newCompletedState = Completed(
                id = this.id,
                taskDefinitionId = this.taskDefinitionId,
                scheduledDate = this.scheduledDate,
                assigneeMemberId = this.assigneeMemberId,
                taskSnapshot = this.taskSnapshot,
                startedAt = this.startedAt,
                completedAt = Instant.now(),
                completedByMemberId = completedByMemberId,
            )

            val completedEvent = TaskExecutionCompleted(
                taskExecutionId = this.id,
                completedByMemberId = completedByMemberId,
                taskName = this.taskSnapshot.frozenName,
                occurredAt = now
            )

            return StateChange(newCompletedState, completedEvent)
        }

        fun cancel(definitionIsDeleted: Boolean): StateChange<Cancelled> {
            require(!definitionIsDeleted) {
                "削除されたタスクはキャンセルできません。"
            }
            return toCancelledState()
        }

        fun assign(newAssigneeMemberId: MemberId): InProgress {
            return copy(assigneeMemberId = newAssigneeMemberId)
        }

        fun cancelByDefinitionDeletion(): StateChange<Cancelled> {
            return toCancelledState()
        }

        private fun toCancelledState(): StateChange<Cancelled> {
            val now = Instant.now()
            val newCancelledState =  Cancelled(
                id = this.id,
                taskDefinitionId = this.taskDefinitionId,
                scheduledDate = this.scheduledDate,
                assigneeMemberId = this.assigneeMemberId,
                taskSnapshot = this.taskSnapshot,
                startedAt = this.startedAt,
                cancelledAt = now
            )
            
            val cancelEvent = TaskExecutionCancelled(
                taskExecutionId = this.id,
                taskName = this.taskSnapshot.frozenName,
                occurredAt = now
            )

            return StateChange(newCancelledState, cancelEvent)
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
        ): StateChange<NotStarted> {
            require(!taskDefinition.isDeleted) {
                "削除されたタスクには実行オブジェクトを割当てられません。"
            }
            val assignee = if (taskDefinition.scope == TaskScope.PERSONAL) {
                taskDefinition.ownerMemberId
            } else {
                null
            }

            val now = Instant.now()

            val newNotStartedState = NotStarted(
                id = TaskExecutionId.generate(),
                taskDefinitionId = taskDefinition.id,
                scheduledDate = scheduledDate,
                assigneeMemberId = assignee,
            )

            val createdEvent = com.task.domain.taskExecution.event.TaskExecutionCreated(
                taskExecutionId = newNotStartedState.id,
                taskName = taskDefinition.name,
                assigneeMemberId = assignee,
                occurredAt = now
            )

            return StateChange(newNotStartedState, createdEvent)
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

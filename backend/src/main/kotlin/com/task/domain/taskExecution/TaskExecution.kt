package com.task.domain.taskExecution

import com.task.domain.member.MemberId
import com.task.domain.taskDefinition.ScheduledTimeRange
import com.task.domain.taskDefinition.TaskDefinition
import com.task.domain.taskDefinition.TaskDefinitionDescription
import com.task.domain.taskDefinition.TaskDefinitionId
import com.task.domain.taskDefinition.TaskDefinitionName
import com.task.domain.taskDefinition.TaskScope
import com.task.domain.taskExecution.event.TaskExecutionCancelled
import com.task.domain.taskExecution.event.TaskExecutionCompleted
import com.task.domain.taskExecution.event.TaskExecutionCreated
import com.task.domain.taskExecution.event.TaskExecutionStarted
import java.time.Instant
import java.util.UUID

sealed class TaskExecution {
    abstract val id: TaskExecutionId
    abstract val taskDefinitionId: TaskDefinitionId
    abstract val scheduledDate: Instant
    abstract val assigneeMemberIds: List<MemberId>

    data class NotStarted(
        override val id: TaskExecutionId,
        override val taskDefinitionId: TaskDefinitionId,
        override val scheduledDate: Instant,
        override val assigneeMemberIds: List<MemberId>
    ) : TaskExecution() {

        fun start(
            assigneeMemberIds: List<MemberId>,
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
                assigneeMemberIds = assigneeMemberIds,
                taskSnapshot = TaskSnapshot.create(taskDefinition),
                startedAt = now
            )

            val startEvent = TaskExecutionStarted(
                taskExecutionId = this.id,
                assigneeMemberIds = assigneeMemberIds,
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


        private fun toCancelledState(taskName: TaskDefinitionName): StateChange<Cancelled> {
            val now = Instant.now()

            val newCancelledState = Cancelled(
                id = this.id,
                taskDefinitionId = this.taskDefinitionId,
                scheduledDate = this.scheduledDate,
                assigneeMemberIds = this.assigneeMemberIds,
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
        override val assigneeMemberIds: List<MemberId>,
        val taskSnapshot: TaskSnapshot,
        val startedAt: Instant,
    ) : TaskExecution() {
        init {
            require(assigneeMemberIds.isNotEmpty()) {
                "進行中タスクには担当者が1人以上必要です。"
            }
        }
        fun complete(
            definitionIsDeleted: Boolean
        ): StateChange<Completed> {
            require(!definitionIsDeleted) {
                "削除されたタスクは完了できません。"
            }

            val now = Instant.now()

            // ポイント按分計算（ビジネスロジック）
            val earnedPointPerMember = taskSnapshot.frozenPoint / assigneeMemberIds.size

            val newCompletedState = Completed(
                id = this.id,
                taskDefinitionId = this.taskDefinitionId,
                scheduledDate = this.scheduledDate,
                assigneeMemberIds = this.assigneeMemberIds,
                taskSnapshot = this.taskSnapshot,
                startedAt = this.startedAt,
                completedAt = now,
                earnedPoint = earnedPointPerMember
            )

            val completedEvent = TaskExecutionCompleted(
                taskExecutionId = this.id,
                assigneeMemberIds = this.assigneeMemberIds,
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

        private fun toCancelledState(): StateChange<Cancelled> {
            val now = Instant.now()
            val newCancelledState =  Cancelled(
                id = this.id,
                taskDefinitionId = this.taskDefinitionId,
                scheduledDate = this.scheduledDate,
                assigneeMemberIds = this.assigneeMemberIds,
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
        override val assigneeMemberIds: List<MemberId>,
        val taskSnapshot: TaskSnapshot,
        val startedAt: Instant,
        val completedAt: Instant,
        val earnedPoint: Int
    ) : TaskExecution() {
        init {
            require(startedAt.isBefore(completedAt)) {
                "完了日時は開始日時より後である必要があります。"
            }
            require(assigneeMemberIds.isNotEmpty()) {
                "完了タスクには担当者が1人以上必要です。"
            }
        }
    }

    data class Cancelled(
        override val id: TaskExecutionId,
        override val taskDefinitionId: TaskDefinitionId,
        override val scheduledDate: Instant,
        override val assigneeMemberIds: List<MemberId>,
        val taskSnapshot: TaskSnapshot?,
        val startedAt: Instant?,
        val cancelledAt: Instant,
    ) : TaskExecution()

    companion object {

        fun create(
            taskDefinition: TaskDefinition,
            scheduledDate: Instant
        ): StateChange<NotStarted> {
            val now = Instant.now()

            val newNotStartedState = NotStarted(
                id = TaskExecutionId.generate(),
                taskDefinitionId = taskDefinition.id,
                scheduledDate = scheduledDate,
                assigneeMemberIds = emptyList(),
            )

            val createEvent = TaskExecutionCreated(
                taskExecutionId = newNotStartedState.id,
                taskName = taskDefinition.name,
                occurredAt = now
            )

            return StateChange(newNotStartedState, createEvent)
        }


        fun reconstructNotStarted(
            id: TaskExecutionId,
            taskDefinitionId: TaskDefinitionId,
            scheduledDate: Instant,
            assigneeMemberIds: List<MemberId>,
        ): NotStarted = NotStarted(id, taskDefinitionId, scheduledDate, assigneeMemberIds)

        fun reconstructInProgress(
            id: TaskExecutionId,
            taskDefinitionId: TaskDefinitionId,
            scheduledDate: Instant,
            assigneeMemberIds: List<MemberId>,
            taskSnapshot: TaskSnapshot,
            startedAt: Instant,
        ): InProgress = InProgress(
            id, taskDefinitionId, scheduledDate, assigneeMemberIds, taskSnapshot, startedAt
        )

        fun reconstructCompleted(
            id: TaskExecutionId,
            taskDefinitionId: TaskDefinitionId,
            scheduledDate: Instant,
            assigneeMemberIds: List<MemberId>,
            taskSnapshot: TaskSnapshot,
            startedAt: Instant,
            completedAt: Instant,
            earnedPoint: Int
        ): Completed = Completed(
            id, taskDefinitionId, scheduledDate, assigneeMemberIds, taskSnapshot, startedAt, completedAt, earnedPoint)

        fun reconstructCancelled(
            id: TaskExecutionId,
            taskDefinitionId: TaskDefinitionId,
            scheduledDate: Instant,
            assigneeMemberIds: List<MemberId>,
            taskSnapshot: TaskSnapshot?,
            startedAt: Instant?,
            cancelledAt: Instant,
        ): Cancelled = Cancelled(
            id, taskDefinitionId, scheduledDate, assigneeMemberIds, taskSnapshot, startedAt, cancelledAt
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
    val frozenScheduledTimeRange: ScheduledTimeRange,
    val frozenPoint: Int,
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
                frozenScheduledTimeRange = taskDefinition.scheduledTimeRange,
                frozenPoint = taskDefinition.point,
                definitionVersion = taskDefinition.version,
                capturedAt = Instant.now(),
            )
        }
    }
}

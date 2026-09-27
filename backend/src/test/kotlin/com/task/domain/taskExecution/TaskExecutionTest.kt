package com.task.domain.taskExecution

import com.task.domain.member.MemberId
import com.task.domain.taskDefinition.ScheduledTimeRange
import com.task.domain.taskDefinition.TaskDefinition
import com.task.domain.taskDefinition.TaskDefinitionDescription
import com.task.domain.taskDefinition.TaskDefinitionName
import com.task.domain.taskDefinition.TaskSchedule
import com.task.domain.taskDefinition.TaskScope
import com.task.domain.tenant.TenantId
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.time.Instant
import java.time.LocalDate
import java.time.temporal.ChronoUnit

class TaskExecutionTest {

    private fun buildTaskDefinition(tenantId: TenantId): TaskDefinition {
        val now = Instant.now()
        return TaskDefinition.create(
            tenantId = tenantId,
            name = TaskDefinitionName("皿洗い"),
            description = TaskDefinitionDescription("夕食後に皿を洗う"),
            scheduledTimeRange = ScheduledTimeRange(
                startTime = now,
                endTime = now.plus(30, ChronoUnit.MINUTES),
            ),
            scope = TaskScope.FAMILY,
            ownerMemberId = null,
            schedule = TaskSchedule.OneTime(deadline = LocalDate.now().plusDays(1)),
            point = 10,
        )
    }

    private fun buildNotStarted(taskDefinition: TaskDefinition): TaskExecution.NotStarted {
        return TaskExecution.create(
            taskDefinition = taskDefinition,
            scheduledDate = Instant.now(),
        ).newState
    }

    @Test
    fun `createでは親のTaskDefinitionのtenantIdを引き継ぐ`() {
        val tenantId = TenantId.generate()
        val taskDefinition = buildTaskDefinition(tenantId)

        val notStarted = buildNotStarted(taskDefinition)

        assertEquals(tenantId, notStarted.tenantId)
    }

    @Test
    fun `startしてからcompleteしてもtenantIdは変わらない`() {
        val tenantId = TenantId.generate()
        val taskDefinition = buildTaskDefinition(tenantId)
        val notStarted = buildNotStarted(taskDefinition)

        val inProgress = notStarted.start(
            assigneeMemberIds = listOf(MemberId.generate()),
            taskDefinition = taskDefinition,
        ).newState
        assertEquals(tenantId, inProgress.tenantId)

        val completed = inProgress.complete(
            definitionIsDeleted = false,
            taskScope = taskDefinition.scope,
        ).newState

        assertEquals(tenantId, completed.tenantId)
    }

    @Test
    fun `startしてからcancelしてもtenantIdは変わらない`() {
        val tenantId = TenantId.generate()
        val taskDefinition = buildTaskDefinition(tenantId)
        val notStarted = buildNotStarted(taskDefinition)

        val inProgress = notStarted.start(
            assigneeMemberIds = listOf(MemberId.generate()),
            taskDefinition = taskDefinition,
        ).newState
        assertEquals(tenantId, inProgress.tenantId)

        val cancelled = inProgress.cancel(definitionIsDeleted = false).newState

        assertEquals(tenantId, cancelled.tenantId)
    }

    @Test
    fun `NotStartedのcancelの後もtenantIdは変わらない`() {
        val tenantId = TenantId.generate()
        val taskDefinition = buildTaskDefinition(tenantId)
        val notStarted = buildNotStarted(taskDefinition)

        val cancelled = notStarted.cancel(taskDefinition).newState

        assertEquals(tenantId, cancelled.tenantId)
    }
}

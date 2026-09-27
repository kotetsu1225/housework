package com.task.domain.taskExecution

import com.task.domain.member.FamilyRole
import com.task.domain.member.Member
import com.task.domain.member.MemberEmail
import com.task.domain.member.MemberName
import com.task.domain.member.PasswordHash
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
            owner = null,
            schedule = TaskSchedule.OneTime(deadline = LocalDate.now().plusDays(1)),
            point = 10,
        )
    }

    private fun buildMember(tenantId: TenantId): Member {
        return Member.create(
            tenantId = tenantId,
            name = MemberName("山田太郎"),
            email = MemberEmail("taro-${java.util.UUID.randomUUID()}@example.com"),
            familyRole = FamilyRole.FATHER,
            password = PasswordHash("hashed-password"),
            existingMembersName = emptyList(),
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
            assignees = listOf(buildMember(tenantId)),
            taskDefinition = taskDefinition,
        ).newState
        assertEquals(tenantId, inProgress.tenantId)

        val completed = inProgress.complete(taskDefinition).newState

        assertEquals(tenantId, completed.tenantId)
    }

    @Test
    fun `startしてからcancelしてもtenantIdは変わらない`() {
        val tenantId = TenantId.generate()
        val taskDefinition = buildTaskDefinition(tenantId)
        val notStarted = buildNotStarted(taskDefinition)

        val inProgress = notStarted.start(
            assignees = listOf(buildMember(tenantId)),
            taskDefinition = taskDefinition,
        ).newState
        assertEquals(tenantId, inProgress.tenantId)

        val cancelled = inProgress.cancel(taskDefinition).newState

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

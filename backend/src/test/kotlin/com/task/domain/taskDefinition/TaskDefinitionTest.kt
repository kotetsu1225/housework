package com.task.domain.taskDefinition

import com.task.domain.tenant.TenantId
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.time.Instant
import java.time.LocalDate
import java.time.temporal.ChronoUnit

class TaskDefinitionTest {

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

    @Test
    fun `createで渡したtenantIdがそのまま保持される`() {
        val tenantId = TenantId.generate()

        val taskDefinition = buildTaskDefinition(tenantId)

        assertEquals(tenantId, taskDefinition.tenantId)
    }

    @Test
    fun `updateしてもtenantIdは変わらない`() {
        val tenantId = TenantId.generate()
        val taskDefinition = buildTaskDefinition(tenantId)

        val updated = taskDefinition.update(
            id = taskDefinition.id,
            name = TaskDefinitionName("お風呂掃除"),
            description = null,
            scheduledTimeRange = null,
            scope = null,
            ownerMemberId = null,
            schedule = null,
            point = null,
        )

        assertEquals(tenantId, updated.tenantId)
        assertEquals(TaskDefinitionName("お風呂掃除"), updated.name)
    }

    @Test
    fun `deleteしてもtenantIdは変わらない`() {
        val tenantId = TenantId.generate()
        val taskDefinition = buildTaskDefinition(tenantId)

        val deleted = taskDefinition.delete()

        assertEquals(tenantId, deleted.tenantId)
        assertTrue(deleted.isDeleted)
    }
}

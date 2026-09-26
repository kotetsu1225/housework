package com.task.infra.taskDefinition

import com.task.domain.taskDefinition.RecurrencePattern
import com.task.domain.taskDefinition.ScheduledTimeRange
import com.task.domain.taskDefinition.TaskDefinition
import com.task.domain.taskDefinition.TaskDefinitionDescription
import com.task.domain.taskDefinition.TaskDefinitionName
import com.task.domain.taskDefinition.TaskSchedule
import com.task.domain.taskDefinition.TaskScope
import com.task.domain.tenant.TenantId
import com.task.infra.database.jooq.tables.references.TASK_DEFINITIONS
import com.task.infra.database.jooq.tables.references.TASK_RECURRENCES
import com.task.infra.database.jooq.tables.references.TENANTS
import com.task.support.PostgresTestDatabase
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.temporal.ChronoUnit

/**
 * #46 の受け入れ条件を実 DB で確かめる。
 * - task_definitions と task_recurrences の両方に同じ tenant_id が保存される
 * - スケジュール更新(recurrence の DELETE → INSERT)後も tenant_id が維持される
 */
class TaskDefinitionRepositoryTenantTest {

    private val repository = TaskDefinitionRepositoryImpl()

    @AfterEach
    fun cleanup() {
        PostgresTestDatabase.truncateAll()
    }

    private fun createTenant(): TenantId {
        val tenantId = TenantId.generate()
        PostgresTestDatabase.ownerDsl().insertInto(TENANTS)
            .set(TENANTS.ID, tenantId.value)
            .set(TENANTS.FAMILY_NAME, "山田家")
            .set(TENANTS.EMAIL, "family-${tenantId.value}@example.com")
            .execute()
        return tenantId
    }

    private fun weeklyDefinition(tenantId: TenantId): TaskDefinition {
        val now = Instant.now()
        return TaskDefinition.create(
            tenantId = tenantId,
            name = TaskDefinitionName("皿洗い"),
            description = TaskDefinitionDescription("夕食後に皿を洗う"),
            scheduledTimeRange = ScheduledTimeRange(startTime = now, endTime = now.plus(30, ChronoUnit.MINUTES)),
            scope = TaskScope.FAMILY,
            ownerMemberId = null,
            schedule = TaskSchedule.Recurring(
                pattern = RecurrencePattern.Weekly(DayOfWeek.MONDAY),
                startDate = LocalDate.now(),
                endDate = null,
            ),
            point = 10,
        )
    }

    private fun storedTenantIds(definition: TaskDefinition): Pair<Any?, List<Any?>> {
        val owner = PostgresTestDatabase.ownerDsl()
        val definitionTenant = owner.select(TASK_DEFINITIONS.TENANT_ID).from(TASK_DEFINITIONS)
            .where(TASK_DEFINITIONS.ID.eq(definition.id.value)).fetchOne(TASK_DEFINITIONS.TENANT_ID)
        val recurrenceTenants = owner.select(TASK_RECURRENCES.TENANT_ID).from(TASK_RECURRENCES)
            .where(TASK_RECURRENCES.TASK_DEFINITION_ID.eq(definition.id.value)).fetch(TASK_RECURRENCES.TENANT_ID)
        return definitionTenant to recurrenceTenants
    }

    @Test
    fun `create で task_definitions と task_recurrences の両方に同じ tenant_id が入り、再構築でも同じ`() {
        val tenantId = createTenant()
        val definition = weeklyDefinition(tenantId)

        // tenant スコープのトランザクションで保存する(RLS の WITH CHECK も通ることの確認を兼ねる)
        PostgresTestDatabase.inTenantTransaction(tenantId) { session -> repository.create(definition, session) }

        val (definitionTenant, recurrenceTenants) = storedTenantIds(definition)
        assertEquals(tenantId.value, definitionTenant)
        assertEquals(listOf(tenantId.value), recurrenceTenants)

        val reconstructed = PostgresTestDatabase.inTenantTransaction(tenantId) { session ->
            repository.findById(definition.id, session)
        }
        assertEquals(tenantId, reconstructed!!.tenantId)
    }

    @Test
    fun `スケジュールを更新して recurrence が作り直されても tenant_id が維持される`() {
        val tenantId = createTenant()
        val definition = weeklyDefinition(tenantId)
        PostgresTestDatabase.inTenantTransaction(tenantId) { session -> repository.create(definition, session) }

        val rescheduled = definition.update(
            id = definition.id,
            name = null,
            description = null,
            scheduledTimeRange = null,
            scope = null,
            ownerMemberId = null,
            schedule = TaskSchedule.Recurring(
                pattern = RecurrencePattern.Monthly(dayOfMonth = 15),
                startDate = LocalDate.now(),
                endDate = null,
            ),
            point = null,
        )
        PostgresTestDatabase.inTenantTransaction(tenantId) { session -> repository.update(rescheduled, session) }

        val (definitionTenant, recurrenceTenants) = storedTenantIds(definition)
        assertEquals(tenantId.value, definitionTenant)
        assertEquals(listOf(tenantId.value), recurrenceTenants)
        val pattern = PostgresTestDatabase.ownerDsl().select(TASK_RECURRENCES.PATTERN_TYPE).from(TASK_RECURRENCES)
            .where(TASK_RECURRENCES.TASK_DEFINITION_ID.eq(definition.id.value)).fetchOne(TASK_RECURRENCES.PATTERN_TYPE)
        assertEquals("MONTHLY", pattern) // 本当に作り直されたことの確認
    }
}

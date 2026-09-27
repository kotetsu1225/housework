package com.task.infra.taskExecution

import com.task.domain.member.MemberId
import com.task.domain.taskDefinition.ScheduledTimeRange
import com.task.domain.taskDefinition.TaskDefinition
import com.task.domain.taskDefinition.TaskDefinitionDescription
import com.task.domain.taskDefinition.TaskDefinitionName
import com.task.domain.taskDefinition.TaskSchedule
import com.task.domain.taskDefinition.TaskScope
import com.task.domain.taskExecution.TaskExecution
import com.task.domain.tenant.TenantId
import com.task.infra.database.jooq.tables.references.MEMBERS
import com.task.infra.database.jooq.tables.references.TASK_EXECUTIONS
import com.task.infra.database.jooq.tables.references.TASK_EXECUTION_PARTICIPANTS
import com.task.infra.database.jooq.tables.references.TASK_SNAPSHOTS
import com.task.infra.member.MemberRepositoryImpl
import com.task.infra.taskDefinition.TaskDefinitionRepositoryImpl
import com.task.support.PostgresTestDatabase
import com.task.support.TestFixtures
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.time.Instant
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import java.util.UUID

/**
 * #47 の受け入れ条件「開始(snapshot 作成)・担当者変更・完了の各操作後、3 テーブルすべての行に正しい tenant_id が入っている」
 * を実 DB で確かめる。すべて tenant スコープのトランザクション(RLS の WITH CHECK も効く)で操作する。
 */
class TaskExecutionRepositoryTenantTest {

    private val executionRepository = TaskExecutionRepositoryImpl()
    private val definitionRepository = TaskDefinitionRepositoryImpl()
    private val memberRepository = MemberRepositoryImpl()

    @AfterEach
    fun cleanup() {
        PostgresTestDatabase.truncateAll()
    }

    /** 実行 1 件に紐づく 3 テーブルの tenant_id を(行ごとに)集める */
    private fun tenantIdsOf(executionId: UUID): Map<String, List<UUID?>> {
        val owner = PostgresTestDatabase.ownerDsl()
        return mapOf(
            "task_executions" to owner.select(TASK_EXECUTIONS.TENANT_ID).from(TASK_EXECUTIONS)
                .where(TASK_EXECUTIONS.ID.eq(executionId)).fetch(TASK_EXECUTIONS.TENANT_ID),
            "task_snapshots" to owner.select(TASK_SNAPSHOTS.TENANT_ID).from(TASK_SNAPSHOTS)
                .where(TASK_SNAPSHOTS.TASK_EXECUTION_ID.eq(executionId)).fetch(TASK_SNAPSHOTS.TENANT_ID),
            "task_execution_participants" to owner.select(TASK_EXECUTION_PARTICIPANTS.TENANT_ID)
                .from(TASK_EXECUTION_PARTICIPANTS)
                .where(TASK_EXECUTION_PARTICIPANTS.TASK_EXECUTION_ID.eq(executionId))
                .fetch(TASK_EXECUTION_PARTICIPANTS.TENANT_ID),
        )
    }

    private fun assertAllRowsBelongTo(tenantId: TenantId, executionId: UUID, expectSnapshot: Boolean) {
        val rows = tenantIdsOf(executionId)
        assertEquals(listOf(tenantId.value), rows["task_executions"])
        if (expectSnapshot) {
            assertEquals(listOf(tenantId.value), rows["task_snapshots"])
        }
        val participants = rows["task_execution_participants"]!!
        assertTrue(participants.isNotEmpty()) { "participants の行が無い" }
        assertTrue(participants.all { it == tenantId.value }) { "participants に別の tenant_id: $participants" }
    }

    @Test
    fun `開始・担当者変更・完了の後も 3 テーブルの tenant_id が親の TaskExecution と同じ`() {
        val owner = PostgresTestDatabase.ownerDsl()
        val family = TestFixtures.createTenantWithMember(owner, "山田家", "太郎", "taro@example.com")
        val tenantId = family.tenantId
        val secondMember = MemberId(UUID.randomUUID())
        owner.insertInto(MEMBERS)
            .set(MEMBERS.ID, secondMember.value)
            .set(MEMBERS.NAME, "花子")
            .set(MEMBERS.ROLE, "MOTHER")
            .set(MEMBERS.PASSWORD_HASH, "dummy-password-hash")
            .set(MEMBERS.EMAIL, "hanako@example.com")
            .set(MEMBERS.TENANT_ID, tenantId.value)
            .execute()

        val now = Instant.now()
        val definition = TaskDefinition.create(
            tenantId = tenantId,
            name = TaskDefinitionName("皿洗い"),
            description = TaskDefinitionDescription("夕食後に皿を洗う"),
            scheduledTimeRange = ScheduledTimeRange(startTime = now, endTime = now.plus(30, ChronoUnit.MINUTES)),
            scope = TaskScope.FAMILY,
            owner = null,
            schedule = TaskSchedule.OneTime(deadline = LocalDate.now().plusDays(1)),
            point = 10,
        )
        PostgresTestDatabase.inTenantTransaction(tenantId) { session -> definitionRepository.create(definition, session) }

        // 作成: TaskDefinition の tenantId を引き継ぐ
        val notStarted = TaskExecution.create(definition, now).newState
        assertEquals(tenantId, notStarted.tenantId)
        PostgresTestDatabase.inTenantTransaction(tenantId) { session -> executionRepository.create(notStarted, session) }
        val executionId = notStarted.id.value

        // 開始: task_snapshots と task_execution_participants が作られる
        val member = PostgresTestDatabase.inTenantTransaction(tenantId) { session -> memberRepository.findById(family.memberId, session) }
            ?: throw IllegalStateException("テストフィクスチャのメンバーが見つかりません: ${family.memberId}")
        val inProgress = notStarted.start(listOf(member), definition).newState
        PostgresTestDatabase.inTenantTransaction(tenantId) { session -> executionRepository.update(inProgress, session) }
        assertAllRowsBelongTo(tenantId, executionId, expectSnapshot = true)

        // 担当者変更(#12 の既知の不具合で新しい担当者が保存されない可能性があるため、行数ではなく全行の tenant_id を見る)
        PostgresTestDatabase.inTenantTransaction(tenantId) { session ->
            executionRepository.updateAssigneeMember(inProgress, listOf(family.memberId, secondMember), session)
        }
        assertAllRowsBelongTo(tenantId, executionId, expectSnapshot = true)

        // 完了
        val completed = inProgress.complete(definition).newState
        PostgresTestDatabase.inTenantTransaction(tenantId) { session -> executionRepository.update(completed, session) }
        assertAllRowsBelongTo(tenantId, executionId, expectSnapshot = true)

        // 再構築しても tenantId が同じ
        val reloaded = PostgresTestDatabase.inTenantTransaction(tenantId) { session ->
            executionRepository.findById(notStarted.id, session)
        }
        assertEquals(tenantId, reloaded!!.tenantId)
        assertTrue(reloaded is TaskExecution.Completed)
    }
}

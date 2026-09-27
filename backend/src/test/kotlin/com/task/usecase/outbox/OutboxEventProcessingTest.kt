package com.task.usecase.outbox

import com.task.infra.member.MemberRepositoryImpl
import com.task.domain.taskDefinition.ScheduledTimeRange
import com.task.domain.taskDefinition.TaskDefinition
import com.task.domain.taskDefinition.TaskDefinitionDescription
import com.task.domain.taskDefinition.TaskDefinitionName
import com.task.domain.taskDefinition.TaskSchedule
import com.task.domain.taskDefinition.TaskScope
import com.task.domain.taskDefinition.event.TaskDefinitionDeleted
import com.task.domain.taskExecution.TaskExecution
import com.task.domain.tenant.TenantId
import com.task.infra.database.Database
import com.task.infra.database.DatabaseWithoutRLS
import com.task.infra.database.jooq.tables.references.COMPLETED_DOMAIN_EVENTS
import com.task.infra.database.jooq.tables.references.OUTBOX
import com.task.infra.outbox.CompletedDomainEventRepositoryImpl
import com.task.infra.outbox.DomainEventSerializer
import com.task.infra.outbox.OutboxRecord
import com.task.infra.outbox.OutboxRepositoryImpl
import com.task.infra.outbox.OutboxStatus
import com.task.infra.taskDefinition.TaskDefinitionRepositoryImpl
import com.task.infra.taskExecution.TaskExecutionRepositoryImpl
import com.task.support.PostgresTestDatabase
import com.task.support.TestFixtures
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.time.Instant
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import java.util.UUID

/**
 * issue #61の受け入れ条件を実DB(Testcontainers)で確かめる(Pub/Subエミュレータは使わない)。
 *
 * - [HandleTaskDefinitionDeletedUseCaseImpl]: tenant分離と冪等性(同じeventIdを2回処理しても
 *   2回目は何もしない)
 * - [ProcessOutboxEventsUseCaseImpl](アプリ内処理モード): 正常イベントの処理とoutbox更新が
 *   同じトランザクションで完結すること、未知のeventTypeはPROCESSEDにせずretryに回ること
 *
 * 【前提】Dockerが必要([PostgresTestDatabase]参照)。
 */
class OutboxEventProcessingTest {

    private val database = Database(PostgresTestDatabase.ownerDataSource, PostgresTestDatabase.appDataSource)
    private val databaseWithoutRLS = DatabaseWithoutRLS(PostgresTestDatabase.ownerDataSource)
    private val taskExecutionRepository = TaskExecutionRepositoryImpl()
    private val taskDefinitionRepository = TaskDefinitionRepositoryImpl()
    private val completedDomainEventRepository = CompletedDomainEventRepositoryImpl()
    private val outboxRepository = OutboxRepositoryImpl()

    private val handleTaskDefinitionDeletedUseCase: HandleTaskDefinitionDeletedUseCase =
        HandleTaskDefinitionDeletedUseCaseImpl(database, completedDomainEventRepository, taskExecutionRepository)
    private val outboxEventProcessor = OutboxEventProcessor(handleTaskDefinitionDeletedUseCase)
    private val processOutboxEventsUseCase: ProcessOutboxEventsUseCase =
        ProcessOutboxEventsUseCaseImpl(database, databaseWithoutRLS, outboxRepository, outboxEventProcessor)

    @AfterEach
    fun cleanup() {
        PostgresTestDatabase.truncateAll()
    }

    /** tenant + member + 1つのTaskDefinitionと、その配下のNotStarted 1件・InProgress 1件を作る。 */
    private data class TenantFixture(
        val tenantId: TenantId,
        val definition: TaskDefinition,
        val notStarted: TaskExecution.NotStarted,
        val inProgress: TaskExecution.InProgress,
    )

    private fun setUpTenantWithExecutions(familyName: String, memberName: String, email: String): TenantFixture {
        val owner = PostgresTestDatabase.ownerDsl()
        val family = TestFixtures.createTenantWithMember(owner, familyName, memberName, email)
        val tenantId = family.tenantId

        val now = Instant.now()
        val definition = TaskDefinition.create(
            tenantId = tenantId,
            name = TaskDefinitionName("皿洗い"),
            description = TaskDefinitionDescription("夕食後の皿洗い"),
            scheduledTimeRange = ScheduledTimeRange(startTime = now, endTime = now.plus(30, ChronoUnit.MINUTES)),
            scope = TaskScope.FAMILY,
            owner = null,
            schedule = TaskSchedule.OneTime(deadline = LocalDate.now().plusDays(1)),
            point = 10,
        )
        PostgresTestDatabase.inTenantTransaction(tenantId) { session ->
            taskDefinitionRepository.create(definition, session)
        }

        val notStarted = TaskExecution.create(definition, now).newState
        PostgresTestDatabase.inTenantTransaction(tenantId) { session ->
            taskExecutionRepository.create(notStarted, session)
        }

        val toStart = TaskExecution.create(definition, now.plus(1, ChronoUnit.DAYS)).newState
        PostgresTestDatabase.inTenantTransaction(tenantId) { session ->
            taskExecutionRepository.create(toStart, session)
        }
        val assignee = PostgresTestDatabase.inTenantTransaction(tenantId) { session ->
            MemberRepositoryImpl().findById(family.memberId, session)!!
        }
        val inProgress = toStart.start(listOf(assignee), definition).newState
        PostgresTestDatabase.inTenantTransaction(tenantId) { session ->
            taskExecutionRepository.update(inProgress, session)
        }

        return TenantFixture(tenantId, definition, notStarted, inProgress)
    }

    private fun buildDeletedPayload(definition: TaskDefinition): String {
        val event = TaskDefinitionDeleted(
            taskDefinitionId = definition.id,
            name = definition.name,
            description = definition.description,
            scheduledTimeRange = definition.scheduledTimeRange,
            scope = definition.scope,
            ownerMemberId = definition.ownerMemberId,
            schedule = definition.schedule,
            occurredAt = Instant.now(),
        )
        return DomainEventSerializer.serialize(event)
    }

    private fun reloadExecution(tenantId: TenantId, execution: TaskExecution): TaskExecution {
        return PostgresTestDatabase.inTenantTransaction(tenantId) { session ->
            taskExecutionRepository.findById(execution.id, session)
        }!!
    }

    private fun completedDomainEventCount(eventId: UUID): Int {
        return PostgresTestDatabase.ownerDsl().selectCount().from(COMPLETED_DOMAIN_EVENTS)
            .where(COMPLETED_DOMAIN_EVENTS.EVENT_ID.eq(eventId))
            .fetchOne(0, Int::class.java) ?: 0
    }

    @Test
    fun `HandleTaskDefinitionDeletedUseCaseはAの実行だけキャンセルしBには影響しない`() {
        val tenantA = setUpTenantWithExecutions("田中家", "太郎", "tanaka-a@example.com")
        val tenantB = setUpTenantWithExecutions("鈴木家", "次郎", "suzuki-b@example.com")

        val payload = buildDeletedPayload(tenantA.definition)
        val eventId = DomainEventSerializer.extractEventId(payload)

        val output = handleTaskDefinitionDeletedUseCase.execute(
            HandleTaskDefinitionDeletedUseCase.Input(eventId, tenantA.tenantId, payload)
        )
        assertEquals(HandleTaskDefinitionDeletedUseCase.Outcome.PROCESSED, output.outcome)

        val reloadedANotStarted = reloadExecution(tenantA.tenantId, tenantA.notStarted)
        val reloadedAInProgress = reloadExecution(tenantA.tenantId, tenantA.inProgress)
        assertTrue(reloadedANotStarted is TaskExecution.Cancelled) { "Aの NotStarted がキャンセルされていない" }
        assertTrue(reloadedAInProgress is TaskExecution.Cancelled) { "Aの InProgress がキャンセルされていない" }

        val reloadedBNotStarted = reloadExecution(tenantB.tenantId, tenantB.notStarted)
        val reloadedBInProgress = reloadExecution(tenantB.tenantId, tenantB.inProgress)
        assertTrue(reloadedBNotStarted is TaskExecution.NotStarted) { "Bの NotStarted が変更されてしまった" }
        assertTrue(reloadedBInProgress is TaskExecution.InProgress) { "Bの InProgress が変更されてしまった" }

        assertEquals(1, completedDomainEventCount(eventId))
        val storedTenantId = PostgresTestDatabase.ownerDsl()
            .select(COMPLETED_DOMAIN_EVENTS.TENANT_ID).from(COMPLETED_DOMAIN_EVENTS)
            .where(COMPLETED_DOMAIN_EVENTS.EVENT_ID.eq(eventId))
            .fetchOne(COMPLETED_DOMAIN_EVENTS.TENANT_ID)
        assertEquals(tenantA.tenantId.value, storedTenantId)
    }

    @Test
    fun `同じeventIdで2回目を呼んでも何もしない(冪等)`() {
        val tenantA = setUpTenantWithExecutions("佐藤家", "花子", "sato-idempotent@example.com")
        val payload = buildDeletedPayload(tenantA.definition)
        val eventId = DomainEventSerializer.extractEventId(payload)

        val firstOutput = handleTaskDefinitionDeletedUseCase.execute(
            HandleTaskDefinitionDeletedUseCase.Input(eventId, tenantA.tenantId, payload)
        )
        assertEquals(HandleTaskDefinitionDeletedUseCase.Outcome.PROCESSED, firstOutput.outcome)

        val cancelledAfterFirst = reloadExecution(tenantA.tenantId, tenantA.inProgress) as TaskExecution.Cancelled

        val secondOutput = handleTaskDefinitionDeletedUseCase.execute(
            HandleTaskDefinitionDeletedUseCase.Input(eventId, tenantA.tenantId, payload)
        )
        assertEquals(HandleTaskDefinitionDeletedUseCase.Outcome.ALREADY_PROCESSED, secondOutput.outcome)

        val cancelledAfterSecond = reloadExecution(tenantA.tenantId, tenantA.inProgress) as TaskExecution.Cancelled
        assertEquals(cancelledAfterFirst.cancelledAt, cancelledAfterSecond.cancelledAt)
        assertEquals(1, completedDomainEventCount(eventId))
    }

    @Test
    fun `アプリ内処理モードでは正常イベントはPROCESSEDになり未知のeventTypeはretryに回る`() {
        val tenantA = setUpTenantWithExecutions("山本家", "一郎", "yamamoto-inprocess@example.com")
        val payload = buildDeletedPayload(tenantA.definition)

        val knownRecord = OutboxRecord.create(
            tenantId = tenantA.tenantId,
            eventType = "TaskDefinitionDeleted",
            aggregateType = "TaskDefinition",
            aggregateId = tenantA.definition.id.value,
            payload = payload,
        )
        PostgresTestDatabase.inTenantTransaction(tenantA.tenantId) { session ->
            outboxRepository.save(knownRecord, session)
        }

        // 未知のeventTypeの行は、業務上のテナントに紐づく必然性が無いテストデータなので
        // owner接続(RLSバイパス)で直接投入する。
        val unknownRecord = OutboxRecord.create(
            tenantId = tenantA.tenantId,
            eventType = "SomeFutureEvent",
            aggregateType = "TaskDefinition",
            aggregateId = UUID.randomUUID(),
            payload = """{"eventId":"${UUID.randomUUID()}"}""",
        )
        outboxRepository.save(unknownRecord, PostgresTestDatabase.ownerDsl())

        val output = processOutboxEventsUseCase.execute(ProcessOutboxEventsUseCase.Input(batchSize = 10))
        assertEquals(1, output.processedCount)
        assertEquals(1, output.failedCount)

        val knownStatus = PostgresTestDatabase.ownerDsl()
            .select(OUTBOX.STATUS).from(OUTBOX).where(OUTBOX.ID.eq(knownRecord.id))
            .fetchOne(OUTBOX.STATUS)
        assertEquals(OutboxStatus.PROCESSED.name, knownStatus)

        val cancelled = reloadExecution(tenantA.tenantId, tenantA.inProgress)
        assertTrue(cancelled is TaskExecution.Cancelled) { "既知イベントの実行がキャンセルされていない" }

        val unknownStatus = PostgresTestDatabase.ownerDsl()
            .select(OUTBOX.STATUS).from(OUTBOX).where(OUTBOX.ID.eq(unknownRecord.id))
            .fetchOne(OUTBOX.STATUS)
        assertNotEquals(OutboxStatus.PROCESSED.name, unknownStatus)
        val unknownRetryCount = PostgresTestDatabase.ownerDsl()
            .select(OUTBOX.RETRY_COUNT).from(OUTBOX).where(OUTBOX.ID.eq(unknownRecord.id))
            .fetchOne(OUTBOX.RETRY_COUNT)
        assertEquals(1, unknownRetryCount)
    }
}

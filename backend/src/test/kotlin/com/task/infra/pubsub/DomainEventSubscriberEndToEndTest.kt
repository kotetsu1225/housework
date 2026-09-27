package com.task.infra.pubsub

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
import com.task.infra.database.jooq.tables.references.TASK_EXECUTIONS
import com.task.infra.outbox.CompletedDomainEventRepositoryImpl
import com.task.infra.outbox.DomainEventSerializer
import com.task.infra.outbox.OutboxRecord
import com.task.infra.outbox.OutboxRepositoryImpl
import com.task.infra.taskDefinition.TaskDefinitionRepositoryImpl
import com.task.infra.taskExecution.TaskExecutionRepositoryImpl
import com.task.support.PostgresTestDatabase
import com.task.support.TestFixtures
import com.task.usecase.outbox.HandleTaskDefinitionDeletedUseCaseImpl
import com.task.usecase.outbox.OutboxEventProcessor
import com.task.usecase.outbox.RelayOutboxEventsUseCase
import com.task.usecase.outbox.RelayOutboxEventsUseCaseImpl
import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.testcontainers.gcloud.PubSubEmulatorContainer
import java.time.Instant
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList

/**
 * #61 の受け入れ条件 1 を、リレー(#72)→ Pub/Sub エミュレータ → subscriber(#61)→ DB まで通して確かめる。
 * - tenant A の TaskDefinitionDeleted を publish すると、A の実行だけがキャンセルされ、B は変わらない
 * - 同じイベントの二重配信は completed_domain_events で吸収される
 *
 * 他のテストのメッセージが混ざらないよう、専用の topic / subscription 名を使う。
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class DomainEventSubscriberEndToEndTest {

    private lateinit var container: PubSubEmulatorContainer
    private lateinit var factory: PubSubClientFactory

    private val database = Database(PostgresTestDatabase.ownerDataSource, PostgresTestDatabase.appDataSource)
    private val databaseWithoutRLS = DatabaseWithoutRLS(PostgresTestDatabase.ownerDataSource)
    private val definitionRepository = TaskDefinitionRepositoryImpl()
    private val executionRepository = TaskExecutionRepositoryImpl()
    private val outboxRepository = OutboxRepositoryImpl()

    @BeforeAll
    fun startEmulator() {
        container = PubSubEmulatorContainer("gcr.io/google.com/cloudsdktool/google-cloud-cli:586.0.0-emulators")
        container.start()
        val config = PubSubConfig(
            enabled = true,
            projectId = "e2e-project",
            topicId = "domain-events-e2e",
            subscriptionId = "housework-backend-e2e",
            emulatorHost = container.emulatorEndpoint,
        )
        factory = PubSubClientFactory(config)
        factory.ensureEmulatorResources()
    }

    @AfterAll
    fun stopEmulator() {
        factory.close()
        container.stop()
    }

    @AfterEach
    fun cleanup() {
        PostgresTestDatabase.truncateAll()
    }

    private data class Family(val tenantId: TenantId, val definition: TaskDefinition, val execution: TaskExecution.NotStarted)

    private fun createFamily(familyName: String, memberName: String, email: String): Family {
        val fixture = TestFixtures.createTenantWithMember(PostgresTestDatabase.ownerDsl(), familyName, memberName, email)
        val now = Instant.now()
        val definition = TaskDefinition.create(
            tenantId = fixture.tenantId,
            name = TaskDefinitionName("皿洗い"),
            description = TaskDefinitionDescription("夕食後の皿洗い"),
            scheduledTimeRange = ScheduledTimeRange(startTime = now, endTime = now.plus(30, ChronoUnit.MINUTES)),
            scope = TaskScope.FAMILY,
            owner = null,
            schedule = TaskSchedule.OneTime(deadline = LocalDate.now().plusDays(1)),
            point = 10,
        )
        val execution = TaskExecution.create(definition, now).newState
        PostgresTestDatabase.inTenantTransaction(fixture.tenantId) { session ->
            definitionRepository.create(definition, session)
            executionRepository.create(execution, session)
        }
        return Family(fixture.tenantId, definition, execution)
    }

    /** 削除 UseCase と同じ形で outbox に PENDING を書く(tenant スコープ = 本番と同じ経路) */
    private fun enqueueDeletion(family: Family): OutboxRecord {
        val deleted = family.definition.delete()
        val event = deleted.domainEvents.single() as TaskDefinitionDeleted
        val record = OutboxRecord.create(
            tenantId = family.tenantId,
            eventType = DomainEventSerializer.getEventType(event),
            aggregateType = "TaskDefinition",
            aggregateId = family.definition.id.value,
            payload = DomainEventSerializer.serialize(event),
        )
        PostgresTestDatabase.inTenantTransaction(family.tenantId) { session ->
            definitionRepository.update(deleted, session)
            outboxRepository.save(record, session)
        }
        return record
    }

    private fun statusOf(family: Family): String =
        PostgresTestDatabase.ownerDsl().select(TASK_EXECUTIONS.STATUS).from(TASK_EXECUTIONS)
            .where(TASK_EXECUTIONS.ID.eq(family.execution.id.value)).fetchOne(TASK_EXECUTIONS.STATUS)!!

    private fun waitUntil(timeoutSeconds: Long, condition: () -> Boolean): Boolean {
        val deadline = System.nanoTime() + timeoutSeconds * 1_000_000_000
        while (System.nanoTime() < deadline) {
            if (condition()) return true
            Thread.sleep(200)
        }
        return condition()
    }

    @Test
    fun `A の削除イベントをリレーすると subscriber が A の実行だけをキャンセルし、二重配信は冪等に吸収される`() {
        val familyA = createFamily("山田家", "太郎", "taro@example.com")
        val familyB = createFamily("鈴木家", "次郎", "jiro@example.com")
        enqueueDeletion(familyA)

        val handler = HandleTaskDefinitionDeletedUseCaseImpl(database, CompletedDomainEventRepositoryImpl(), executionRepository)
        // 実物の processor をそのまま使い、subscriber から返った結果だけを記録する(二重配信の到着を待つため)
        val results = CopyOnWriteArrayList<Pair<UUID, OutboxEventProcessor.Result>>()
        val recordingProcessor = object : OutboxEventProcessor(handler) {
            override fun process(eventId: UUID, eventType: String, tenantId: TenantId, payload: String): Result =
                super.process(eventId, eventType, tenantId, payload).also { results.add(eventId to it) }
        }
        val subscriber = DomainEventSubscriber(
            PubSubConfig(true, "e2e-project", "domain-events-e2e", "housework-backend-e2e", container.emulatorEndpoint),
            factory,
            recordingProcessor,
        )
        val relay = RelayOutboxEventsUseCaseImpl(databaseWithoutRLS, outboxRepository, factory)
        subscriber.start()
        try {
            assertEquals(1, relay.execute(RelayOutboxEventsUseCase.Input(batchSize = 10)).publishedCount)

            val cancelled = waitUntil(30) { statusOf(familyA) == "CANCELLED" }
            assertEquals(true, cancelled) { "A の実行がキャンセルされなかった: ${statusOf(familyA)}" }
            assertEquals("NOT_STARTED", statusOf(familyB))

            // 同じ outbox 行をもう一度 PENDING に戻してリレーする = 同じ eventId の二重配信
            PostgresTestDatabase.ownerDsl().execute("update outbox set status = 'PENDING'")
            assertEquals(1, relay.execute(RelayOutboxEventsUseCase.Input(batchSize = 10)).publishedCount)
            val redelivered = waitUntil(30) { results.size >= 2 }
            assertEquals(true, redelivered) { "二重配信が subscriber に届かなかった: $results" }
            assertEquals(
                listOf(OutboxEventProcessor.Result.Processed, OutboxEventProcessor.Result.AlreadyProcessed),
                results.map { it.second },
            )
            assertEquals(1, results.map { it.first }.distinct().size) { "同じ eventId の二重配信になっていない: $results" }

            val completed = PostgresTestDatabase.ownerDsl().select(COMPLETED_DOMAIN_EVENTS.TENANT_ID)
                .from(COMPLETED_DOMAIN_EVENTS).fetch(COMPLETED_DOMAIN_EVENTS.TENANT_ID)
            assertEquals(listOf(familyA.tenantId.value), completed)
            assertEquals("NOT_STARTED", statusOf(familyB))
        } finally {
            subscriber.stop()
            relay.close()
        }
    }
}

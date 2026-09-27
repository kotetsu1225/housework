package com.task.usecase.outbox

import com.google.cloud.pubsub.v1.AckReplyConsumer
import com.google.cloud.pubsub.v1.MessageReceiver
import com.google.cloud.pubsub.v1.Subscriber
import com.google.pubsub.v1.PubsubMessage
import com.task.domain.taskDefinition.ScheduledTimeRange
import com.task.domain.taskDefinition.TaskDefinitionDescription
import com.task.domain.taskDefinition.TaskDefinitionId
import com.task.domain.taskDefinition.TaskDefinitionName
import com.task.domain.taskDefinition.TaskSchedule
import com.task.domain.taskDefinition.TaskScope
import com.task.domain.taskDefinition.event.TaskDefinitionDeleted
import com.task.domain.tenant.TenantId
import com.task.infra.database.DatabaseWithoutRLS
import com.task.infra.database.jooq.tables.references.OUTBOX
import com.task.infra.database.jooq.tables.references.TENANTS
import com.task.infra.outbox.DomainEventSerializer
import com.task.infra.outbox.OutboxRecord
import com.task.infra.outbox.OutboxRepositoryImpl
import com.task.infra.outbox.OutboxStatus
import com.task.infra.pubsub.PubSubClientFactory
import com.task.infra.pubsub.PubSubConfig
import com.task.support.PostgresTestDatabase
import org.jooq.SQLDialect
import org.jooq.impl.DSL
import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.Test
import kotlinx.serialization.json.Json
import org.testcontainers.gcloud.PubSubEmulatorContainer
import java.time.Instant
import java.time.LocalDate
import java.util.UUID
import java.util.concurrent.CompletableFuture
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * issue #72の受け入れ条件を実DB(Testcontainers)とPub/Subエミュレータ(Testcontainers)で確かめる。
 *
 * 【前提】Dockerが必要。
 */
class RelayOutboxEventsTest {

    private val outboxRepository = OutboxRepositoryImpl()
    private val databaseWithoutRLS = DatabaseWithoutRLS(PostgresTestDatabase.ownerDataSource)

    @AfterEach
    fun cleanup() {
        PostgresTestDatabase.truncateAll()
    }

    private fun createTenant(familyName: String, email: String): TenantId {
        val owner = PostgresTestDatabase.ownerDsl()
        val tenantId = TenantId.generate()
        owner.insertInto(TENANTS)
            .set(TENANTS.ID, tenantId.value)
            .set(TENANTS.FAMILY_NAME, familyName)
            .set(TENANTS.EMAIL, email)
            .execute()
        return tenantId
    }

    /** issue #72のメッセージ契約で使う、実物のTaskDefinitionDeletedペイロード(JSON)を作る。 */
    private fun createTaskDefinitionDeletedPayload(): String {
        val event = TaskDefinitionDeleted(
            taskDefinitionId = TaskDefinitionId.generate(),
            name = TaskDefinitionName("皿洗い"),
            description = TaskDefinitionDescription("夕食後の皿洗い"),
            scheduledTimeRange = ScheduledTimeRange(
                startTime = Instant.parse("2026-01-01T10:00:00Z"),
                endTime = Instant.parse("2026-01-01T10:30:00Z"),
            ),
            scope = TaskScope.FAMILY,
            ownerMemberId = null,
            schedule = TaskSchedule.OneTime(deadline = LocalDate.of(2026, 1, 1)),
            occurredAt = Instant.parse("2026-01-01T09:00:00Z"),
        )
        return DomainEventSerializer.serialize(event)
    }

    private fun insertPendingOutboxRecord(
        tenantId: TenantId,
        payload: String = createTaskDefinitionDeletedPayload(),
        maxRetries: Int = 5,
    ): OutboxRecord {
        val record = OutboxRecord.create(
            tenantId = tenantId,
            eventType = "TaskDefinitionDeleted",
            aggregateType = "TaskDefinition",
            aggregateId = UUID.randomUUID(),
            payload = payload,
            maxRetries = maxRetries,
        )
        PostgresTestDatabase.inTenantTransaction(tenantId) { session ->
            outboxRepository.save(record, session)
        }
        return record
    }

    private fun findOutboxStatus(id: UUID): OutboxStatus {
        val status = PostgresTestDatabase.ownerDsl()
            .select(OUTBOX.STATUS).from(OUTBOX)
            .where(OUTBOX.ID.eq(id)).fetchOne(OUTBOX.STATUS)
        return OutboxStatus.valueOf(status!!)
    }

    private fun findOutboxRetryCount(id: UUID): Int {
        return PostgresTestDatabase.ownerDsl()
            .select(OUTBOX.RETRY_COUNT).from(OUTBOX)
            .where(OUTBOX.ID.eq(id)).fetchOne(OUTBOX.RETRY_COUNT)!!
    }

    @Test
    fun `PENDING行をリレーするとPub-Subにpublishされattributesが契約どおりでPUBLISHEDになる`() {
        val tenantId = createTenant("relay家", "relay@example.com")
        val payload = createTaskDefinitionDeletedPayload()
        val record = insertPendingOutboxRecord(tenantId, payload = payload)

        // subscription はテストクラスで共有しているので、他のテスト(SKIP LOCKED など)が publish した
        // メッセージが残っていることがある。このテストの eventId のメッセージだけを待ち、ほかは ack して捨てる。
        val expectedEventId = DomainEventSerializer.extractEventId(payload)
        val received = CompletableFuture<PubsubMessage>()
        val receiver = MessageReceiver { message: PubsubMessage, consumer: AckReplyConsumer ->
            if (message.attributesMap["eventId"] == expectedEventId.toString()) {
                received.complete(message)
            }
            consumer.ack()
        }
        val subscriber: Subscriber = emulatorFactory.createSubscriber(receiver)
            .also { it.startAsync().awaitRunning() }

        val relay = RelayOutboxEventsUseCaseImpl(databaseWithoutRLS, outboxRepository, emulatorFactory)
        try {
            val output = relay.execute(RelayOutboxEventsUseCase.Input(batchSize = 10))
            assertEquals(1, output.publishedCount)
            assertEquals(0, output.failedCount)

            val message = received.get(30, TimeUnit.SECONDS)
            // payload は JSONB 型で保存されるので、キーの順番と空白が正規化される。JSON として比較する。
            assertEquals(Json.parseToJsonElement(payload), Json.parseToJsonElement(message.data.toStringUtf8()))

            val expectedOccurredAt = DomainEventSerializer.extractOccurredAt(payload)
            assertEquals(expectedEventId.toString(), message.attributesMap["eventId"])
            assertEquals("TaskDefinitionDeleted", message.attributesMap["eventType"])
            assertEquals("TaskDefinition", message.attributesMap["aggregateType"])
            assertEquals(record.aggregateId.toString(), message.attributesMap["aggregateId"])
            assertEquals(tenantId.value.toString(), message.attributesMap["tenantId"])
            assertEquals(expectedOccurredAt, message.attributesMap["occurredAt"])
            assertEquals("1", message.attributesMap["schemaVersion"])
            assertEquals(7, message.attributesMap.size)

            assertEquals(OutboxStatus.PUBLISHED, findOutboxStatus(record.id))
        } finally {
            relay.close()
            subscriber.stopAsync()
            subscriber.awaitTerminated(30, TimeUnit.SECONDS)
        }
    }

    @Test
    fun `publishが失敗するとPENDINGのままretry_countが増え上限に達するとFAILEDになる`() {
        val tenantId = createTenant("失敗家", "fail@example.com")
        val record = insertPendingOutboxRecord(tenantId, maxRetries = 2)

        // 存在しないtopic/subscriptionを指す設定(ensureEmulatorResourcesを呼ばないので作られない)。
        // publisher.publish().get()がNOT_FOUNDで失敗することを利用してpublish失敗を再現する。
        val brokenConfig = PubSubConfig(
            enabled = true,
            projectId = "test-project",
            topicId = "domain-events-missing-topic",
            subscriptionId = "housework-backend-missing-sub",
            emulatorHost = container.emulatorEndpoint,
        )
        val brokenFactory = PubSubClientFactory(brokenConfig)
        val relay = RelayOutboxEventsUseCaseImpl(databaseWithoutRLS, outboxRepository, brokenFactory)
        try {
            val output1 = relay.execute(RelayOutboxEventsUseCase.Input(batchSize = 10))
            assertEquals(0, output1.publishedCount)
            assertEquals(1, output1.failedCount)
            assertEquals(OutboxStatus.PENDING, findOutboxStatus(record.id))
            assertEquals(1, findOutboxRetryCount(record.id))

            val output2 = relay.execute(RelayOutboxEventsUseCase.Input(batchSize = 10))
            assertEquals(0, output2.publishedCount)
            assertEquals(1, output2.failedCount)
            assertEquals(OutboxStatus.FAILED, findOutboxStatus(record.id))
            assertEquals(2, findOutboxRetryCount(record.id))
        } finally {
            relay.close()
            brokenFactory.close()
        }
    }

    @Test
    fun `SKIP LOCKEDにより別トランザクションがFOR UPDATEで握っている行はリレー対象から外れる`() {
        val tenantId = createTenant("ロック家", "lock@example.com")
        val record = insertPendingOutboxRecord(tenantId)

        val lockAcquired = CountDownLatch(1)
        val releaseLock = CountDownLatch(1)
        val holderFinished = CountDownLatch(1)

        val holderThread = Thread {
            PostgresTestDatabase.ownerDataSource.connection.use { connection ->
                connection.autoCommit = false
                try {
                    val dsl = DSL.using(connection, SQLDialect.POSTGRES)
                    dsl.selectFrom(OUTBOX)
                        .where(OUTBOX.ID.eq(record.id))
                        .forUpdate()
                        .fetch()
                    lockAcquired.countDown()
                    releaseLock.await(30, TimeUnit.SECONDS)
                } finally {
                    connection.rollback()
                    holderFinished.countDown()
                }
            }
        }
        holderThread.isDaemon = true
        holderThread.start()

        val relay = RelayOutboxEventsUseCaseImpl(databaseWithoutRLS, outboxRepository, emulatorFactory)
        try {
            assertTrue(lockAcquired.await(10, TimeUnit.SECONDS))

            val whileLocked = relay.execute(RelayOutboxEventsUseCase.Input(batchSize = 10))
            assertEquals(0, whileLocked.publishedCount)
            assertEquals(0, whileLocked.failedCount)
            assertEquals(OutboxStatus.PENDING, findOutboxStatus(record.id))

            releaseLock.countDown()
            assertTrue(holderFinished.await(10, TimeUnit.SECONDS))

            val afterRelease = relay.execute(RelayOutboxEventsUseCase.Input(batchSize = 10))
            assertEquals(1, afterRelease.publishedCount)
            assertEquals(OutboxStatus.PUBLISHED, findOutboxStatus(record.id))
        } finally {
            releaseLock.countDown()
            holderThread.join(5_000)
            relay.close()
        }
    }

    companion object {
        private const val EMULATOR_IMAGE = "gcr.io/google.com/cloudsdktool/google-cloud-cli:586.0.0-emulators"

        private lateinit var container: PubSubEmulatorContainer
        private lateinit var emulatorFactory: PubSubClientFactory

        @JvmStatic
        @BeforeAll
        fun startEmulator() {
            container = PubSubEmulatorContainer(EMULATOR_IMAGE).apply { start() }
            val config = PubSubConfig(
                enabled = true,
                projectId = "test-project",
                topicId = "domain-events",
                subscriptionId = "housework-backend",
                emulatorHost = container.emulatorEndpoint,
            )
            emulatorFactory = PubSubClientFactory(config)
            emulatorFactory.ensureEmulatorResources()
        }

        @JvmStatic
        @AfterAll
        fun stopEmulator() {
            emulatorFactory.close()
            container.stop()
        }
    }
}

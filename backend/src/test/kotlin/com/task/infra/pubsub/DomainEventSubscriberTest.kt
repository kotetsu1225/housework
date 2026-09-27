package com.task.infra.pubsub

import com.google.cloud.pubsub.v1.AckReplyConsumer
import com.google.protobuf.ByteString
import com.google.pubsub.v1.PubsubMessage
import com.task.domain.tenant.TenantId
import com.task.infra.outbox.OutboxMessageAttributes
import com.task.usecase.outbox.HandleTaskDefinitionDeletedUseCase
import com.task.usecase.outbox.OutboxEventProcessor
import org.jooq.DSLContext
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.util.UUID

/**
 * [DomainEventSubscriber.handleMessage]の単体テスト(issue #61)。Pub/Subエミュレータは使わず、
 * receiverのロジック(attributesの検証とack/nackの判断)だけを直接検証する。
 *
 * [OutboxEventProcessor]は実際のユースケースを呼ばないフェイク(サブクラス)を使う。
 * mockkによる最終(final)クラスのモックはこのリポジトリで実績が無いため避けた
 * ([OutboxEventProcessor]のKDoc「openにしている理由」参照)。
 */
class DomainEventSubscriberTest {

    private val pubSubConfig = PubSubConfig(
        enabled = true,
        projectId = "test-project",
        topicId = "domain-events",
        subscriptionId = "housework-backend",
        emulatorHost = null,
    )

    // handleMessage()自体は start()/stop() を経由しないためネットワークに繋がず、
    // このfactoryは(未使用の)コンストラクタ引数としてのみ必要。
    private val pubSubClientFactory = PubSubClientFactory(pubSubConfig)

    /** [HandleTaskDefinitionDeletedUseCase]は呼ばれない前提のダミー(フェイクprocessorがprocessを完全に差し替えるため)。 */
    private val dummyHandler = object : HandleTaskDefinitionDeletedUseCase {
        override fun execute(
            input: HandleTaskDefinitionDeletedUseCase.Input,
        ): HandleTaskDefinitionDeletedUseCase.Output = throw NotImplementedError("呼ばれない想定")

        override fun executeInSession(
            input: HandleTaskDefinitionDeletedUseCase.Input,
            session: DSLContext,
        ): HandleTaskDefinitionDeletedUseCase.Output = throw NotImplementedError("呼ばれない想定")
    }

    /** [OutboxEventProcessor.process]を[behavior]で完全に差し替えるフェイク。呼び出し回数も記録する。 */
    private class FakeOutboxEventProcessor(
        handleTaskDefinitionDeletedUseCase: HandleTaskDefinitionDeletedUseCase,
        private val behavior: (UUID, String, TenantId, String) -> OutboxEventProcessor.Result,
    ) : OutboxEventProcessor(handleTaskDefinitionDeletedUseCase) {
        var callCount = 0
            private set

        override fun process(
            eventId: UUID,
            eventType: String,
            tenantId: TenantId,
            payload: String,
        ): OutboxEventProcessor.Result {
            callCount++
            return behavior(eventId, eventType, tenantId, payload)
        }
    }

    private class FakeAckReplyConsumer : AckReplyConsumer {
        var acked = false
            private set
        var nacked = false
            private set

        override fun ack() {
            acked = true
        }

        override fun nack() {
            nacked = true
        }
    }

    private fun buildMessage(
        eventId: UUID = UUID.randomUUID(),
        eventType: String? = "TaskDefinitionDeleted",
        tenantId: TenantId? = TenantId.generate(),
        payload: String = "{}",
    ): PubsubMessage {
        val builder = PubsubMessage.newBuilder()
            .setData(ByteString.copyFromUtf8(payload))
            .putAttributes(OutboxMessageAttributes.EVENT_ID, eventId.toString())
        eventType?.let { builder.putAttributes(OutboxMessageAttributes.EVENT_TYPE, it) }
        tenantId?.let { builder.putAttributes(OutboxMessageAttributes.TENANT_ID, it.value.toString()) }
        return builder.build()
    }

    @Test
    fun `processorが成功を返せばackする`() {
        val processor = FakeOutboxEventProcessor(dummyHandler) { _, _, _, _ -> OutboxEventProcessor.Result.Processed }
        val subscriber = DomainEventSubscriber(pubSubConfig, pubSubClientFactory, processor)
        val consumer = FakeAckReplyConsumer()

        subscriber.handleMessage(buildMessage(), consumer)

        assertTrue(consumer.acked)
        assertFalse(consumer.nacked)
        assertEquals(1, processor.callCount)
    }

    @Test
    fun `tenantId属性が無いとnackしprocessorは呼ばれない`() {
        val processor = FakeOutboxEventProcessor(dummyHandler) { _, _, _, _ -> OutboxEventProcessor.Result.Processed }
        val subscriber = DomainEventSubscriber(pubSubConfig, pubSubClientFactory, processor)
        val consumer = FakeAckReplyConsumer()

        subscriber.handleMessage(buildMessage(tenantId = null), consumer)

        assertTrue(consumer.nacked)
        assertFalse(consumer.acked)
        assertEquals(0, processor.callCount)
    }

    @Test
    fun `未知のeventTypeはnackする`() {
        val processor = FakeOutboxEventProcessor(dummyHandler) { _, _, _, _ ->
            OutboxEventProcessor.Result.UnknownEventType
        }
        val subscriber = DomainEventSubscriber(pubSubConfig, pubSubClientFactory, processor)
        val consumer = FakeAckReplyConsumer()

        subscriber.handleMessage(buildMessage(eventType = "SomeFutureEvent"), consumer)

        assertTrue(consumer.nacked)
        assertFalse(consumer.acked)
    }

    @Test
    fun `1回目だけ例外を投げるprocessorは1回目nack、同じメッセージの2回目はack`() {
        var attempts = 0
        val processor = FakeOutboxEventProcessor(dummyHandler) { _, _, _, _ ->
            attempts++
            if (attempts == 1) {
                throw RuntimeException("処理失敗(1回目)")
            }
            OutboxEventProcessor.Result.Processed
        }
        val subscriber = DomainEventSubscriber(pubSubConfig, pubSubClientFactory, processor)
        // Pub/Subの再配信を模して、同じメッセージをもう一度渡す
        val message = buildMessage()

        val firstConsumer = FakeAckReplyConsumer()
        subscriber.handleMessage(message, firstConsumer)
        assertTrue(firstConsumer.nacked)
        assertFalse(firstConsumer.acked)

        val secondConsumer = FakeAckReplyConsumer()
        subscriber.handleMessage(message, secondConsumer)
        assertTrue(secondConsumer.acked)
        assertFalse(secondConsumer.nacked)
        assertEquals(2, processor.callCount)
    }
}

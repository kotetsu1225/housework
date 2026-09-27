package com.task.infra.pubsub

import com.google.cloud.pubsub.v1.AckReplyConsumer
import com.google.cloud.pubsub.v1.MessageReceiver
import com.google.cloud.pubsub.v1.Publisher
import com.google.cloud.pubsub.v1.Subscriber
import com.google.protobuf.ByteString
import com.google.pubsub.v1.PubsubMessage
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertDoesNotThrow
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.testcontainers.gcloud.PubSubEmulatorContainer
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit

/**
 * issue #71の受け入れ条件（「publish → pullで受け取れる」）を、
 * Testcontainersのエミュレータで確かめる。
 *
 * 【前提】Dockerが必要。docker-compose.ymlのpubsub-emulatorサービスと
 * 同じイメージ（gcr.io/google.com/cloudsdktool/google-cloud-cli:586.0.0-emulators）を
 * 使うことで、本番運用のエミュレータとの差異を減らす。
 */
class PubSubClientFactoryTest {

    private lateinit var container: PubSubEmulatorContainer
    private lateinit var factory: PubSubClientFactory
    private var subscriber: Subscriber? = null
    private var publisher: Publisher? = null

    @BeforeEach
    fun setUp() {
        container = PubSubEmulatorContainer(EMULATOR_IMAGE).apply { start() }
        val config = PubSubConfig(
            enabled = true,
            projectId = "test-project",
            topicId = "domain-events",
            subscriptionId = "housework-backend",
            emulatorHost = container.emulatorEndpoint,
        )
        factory = PubSubClientFactory(config)
    }

    @AfterEach
    fun tearDown() {
        subscriber?.let {
            it.stopAsync()
            it.awaitTerminated(30, TimeUnit.SECONDS)
        }
        publisher?.let {
            it.shutdown()
            it.awaitTermination(30, TimeUnit.SECONDS)
        }
        factory.close()
        container.stop()
    }

    @Test
    fun `publishしたメッセージをsubscribeで受け取れる(dataとattributeが一致する)`() {
        factory.ensureEmulatorResources()

        val received = CompletableFuture<PubsubMessage>()
        val receiver = MessageReceiver { message: PubsubMessage, consumer: AckReplyConsumer ->
            received.complete(message)
            consumer.ack()
        }
        subscriber = factory.createSubscriber(receiver).also { it.startAsync().awaitRunning() }

        publisher = factory.createPublisher()
        val message = PubsubMessage.newBuilder()
            .setData(ByteString.copyFromUtf8("hello"))
            .putAttributes("eventType", "TaskDefinitionCreated")
            .build()
        // publishはApiFuture<String>（メッセージID）を返す。getで完了を待つ
        publisher!!.publish(message).get(30, TimeUnit.SECONDS)

        val result = received.get(30, TimeUnit.SECONDS)
        assertEquals("hello", result.data.toStringUtf8())
        assertEquals("TaskDefinitionCreated", result.attributesMap["eventType"])
    }

    @Test
    fun `ensureEmulatorResourcesを2回呼んでも例外にならない(AlreadyExistsExceptionを無視する)`() {
        assertDoesNotThrow {
            factory.ensureEmulatorResources()
            factory.ensureEmulatorResources()
        }
    }

    companion object {
        private const val EMULATOR_IMAGE = "gcr.io/google.com/cloudsdktool/google-cloud-cli:586.0.0-emulators"
    }
}

package com.task.usecase.outbox

import com.google.cloud.pubsub.v1.Publisher
import com.google.inject.Inject
import com.google.inject.Singleton
import com.google.protobuf.ByteString
import com.google.pubsub.v1.PubsubMessage
import com.task.infra.database.DatabaseWithoutRLS
import com.task.infra.outbox.DomainEventSerializer
import com.task.infra.outbox.OutboxMessageAttributes
import com.task.infra.outbox.OutboxRecord
import com.task.infra.outbox.OutboxRepository
import com.task.infra.pubsub.PubSubClientFactory
import org.slf4j.LoggerFactory
import java.util.concurrent.TimeUnit

/**
 * outboxの`PENDING`行をPub/Subへpublishし、`PUBLISHED`に更新するリレー(issue #72)。
 *
 * 【旧`ProcessOutboxEventsUseCaseImpl`との違い】
 * 旧実装はoutboxをポーリングしてその場でイベントを処理していた(Polling Publisherとコンシューマが
 * 一体)。このクラスはpublishするだけで、実際の処理はsubscriber側(issue #61)に委ねる。
 * `pubsub.enabled = false`のときはこのクラスを使わず、旧実装(`ProcessOutboxEventsUseCaseImpl`)が
 * そのまま動く(呼び分けは[com.task.scheduler.OutboxEventProcessorScheduler]が行う)。
 *
 * 【DB更新の順序について(at-least-once配信の要)】
 * 必ず「publish成功の確認 → DB更新」の順で行う。逆順(先に`PUBLISHED`にしてからpublish)だと、
 * publish前にプロセスが落ちた場合にイベントがそのまま失われる。この順序では代わりに、
 * publishには成功したがDB更新前に落ちた場合に同じ行が次回のポーリングでまた拾われ
 * 二重publishが起こり得るが、それはsubscriber側の`completed_domain_events`による
 * 冪等判定で吸収する前提(issue #72の受け入れ条件、issue #61)。
 *
 * 【RLSをバイパスする理由】
 * このリレーは全テナントを横断してPENDING行を読む必要があるため、tenantスコープの
 * `Database`ではなく[DatabaseWithoutRLS](オーナー接続)を使う
 * ([DatabaseWithoutRLS]の許可リスト「outboxリレー」、issue #72)。
 *
 * 【Publisherを使い回す理由】
 * [PubSubClientFactory.createPublisher]はチャネル確立などの初期化コストがあるため、
 * `execute`のたびに作らずフィールドに1つだけ保持する。アプリ終了時は[close]でshutdownすること。
 */
@Singleton
class RelayOutboxEventsUseCaseImpl @Inject constructor(
    private val databaseWithoutRLS: DatabaseWithoutRLS,
    private val outboxRepository: OutboxRepository,
    private val pubSubClientFactory: PubSubClientFactory,
) : RelayOutboxEventsUseCase, AutoCloseable {

    private val logger = LoggerFactory.getLogger(this::class.java)

    private val publisherLazy: Lazy<Publisher> = lazy { pubSubClientFactory.createPublisher() }
    private val publisher: Publisher get() = publisherLazy.value

    override fun execute(input: RelayOutboxEventsUseCase.Input): RelayOutboxEventsUseCase.Output {
        var publishedCount = 0
        var failedCount = 0

        // outboxのリレーは全テナントのPENDING行を横断して読むためRLSをバイパスする
        // (DatabaseWithoutRLSの許可リスト「outboxリレー」、issue #72)。
        databaseWithoutRLS.withTransaction { session ->
            val pendingRecords = outboxRepository.findPendingForUpdateSkipLocked(session, input.batchSize)
            logger.info("Found ${pendingRecords.size} pending outbox events to relay")

            pendingRecords.forEach { record ->
                try {
                    // publishの成功を確認してからDBを更新する(逆順だとイベントが欠落するため)。
                    // 二重publish自体はsubscriber側の冪等判定で吸収する(クラスKDoc参照)。
                    publisher.publish(buildMessage(record))
                        .get(PUBLISH_TIMEOUT_SECONDS, TimeUnit.SECONDS)
                    outboxRepository.update(record.markAsPublished(), session)
                    publishedCount++
                } catch (e: Exception) {
                    logger.error("Failed to publish outbox event: ${record.id}", e)
                    outboxRepository.update(record.incrementRetry(e.message ?: "Unknown error"), session)
                    failedCount++
                }
            }
        }

        return RelayOutboxEventsUseCase.Output(
            publishedCount = publishedCount,
            failedCount = failedCount
        )
    }

    /**
     * ファクトリから作ったPublisherをshutdownする。アプリ終了時に呼ぶこと。
     * 一度も[execute]が呼ばれておらずPublisherが未生成の場合は何もしない。
     */
    override fun close() {
        if (publisherLazy.isInitialized()) {
            publisher.shutdown()
            publisher.awaitTermination(CLOSE_TIMEOUT_SECONDS, TimeUnit.SECONDS)
        }
    }

    /**
     * outbox 1行分をPub/Subのメッセージに変換する
     * (メッセージ契約はissue #34「Pub/Sub共通契約」・issue #72参照)。
     * orderingキーは付けない(subscription側でordering無効のため、issue #71)。
     */
    private fun buildMessage(record: OutboxRecord): PubsubMessage {
        val eventId = DomainEventSerializer.extractEventId(record.payload)
        // occurredAtはpayloadにあればそれを使い、無ければoutbox行のcreated_at(ISO-8601)で代替する。
        val occurredAt = DomainEventSerializer.extractOccurredAt(record.payload)
            ?: record.createdAt.toString()

        return PubsubMessage.newBuilder()
            .setData(ByteString.copyFromUtf8(record.payload))
            .putAttributes(OutboxMessageAttributes.EVENT_ID, eventId.toString())
            .putAttributes(OutboxMessageAttributes.EVENT_TYPE, record.eventType)
            .putAttributes(OutboxMessageAttributes.AGGREGATE_TYPE, record.aggregateType)
            .putAttributes(OutboxMessageAttributes.AGGREGATE_ID, record.aggregateId.toString())
            .putAttributes(OutboxMessageAttributes.TENANT_ID, record.tenantId.value.toString())
            .putAttributes(OutboxMessageAttributes.OCCURRED_AT, occurredAt)
            .putAttributes(OutboxMessageAttributes.SCHEMA_VERSION, OutboxMessageAttributes.CURRENT_SCHEMA_VERSION)
            .build()
    }

    companion object {
        private const val PUBLISH_TIMEOUT_SECONDS = 10L
        private const val CLOSE_TIMEOUT_SECONDS = 30L

    }
}

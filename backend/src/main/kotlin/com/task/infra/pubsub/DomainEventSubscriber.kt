package com.task.infra.pubsub

import com.google.cloud.pubsub.v1.AckReplyConsumer
import com.google.cloud.pubsub.v1.MessageReceiver
import com.google.cloud.pubsub.v1.Subscriber
import com.google.inject.Inject
import com.google.inject.Singleton
import com.google.pubsub.v1.PubsubMessage
import com.task.domain.tenant.TenantId
import com.task.infra.outbox.OutboxMessageAttributes
import com.task.usecase.outbox.OutboxEventProcessor
import org.slf4j.LoggerFactory
import java.util.UUID
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException

/**
 * outboxのイベントをPub/Subのstreaming pullで受け取り、tenantスコープで処理するsubscriber
 * (issue #61)。Ktorアプリと同一プロセス内でpullする(公開エンドポイント不要、Railwayのまま動く)。
 *
 * publish側(#72のリレー)からは[OutboxMessageAttributes]で定義された`eventId` / `eventType` /
 * `tenantId`のmessage attributeが必ず付与されている前提。実際の処理は[OutboxEventProcessor]に
 * 委譲し、このクラス自身はack/nackの判断だけを持つ薄いレイヤーにする。
 *
 * 【1イベント = 1トランザクション、失敗の扱い】
 * 配信はat-least-onceであり、[OutboxEventProcessor]の先の`HandleTaskDefinitionDeletedUseCase`が
 * `completed_domain_events`による冪等判定を行う。処理中の例外はnackし、Pub/Subの再試行に任せる
 * (最大5回、上限を超えるとdead-letter topicへ、issue #70)。1件の失敗が他イベント(他テナント)の
 * 処理をブロックしないよう、失敗はそのメッセージのnackだけにとどめる。
 *
 * 【属性欠落・UUID形式でない場合にnackする理由】
 * 「ackもnackもしない(何もしない)」案も検討したが採らなかった。何もしないとack期限
 * (現在60秒、[PubSubClientFactory.createSubscriber]参照)が切れるまでメッセージが宙に浮き、
 * 再配信までの遅延が生じるうえ、期限切れによる再配信の扱いはPub/Subクライアントライブラリの
 * 内部実装に依存し「配信試行回数」として確実にカウントされる保証がない。明示的にnackすることで
 * 即座に再配信をトリガーし、確実に配信試行回数を進める。属性欠落は再試行しても直らない
 * (publish側のバグの可能性が高い)が、ackして握りつぶすとデータ欠落に誰も気づけないため、
 * nackを繰り返させて最終的にdead-letter topicに落とし、可視化する(issue #61)。
 *
 * 【未知のeventTypeも同様にnackする理由】
 * サイレントに消さない(#11の指摘)。dead-letter topicに落として気づけるようにする。
 *
 * @param pubSubConfig `enabled`を見て、無効時に誤って[start]しないようにするための設定
 * @param pubSubClientFactory [Subscriber]の組み立てに使うファクトリ(issue #71)
 * @param outboxEventProcessor イベント種別ごとの処理の振り分け先(issue #61)
 */
@Singleton
class DomainEventSubscriber @Inject constructor(
    private val pubSubConfig: PubSubConfig,
    private val pubSubClientFactory: PubSubClientFactory,
    private val outboxEventProcessor: OutboxEventProcessor,
) {

    private val logger = LoggerFactory.getLogger(this::class.java)

    private var subscriber: Subscriber? = null

    /**
     * streaming pullを開始する。`pubsub.enabled = false`のときは呼ばないこと
     * (呼ぶと[IllegalStateException]、[PubSubClientFactory.createSubscriber]参照)。
     */
    fun start() {
        check(pubSubConfig.enabled) { "pubsub.enabled = false のため start() を呼び出せません" }
        val receiver = MessageReceiver { message, consumer -> handleMessage(message, consumer) }
        subscriber = pubSubClientFactory.createSubscriber(receiver).also {
            it.startAsync().awaitRunning()
        }
        logger.info("DomainEventSubscriberを起動しました(subscription=${pubSubConfig.subscriptionId})")
    }

    /**
     * streaming pullを停止する。[start]を呼んでいない場合は何もしない。
     * ack/nackされないまま停止した処理中メッセージは、ack期限切れ後にPub/Subが再配信する
     * (受け入れ条件: 「処理中のメッセージがackされないまま残らない(再配信される)」)。
     */
    fun stop() {
        val current = subscriber ?: return
        current.stopAsync()
        try {
            current.awaitTerminated(STOP_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            logger.info("DomainEventSubscriberを停止しました")
        } catch (e: TimeoutException) {
            // ここで例外を投げると、Application.kt の停止処理で後に続く Publisher / チャネルの close が飛ばされるため握る。
            // ack されていない処理中メッセージは、ack 期限切れ後に Pub/Sub が再配信する。
            logger.warn("DomainEventSubscriberの停止が${STOP_TIMEOUT_SECONDS}秒以内に終わりませんでした", e)
        }
    }

    /**
     * 受信したメッセージを処理し、ack/nackを判断する。
     * テストから直接呼べるように`internal`にしている(単体テストではエミュレータを使わない)。
     */
    internal fun handleMessage(message: PubsubMessage, consumer: AckReplyConsumer) {
        val attributes = message.attributesMap
        val eventIdRaw = attributes[OutboxMessageAttributes.EVENT_ID]
        val eventType = attributes[OutboxMessageAttributes.EVENT_TYPE]
        val tenantIdRaw = attributes[OutboxMessageAttributes.TENANT_ID]

        if (eventIdRaw == null || eventType == null || tenantIdRaw == null) {
            logger.error(
                "必須のmessage attributeが欠落しています: eventId=$eventIdRaw, eventType=$eventType, " +
                    "tenantId=$tenantIdRaw"
            )
            consumer.nack()
            return
        }

        val eventId = try {
            UUID.fromString(eventIdRaw)
        } catch (e: IllegalArgumentException) {
            logger.error("eventId属性がUUID形式ではありません: $eventIdRaw", e)
            consumer.nack()
            return
        }

        val tenantId = try {
            TenantId.from(tenantIdRaw)
        } catch (e: IllegalArgumentException) {
            logger.error("tenantId属性がUUID形式ではありません: $tenantIdRaw", e)
            consumer.nack()
            return
        }

        val payload = message.data.toStringUtf8()

        try {
            when (outboxEventProcessor.process(eventId, eventType, tenantId, payload)) {
                OutboxEventProcessor.Result.Processed,
                OutboxEventProcessor.Result.AlreadyProcessed -> consumer.ack()

                OutboxEventProcessor.Result.UnknownEventType -> {
                    logger.error(
                        "未知のeventTypeです(dead letterへ委ねます): eventId=$eventId, " +
                            "tenantId=${tenantId.value}, eventType=$eventType"
                    )
                    consumer.nack()
                }
            }
        } catch (e: Exception) {
            logger.error("イベント処理に失敗しました: eventId=$eventId, tenantId=${tenantId.value}", e)
            consumer.nack()
        }
    }

    companion object {
        private const val STOP_TIMEOUT_SECONDS = 30L
    }
}

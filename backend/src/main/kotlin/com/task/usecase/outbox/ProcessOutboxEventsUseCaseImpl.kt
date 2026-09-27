package com.task.usecase.outbox

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.infra.database.Database
import com.task.infra.database.DatabaseWithoutRLS
import com.task.infra.outbox.DomainEventSerializer
import com.task.infra.outbox.OutboxRecord
import com.task.infra.outbox.OutboxRepository
import org.slf4j.LoggerFactory

/**
 * outboxの`PENDING`行をアプリ内でその場処理するユースケース。`pubsub.enabled = false`のときだけ
 * [com.task.scheduler.OutboxEventProcessorScheduler]から呼ばれる(`true`のときは
 * [RelayOutboxEventsUseCaseImpl]がPub/Subへpublishし、実処理は
 * [com.task.infra.pubsub.DomainEventSubscriber]側で行う、issue #61/#72)。
 *
 * issue #61でイベント処理の中身(`TaskDefinitionDeleted`のキャンセルロジック等)を
 * [HandleTaskDefinitionDeletedUseCase] / [OutboxEventProcessor] に切り出したため、
 * このクラスはoutboxのポーリングと、処理結果に応じたoutbox行の更新だけを担う薄い層になった。
 *
 * 【PENDING取得に[DatabaseWithoutRLS]を使う理由】
 * outboxのポーリングは全テナントのPENDING行を横断して読む必要があるため、tenantスコープの
 * [Database]ではなく[DatabaseWithoutRLS](オーナー接続)を使う。これは[DatabaseWithoutRLS]の
 * 許可リストにある「outboxリレー」(issue #72)と同じ位置づけ(issue #61)。
 * 取得は`withSession`(トランザクションなし)にとどめ、[OutboxRepository.findPendingForUpdateSkipLocked]
 * は使わない(このモードは`pubsub.enabled = false`のローカル/開発運用専用で複数プロセス同時実行を
 * 想定しておらず、リレー側[RelayOutboxEventsUseCaseImpl]のような排他制御は不要なため)。
 *
 * 【処理とoutbox更新を同じトランザクションにする理由】
 * `PROCESSED`への更新を、実際の処理([OutboxEventProcessor.processInSession])と同じ
 * tenantスコープのトランザクション([Database.withTransaction])の中で行う。V24のRLSにより
 * 自テナントの行として`outbox`をSELECT/UPDATEできるため、tenantスコープのままで完結する。
 * こうすることで「処理はできたがoutbox更新に失敗し再度処理されてしまう」といった不整合を防ぐ。
 *
 * 【未知のeventTypeの扱い】
 * [OutboxEventProcessor.Result.UnknownEventType]の場合はPROCESSEDにせず、例外を投げて
 * `incrementRetry`に倒す(#11: サイレントに消さない。上限に達すればFAILEDになる)。
 *
 * 【失敗時に[DatabaseWithoutRLS]で`incrementRetry`する理由】
 * 処理中の例外はtenantスコープのトランザクションをロールバックさせるため、そのセッションでは
 * もはやoutbox行を更新できない。ロールバック後に改めてオーナー接続で`incrementRetry`する
 * (`database.withTransaction()`/`withSession()`の互換パスは使わない。#65で削除予定のため)。
 */
@Singleton
class ProcessOutboxEventsUseCaseImpl @Inject constructor(
    private val database: Database,
    private val databaseWithoutRLS: DatabaseWithoutRLS,
    private val outboxRepository: OutboxRepository,
    private val outboxEventProcessor: OutboxEventProcessor,
) : ProcessOutboxEventsUseCase {

    private val logger = LoggerFactory.getLogger(this::class.java)

    override fun execute(input: ProcessOutboxEventsUseCase.Input): ProcessOutboxEventsUseCase.Output {
        var processedCount = 0
        var failedCount = 0

        // DatabaseWithoutRLS の理由: pubsub 無効時の outbox ポーリングは全テナントの PENDING を横断して読む
        // (許可リスト「outbox リレー / ポーリング」、#72 #61)。取得だけで、処理は各テナントのトランザクションで行う。
        val pendingRecords = databaseWithoutRLS.withSession { session ->
            outboxRepository.findPending(session, input.batchSize)
        }

        logger.info("Found ${pendingRecords.size} pending outbox events")

        pendingRecords.forEach { record ->
            try {
                processEvent(record)
                processedCount++
            } catch (e: Exception) {
                logger.error("Failed to process outbox event: ${record.id}", e)
                markAsFailed(record, e.message ?: "Unknown error")
                failedCount++
            }
        }

        return ProcessOutboxEventsUseCase.Output(
            processedCount = processedCount,
            failedCount = failedCount
        )
    }

    private fun processEvent(record: OutboxRecord) {
        val eventId = DomainEventSerializer.extractEventId(record.payload)

        database.withTransaction(record.tenantId) { session ->
            val result = outboxEventProcessor.processInSession(
                eventId = eventId,
                eventType = record.eventType,
                tenantId = record.tenantId,
                payload = record.payload,
                session = session,
            )

            when (result) {
                OutboxEventProcessor.Result.Processed,
                OutboxEventProcessor.Result.AlreadyProcessed -> {
                    outboxRepository.update(record.markAsProcessed(), session)
                }

                OutboxEventProcessor.Result.UnknownEventType -> {
                    // PROCESSEDにせず例外にして incrementRetry に倒す(#11: サイレントに消さない)。
                    throw UnknownEventTypeException(record.eventType)
                }
            }
        }
    }

    private fun markAsFailed(record: OutboxRecord, errorMessage: String) {
        // DatabaseWithoutRLS の理由: 失敗した行の retry 記録。tenant スコープのトランザクションは失敗でロールバック済みなので、
        // outbox の行だけをオーナー接続で更新する(許可リスト「outbox リレー / ポーリング」、#72 #61)。
        databaseWithoutRLS.withTransaction { session ->
            outboxRepository.update(record.incrementRetry(errorMessage), session)
        }
    }

    /** 未知の`eventType`を[processEvent]から[execute]のcatchへ伝え、`incrementRetry`に倒すための例外。 */
    private class UnknownEventTypeException(eventType: String) : Exception("Unknown event type: $eventType")
}

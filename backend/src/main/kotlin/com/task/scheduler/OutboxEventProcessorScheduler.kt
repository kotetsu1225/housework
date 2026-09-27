package com.task.scheduler

import com.task.infra.pubsub.PubSubConfig
import com.task.usecase.outbox.ProcessOutboxEventsUseCase
import com.task.usecase.outbox.RelayOutboxEventsUseCase
import java.time.LocalDateTime

/**
 * outboxの定期処理をキックするスケジューラー(10秒間隔)。
 *
 * issue #72: `pubsub.enabled`に応じて2つのモードを呼び分ける。
 * - `true`: [RelayOutboxEventsUseCase]でPENDINGをPub/Subへpublishするだけのリレー方式
 *   (実際の処理はsubscriber側、issue #61)。
 * - `false`: 旧方式の[ProcessOutboxEventsUseCase](アプリ内でその場処理する方式)のまま。
 */
class OutboxEventProcessorScheduler(
    private val pubSubConfig: PubSubConfig,
    private val relayOutboxEventsUseCase: RelayOutboxEventsUseCase,
    private val processOutboxEventsUseCase: ProcessOutboxEventsUseCase,
    private val intervalSeconds: Long = 10
) : BaseScheduler() {

    override val taskName: String = "outbox event processing"

    override fun calculateNextRunTime(now: LocalDateTime): LocalDateTime {
        return now.plusSeconds(intervalSeconds)
    }

    override fun executeTask(): String {
        return if (pubSubConfig.enabled) {
            val output = relayOutboxEventsUseCase.execute(
                RelayOutboxEventsUseCase.Input(batchSize = 100)
            )
            "[relay mode] Published ${output.publishedCount} event(s), failed ${output.failedCount}"
        } else {
            val output = processOutboxEventsUseCase.execute(
                ProcessOutboxEventsUseCase.Input(batchSize = 100)
            )
            "[in-process mode] Processed ${output.processedCount} event(s), failed ${output.failedCount}"
        }
    }
}

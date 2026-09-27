package com.task.usecase.outbox

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.tenant.TenantId
import org.jooq.DSLContext
import org.slf4j.LoggerFactory
import java.util.UUID

/**
 * outboxの`eventType`に応じて処理を振り分ける窓口(issue #61)。
 * subscriber([com.task.infra.pubsub.DomainEventSubscriber])とアプリ内処理モード
 * ([ProcessOutboxEventsUseCaseImpl])の両方がこのクラスを経由することで、
 * イベント種別ごとの分岐ロジックを1箇所にまとめる。
 *
 * 【openにしている理由】
 * [com.task.infra.pubsub.DomainEventSubscriber]の単体テストでは、ack/nackの判断ロジックだけを
 * 検証したいため、実際のユースケースを呼ばないフェイクをサブクラスとして用意できるようにする。
 * mockkによる最終(final)クラスのモックはこのリポジトリで実績が無く、JDK21下でのモックエージェント
 * のself-attach設定も未検証のため、確実に動く手段としてopen化を選んだ(判断、issue #61)。
 *
 * 【[process]と[processInSession]の使い分け】
 * - [process]: 呼び出し側がtenantスコープのトランザクションを持たない(subscriber)。
 *   ハンドラが自前でトランザクションを開く([HandleTaskDefinitionDeletedUseCase.execute])。
 * - [processInSession]: 呼び出し側が既にtenantスコープの`session`を開いている
 *   (アプリ内処理モード。outbox行の更新と同じトランザクションにしたいため、
 *   [HandleTaskDefinitionDeletedUseCase.executeInSession])。
 */
@Singleton
open class OutboxEventProcessor @Inject constructor(
    private val handleTaskDefinitionDeletedUseCase: HandleTaskDefinitionDeletedUseCase,
) {

    private val logger = LoggerFactory.getLogger(this::class.java)

    sealed class Result {
        /** 初めて処理した */
        data object Processed : Result()

        /** 既に処理済みだったため何もしなかった(冪等) */
        data object AlreadyProcessed : Result()

        /** 未知のeventType。呼び出し側は例外にする/ack しない等、消さない扱いにすること(#11) */
        data object UnknownEventType : Result()
    }

    open fun process(eventId: UUID, eventType: String, tenantId: TenantId, payload: String): Result {
        return when (eventType) {
            EVENT_TYPE_TASK_DEFINITION_DELETED -> {
                val output = handleTaskDefinitionDeletedUseCase.execute(
                    HandleTaskDefinitionDeletedUseCase.Input(eventId, tenantId, payload)
                )
                output.outcome.toResult()
            }

            else -> {
                logger.warn("Unknown event type: $eventType")
                Result.UnknownEventType
            }
        }
    }

    open fun processInSession(
        eventId: UUID,
        eventType: String,
        tenantId: TenantId,
        payload: String,
        session: DSLContext,
    ): Result {
        return when (eventType) {
            EVENT_TYPE_TASK_DEFINITION_DELETED -> {
                val output = handleTaskDefinitionDeletedUseCase.executeInSession(
                    HandleTaskDefinitionDeletedUseCase.Input(eventId, tenantId, payload),
                    session,
                )
                output.outcome.toResult()
            }

            else -> {
                logger.warn("Unknown event type: $eventType")
                Result.UnknownEventType
            }
        }
    }

    private fun HandleTaskDefinitionDeletedUseCase.Outcome.toResult(): Result = when (this) {
        HandleTaskDefinitionDeletedUseCase.Outcome.PROCESSED -> Result.Processed
        HandleTaskDefinitionDeletedUseCase.Outcome.ALREADY_PROCESSED -> Result.AlreadyProcessed
    }

    companion object {
        private const val EVENT_TYPE_TASK_DEFINITION_DELETED = "TaskDefinitionDeleted"
    }
}

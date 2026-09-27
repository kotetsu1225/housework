package com.task.usecase.outbox

import com.task.domain.tenant.TenantId
import org.jooq.DSLContext
import java.util.UUID

/**
 * `TaskDefinitionDeleted`イベントを処理し、対象定義に紐づく`TaskExecution`をキャンセルする
 * ユースケース(issue #61)。
 *
 * 旧`ProcessOutboxEventsUseCaseImpl.processTaskDefinitionDeleted`にあった処理本体をここに
 * 切り出した。subscriber([com.task.infra.pubsub.DomainEventSubscriber])とアプリ内処理モード
 * ([ProcessOutboxEventsUseCaseImpl])の両方から、[OutboxEventProcessor]経由で呼ばれる。
 *
 * 【[execute]と[executeInSession]の使い分け】
 * - [execute]: 自前でtenantスコープのトランザクションを開いて処理する。呼び出し側がまだ
 *   トランザクションを持っていない場合に使う(subscriber経由、[OutboxEventProcessor.process])。
 * - [executeInSession]: 呼び出し側が既に開いているtenantスコープの`session`の中で処理する。
 *   outbox行の更新([com.task.infra.outbox.OutboxRepository.update])と同じトランザクションに
 *   したい場合に使う(アプリ内処理モード、[ProcessOutboxEventsUseCaseImpl]経由、
 *   [OutboxEventProcessor.processInSession])。[execute]は内部でこのメソッドを呼ぶ。
 *
 * 【冪等性】
 * [com.task.infra.outbox.CompletedDomainEventRepository]による`event_id`存在チェックで、
 * 同じイベントを2回処理しても2回目は何もしない(at-least-once配信が前提、issue #61)。
 */
interface HandleTaskDefinitionDeletedUseCase {

    enum class Outcome {
        /** 初めて処理し、対象のTaskExecutionをキャンセルした */
        PROCESSED,

        /** 既に処理済み(`completed_domain_events`に存在)だったため何もしなかった */
        ALREADY_PROCESSED,
    }

    data class Input(
        val eventId: UUID,
        val tenantId: TenantId,
        val payload: String,
    )

    data class Output(val outcome: Outcome)

    fun execute(input: Input): Output

    fun executeInSession(input: Input, session: DSLContext): Output
}

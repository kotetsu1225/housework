package com.task.infra.outbox

/**
 * outbox のイベントを Pub/Sub に載せるときのメッセージ属性(#34 の Pub/Sub 共通契約、handoff §7.4)。
 * リレー(#72)が付け、subscriber(#61)が読む。名前を変えるときは先に #34 を更新する。
 */
object OutboxMessageAttributes {
    const val EVENT_ID = "eventId"
    const val EVENT_TYPE = "eventType"
    const val AGGREGATE_TYPE = "aggregateType"
    const val AGGREGATE_ID = "aggregateId"
    /** outbox 行の tenant_id(エンベロープ方式、#49)。payload には載せない */
    const val TENANT_ID = "tenantId"
    /** ISO-8601 */
    const val OCCURRED_AT = "occurredAt"
    const val SCHEMA_VERSION = "schemaVersion"
    const val CURRENT_SCHEMA_VERSION = "1"
}

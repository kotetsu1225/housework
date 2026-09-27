package com.task.infra.outbox

import org.jooq.DSLContext
import java.util.UUID

interface OutboxRepository {
    fun save(record: OutboxRecord, session: DSLContext): OutboxRecord
    fun findPending(session: DSLContext, limit: Int = 100): List<OutboxRecord>

    /**
     * `PENDING`行を`created_at`昇順で`FOR UPDATE SKIP LOCKED`付きで取得する(issue #72)。
     * リレーを複数プロセス同時に動かしても、他プロセスが既に掴んでいる行はスキップされるため
     * 同じ行を二重にpublishしない。呼び出し側は必ずトランザクション内([session]がトランザクション中の
     * `DSLContext`であること)で呼び、行のロックが取得中の処理の間だけ保持されるようにすること。
     */
    fun findPendingForUpdateSkipLocked(session: DSLContext, limit: Int = 100): List<OutboxRecord>

    fun update(record: OutboxRecord, session: DSLContext): OutboxRecord
    fun findById(id: UUID, session: DSLContext): OutboxRecord?
}

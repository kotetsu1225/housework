package com.task.infra.outbox

import com.task.domain.tenant.TenantId
import org.jooq.DSLContext
import java.util.UUID

interface CompletedDomainEventRepository {
    fun exists(eventId: UUID, session: DSLContext): Boolean

    /**
     * tenantId は outbox 行(エンベロープ、issue #49)から受け取ったものをそのまま保存する。
     * event_id は UUID でグローバルに一意なため、conflict target・onConflictDoNothing は変えない。
     */
    fun save(eventId: UUID, eventType: String, tenantId: TenantId, session: DSLContext)
}

package com.task.infra.memberMeta

import com.task.domain.member.MemberId
import com.task.domain.tenant.TenantId
import org.jooq.DSLContext

interface MemberMetaRepository {
    fun findByMemberIdAndKey(memberId: MemberId, key: String, session: DSLContext): Boolean?
    /** [tenantId] は [memberId] のメンバーが属するテナント(INSERT 時に tenant_id へ入れる。#48) */
    fun save(tenantId: TenantId, memberId: MemberId, key: String, value: Boolean, session: DSLContext)
}

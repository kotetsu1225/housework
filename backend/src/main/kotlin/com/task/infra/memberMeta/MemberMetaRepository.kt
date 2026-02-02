package com.task.infra.memberMeta

import com.task.domain.member.MemberId
import org.jooq.DSLContext

interface MemberMetaRepository {
    fun findByMemberIdAndKey(memberId: MemberId, key: String, session: DSLContext): Boolean?
    fun save(memberId: MemberId, key: String, value: Boolean, session: DSLContext)
}

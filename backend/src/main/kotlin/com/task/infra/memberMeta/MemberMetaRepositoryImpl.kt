package com.task.infra.memberMeta

import com.google.inject.Inject
import com.task.domain.member.MemberId
import com.task.infra.database.jooq.tables.references.MEMBER_METAS
import org.jooq.DSLContext
import java.time.OffsetDateTime
import java.time.ZoneOffset

class MemberMetaRepositoryImpl @Inject constructor() : MemberMetaRepository {

    override fun findByMemberIdAndKey(
        memberId: MemberId,
        key: String,
        session: DSLContext
    ): Boolean? {
        return session.select(MEMBER_METAS.VALUE)
            .from(MEMBER_METAS)
            .where(MEMBER_METAS.MEMBER_ID.eq(memberId.value))
            .and(MEMBER_METAS.KEY.eq(key))
            .fetchOne(MEMBER_METAS.VALUE)
    }

    override fun save(
        memberId: MemberId,
        key: String,
        value: Boolean,
        session: DSLContext
    ) {
        val now = OffsetDateTime.now(ZoneOffset.UTC)
        val exists = session.fetchExists(
            MEMBER_METAS,
            MEMBER_METAS.MEMBER_ID.eq(memberId.value)
                .and(MEMBER_METAS.KEY.eq(key))
        )

        if (exists) {
            session.update(MEMBER_METAS)
                .set(MEMBER_METAS.VALUE, value)
                .set(MEMBER_METAS.UPDATED_AT, now)
                .where(MEMBER_METAS.MEMBER_ID.eq(memberId.value))
                .and(MEMBER_METAS.KEY.eq(key))
                .execute()
            return
        }

        session.insertInto(MEMBER_METAS)
            .set(MEMBER_METAS.MEMBER_ID, memberId.value)
            .set(MEMBER_METAS.KEY, key)
            .set(MEMBER_METAS.VALUE, value)
            .set(MEMBER_METAS.CREATED_AT, now)
            .set(MEMBER_METAS.UPDATED_AT, now)
            .execute()
    }
}

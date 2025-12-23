package com.task.infra.MemberAvailability

import com.google.inject.Singleton
import com.task.domain.memberAvailability.MemberAvailability
import com.task.domain.memberAvailability.MemberAvailabilityId
import com.task.domain.memberAvailability.MemberAvailabilityRepository
import com.task.infra.database.jooq.tables.MemberAvailabilities.Companion.MEMBER_AVAILABILITIES
import org.jooq.DSLContext
import java.time.OffsetDateTime

@Singleton
class MemberAvailabilityRepositoryImpl : MemberAvailabilityRepository {
    override fun create(memberAvailability: MemberAvailability, session: DSLContext): MemberAvailability {
        val record = session.newRecord(MEMBER_AVAILABILITIES)

        record.id = memberAvailability.id.value
        record.memberId = memberAvailability.memberId.value
        record.targetDate = memberAvailability.targetDate
        record.createdAt = OffsetDateTime.now()
        record.updatedAt = OffsetDateTime.now()

        record.store()
        
        return memberAvailability
    }

    override fun findById(id: MemberAvailabilityId, session: DSLContext): MemberAvailability? {

    }
}
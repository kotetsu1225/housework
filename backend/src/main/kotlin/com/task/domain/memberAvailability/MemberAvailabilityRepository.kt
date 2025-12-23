package com.task.domain.memberAvailability

import com.google.inject.ImplementedBy
import com.task.domain.member.MemberId
import com.task.infra.memberAvailability.MemberAvailabilityRepositoryImpl
import org.jooq.DSLContext
import java.time.LocalDate

@ImplementedBy(MemberAvailabilityRepositoryImpl::class)
interface MemberAvailabilityRepository {
    fun save(memberAvailability: MemberAvailability, session: DSLContext): MemberAvailability
    fun findById(id: MemberAvailabilityId, session: DSLContext): MemberAvailability?
    fun delete(id: MemberAvailabilityId, session: DSLContext)
    fun findByMemberIdAndTargetDate(
        memberId: MemberId,
        targetDate: LocalDate,
        session: DSLContext
    ): MemberAvailability?

    fun findAllByMemberId(
        memberId: MemberId,
        session: DSLContext
    ): List<MemberAvailability>
}
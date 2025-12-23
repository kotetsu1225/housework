package com.task.domain.memberAvailability

import com.google.inject.ImplementedBy
import com.task.infra.MemberAvailability.MemberAvailabilityRepositoryImpl
import org.jooq.DSLContext

@ImplementedBy(MemberAvailabilityRepositoryImpl::class)
interface MemberAvailabilityRepository {
    fun create(memberAvailability: MemberAvailability, session: DSLContext): MemberAvailability
    fun findById(id: MemberAvailabilityId, session: DSLContext): MemberAvailability?
    fun findAll(session: DSLContext): List<MemberAvailability>
}
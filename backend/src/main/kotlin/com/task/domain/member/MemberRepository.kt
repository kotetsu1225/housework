package com.task.domain.member

import com.google.inject.ImplementedBy
import com.task.infra.member.MemberRepositoryImpl
import org.jooq.DSLContext

@ImplementedBy(MemberRepositoryImpl::class)
interface MemberRepository {
    fun create(member: Member, session: DSLContext): Member
    fun update(member: Member, session: DSLContext): Member
    fun findById(id: MemberId, session: DSLContext): Member?
    fun findByName(name: MemberName, session: DSLContext): Member?
    fun findAllNames(session: DSLContext): List<MemberName>
    fun findAll(session: DSLContext): List<Member>
}

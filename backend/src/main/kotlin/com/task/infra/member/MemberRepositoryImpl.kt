package com.task.infra.member

import com.google.inject.Singleton
import com.task.domain.member.FamilyRole
import com.task.domain.member.Member
import com.task.domain.member.MemberId
import com.task.domain.member.MemberName
import com.task.domain.member.MemberRepository
import com.task.domain.member.PasswordHash
import com.task.infra.database.jooq.tables.Members.Companion.MEMBERS
import com.task.infra.database.jooq.tables.records.MembersRecord
import org.jooq.DSLContext
import java.time.OffsetDateTime

@Singleton
class MemberRepositoryImpl : MemberRepository {

    override fun create(member: Member, session: DSLContext): Member {
        val record = session.newRecord(MEMBERS)

        record.id = member.id.value
        record.name = member.name.value
        record.role = member.familyRole.value
        record.passwordHash = member.password.value
        record.createdAt = OffsetDateTime.now()
        record.updatedAt = OffsetDateTime.now()

        record.store()

        return member
    }

    override fun update(member: Member, session: DSLContext): Member {
        session
            .update(MEMBERS)
            .set(MEMBERS.NAME, member.name.value)
            .set(MEMBERS.ROLE, member.familyRole.value)
            .set(MEMBERS.PASSWORD_HASH, member.password.value)
            .set(MEMBERS.UPDATED_AT, OffsetDateTime.now())
            .where(MEMBERS.ID.eq(member.id.value))
            .execute()

        return member
    }

    
    override fun findById(id: MemberId, session: DSLContext): Member? {
        val record = session
            .selectFrom(MEMBERS)
            .where(MEMBERS.ID.eq(id.value))
            .fetchOne()

        return record?.toDomain()
    }

    override fun findByName(name: MemberName, session: DSLContext): Member? {
        val record = session
            .selectFrom(MEMBERS)
            .where(MEMBERS.NAME.eq(name.value))
            .fetchOne()

        return record?.toDomain()
    }
    
    override fun findAllNames(session: DSLContext): List<MemberName> {
        return session
            .select(MEMBERS.NAME)
            .from(MEMBERS)
            .fetch()
            .map { record ->
                MemberName(record.get(MEMBERS.NAME)!!)
            }
    }
    
    override fun findAll(session: DSLContext): List<Member> {
        return session
            .selectFrom(MEMBERS)
            .orderBy(MEMBERS.CREATED_AT.desc())
            .fetch()
            .map { record -> record.toDomain() }
    }

    private fun MembersRecord.toDomain(): Member {
        return Member.reconstruct(
            id = MemberId(this.id!!),
            name = MemberName(this.name),
            familyRole = FamilyRole.get(this.role),
            password = PasswordHash(this.passwordHash),
        )
    }
}


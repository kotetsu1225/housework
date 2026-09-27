package com.task.usecase.member

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.member.EmailAlreadyUsedException
import com.task.domain.member.Member
import com.task.domain.member.MemberRepository
import com.task.domain.member.PasswordHasher
import com.task.infra.database.Database
import com.task.infra.database.isUniqueViolationOf
import org.jooq.exception.DataAccessException

@Singleton
class CreateMemberUseCaseImpl @Inject constructor(
    private val database: Database,
    private val memberRepository: MemberRepository,
    private val passwordHasher: PasswordHasher
) : CreateMemberUseCase {

    companion object {
        // members.email の一意制約はV11で明示的に付けた名前(members_email_key)。
        // ここではテナントは既に確定しているため、tenants側の制約は対象にしない
        // (RegisterFamilyUseCaseImplと違いtenant行はINSERTしない)。
        private val EMAIL_UNIQUE_CONSTRAINTS = setOf("members_email_key")
    }

    override fun execute(input: CreateMemberUseCase.Input): CreateMemberUseCase.Output {
        // パスワードをハッシュ化（トランザクション外で実行 - 重い処理のため）
        val hashedPassword = passwordHasher.hash(input.password)

        // emailのグローバル重複はRLS下では検知できない(他テナントの行を見る必要があるため)。
        // 事前SELECTではなく、DBの一意制約違反(SQLState 23505)を検知して変換する
        // (RegisterFamilyUseCaseImplと同じ方式。#44)。
        val member = try {
            database.withTransaction(input.tenantId) { session ->
                val existingMembersName = memberRepository.findAllNames(session)

                val newMember = Member.create(
                    tenantId = input.tenantId,
                    name = input.name,
                    familyRole = input.familyRole,
                    password = hashedPassword,
                    existingMembersName = existingMembersName,
                    email = input.email,
                )

                memberRepository.create(newMember, session)
            }
        } catch (e: DataAccessException) {
            throw if (e.isUniqueViolationOf(EMAIL_UNIQUE_CONSTRAINTS)) EmailAlreadyUsedException() else e
        }

        return CreateMemberUseCase.Output(
            id = member.id,
            name = member.name,
            familyRole = member.familyRole,
            email = member.email,
        )
    }
}

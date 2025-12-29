package com.task.usecase.member

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.member.Member
import com.task.domain.member.MemberRepository
import com.task.domain.member.PasswordHasher
import com.task.infra.database.Database

@Singleton
class CreateMemberUseCaseImpl @Inject constructor(
    private val database: Database,
    private val memberRepository: MemberRepository,
    private val passwordHasher: PasswordHasher
) : CreateMemberUseCase {

    override fun execute(input: CreateMemberUseCase.Input): CreateMemberUseCase.Output {
        // パスワードをハッシュ化（トランザクション外で実行 - 重い処理のため）
        val hashedPassword = passwordHasher.hash(input.password)

        val member = database.withTransaction { session ->
            val existingMembersName = memberRepository.findAllNames(session)

            val newMember = Member.create(
                name = input.name,
                familyRole = input.familyRole,
                password = hashedPassword,
                existingMembersName = existingMembersName,
                email = input.email,
            )

            memberRepository.create(newMember, session)
        }

        return CreateMemberUseCase.Output(
            id = member.id,
            name = member.name,
            familyRole = member.familyRole,
            email = member.email,
        )
    }
}

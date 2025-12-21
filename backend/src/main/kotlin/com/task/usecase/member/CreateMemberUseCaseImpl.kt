package com.task.usecase.member

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.member.Member
import com.task.domain.member.MemberRepository
import com.task.infra.database.Database

@Singleton
class CreateMemberUseCaseImpl @Inject constructor(
    private val database: Database,
    private val memberRepository: MemberRepository
) : CreateMemberUseCase {

    override fun execute(input: CreateMemberUseCase.Input): CreateMemberUseCase.Output {
        val member = database.withTransaction { session ->
            val existingMembersName = memberRepository.findAllNames(session)

            val newMember = Member.create(
                name = input.name,
                familyRole = input.familyRole,
                existingMembersName = existingMembersName
            )

            memberRepository.create(newMember, session)
        }

        return CreateMemberUseCase.Output(
            id = member.id,
            name = member.name,
            familyRole = member.familyRole
        )
    }
}

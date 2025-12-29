package com.task.usecase.member

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.member.MemberRepository
import com.task.infra.database.Database

@Singleton
class GetMemberUseCaseImpl @Inject constructor(
    private val database: Database,
    private val memberRepository: MemberRepository
) : GetMemberUseCase {

    override fun execute(input: GetMemberUseCase.Input): GetMemberUseCase.Output? {
        val member = database.withTransaction { session ->
            memberRepository.findById(input.id, session)
        }

        return member?.let {
            GetMemberUseCase.Output(
                id = it.id,
                name = it.name,
                email = it.email,
                familyRole = it.familyRole
            )
        }
    }
}

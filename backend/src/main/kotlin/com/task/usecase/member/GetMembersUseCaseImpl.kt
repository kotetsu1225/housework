package com.task.usecase.member

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.member.MemberRepository
import com.task.infra.database.Database

@Singleton
class GetMembersUseCaseImpl @Inject constructor(
    private val database: Database,
    private val memberRepository: MemberRepository
) : GetMembersUseCase {

    override fun execute(): GetMembersUseCase.Output {
        val members = database.withTransaction { session ->
            memberRepository.findAll(session)
        }

        return GetMembersUseCase.Output(
            members = members.map { member ->
                GetMembersUseCase.MemberOutput(
                    id = member.id,
                    name = member.name,
                    email = member.email,
                    familyRole = member.familyRole
                )
            }
        )
    }
}

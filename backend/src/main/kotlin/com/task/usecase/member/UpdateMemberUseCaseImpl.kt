package com.task.usecase.member

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.member.MemberRepository
import com.task.infra.database.Database

@Singleton
class UpdateMemberUseCaseImpl @Inject constructor(
    private val database: Database,
    private val memberRepository: MemberRepository
) : UpdateMemberUseCase {

    override fun execute(input: UpdateMemberUseCase.Input): UpdateMemberUseCase.Output {
        val member = database.withTransaction { session ->
            var targetMember = memberRepository.findById(input.id, session)
                ?: throw IllegalArgumentException("Member with id ${input.id.value} が見つかりませんでした。")

            if (input.name != null) {
                val existingMembersName = memberRepository.findAllNames(session)
                    .filter { it != targetMember.name }  // 自分自身は除外
                targetMember = targetMember.updateName(input.name, existingMembersName)
            }


            if (input.familyRole != null) {
                targetMember = targetMember.updateFamilyRole(input.familyRole)
            }
            memberRepository.update(targetMember, session)
        }

        return UpdateMemberUseCase.Output(
            id = member.id,
            name = member.name,
            familyRole = member.familyRole
        )
    }
}

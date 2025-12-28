package com.task.usecase.member

import com.google.inject.ImplementedBy
import com.task.domain.member.FamilyRole
import com.task.domain.member.MemberId
import com.task.domain.member.MemberName
import com.task.domain.member.PlainPassword

@ImplementedBy(CreateMemberUseCaseImpl::class)
interface CreateMemberUseCase {
    data class Input(
        val name: MemberName,
        val familyRole: FamilyRole,
        val password: PlainPassword,
    )

    data class Output(
        val id: MemberId,
        val name: MemberName,
        val familyRole: FamilyRole,
    )

    fun execute(input: Input): Output
}

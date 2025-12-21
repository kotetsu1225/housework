package com.task.usecase.member

import com.google.inject.ImplementedBy
import com.task.domain.member.FamilyRole
import com.task.domain.member.MemberId
import com.task.domain.member.MemberName


@ImplementedBy(UpdateMemberUseCaseImpl::class)
interface UpdateMemberUseCase {
    data class Input(
        val id: MemberId,
        val name: MemberName? = null,
        val familyRole: FamilyRole? = null,
    )

    data class Output(
        val id: MemberId,
        val name: MemberName,
        val familyRole: FamilyRole,
    )

    fun execute(input: Input): Output
}

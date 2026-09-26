package com.task.usecase.member

import com.google.inject.ImplementedBy
import com.task.domain.member.FamilyRole
import com.task.domain.member.MemberEmail
import com.task.domain.member.MemberId
import com.task.domain.member.MemberName
import com.task.domain.member.PlainPassword
import com.task.domain.tenant.TenantId

@ImplementedBy(CreateMemberUseCaseImpl::class)
interface CreateMemberUseCase {
    data class Input(
        val tenantId: TenantId,
        val name: MemberName,
        val familyRole: FamilyRole,
        val email: MemberEmail,
        val password: PlainPassword,
    )

    data class Output(
        val id: MemberId,
        val name: MemberName,
        val familyRole: FamilyRole,
        val email: MemberEmail,
    )

    fun execute(input: Input): Output
}

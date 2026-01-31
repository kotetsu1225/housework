package com.task.usecase.member

import com.google.inject.ImplementedBy
import com.task.domain.member.FamilyRole
import com.task.domain.member.MemberEmail
import com.task.domain.member.MemberId
import com.task.domain.member.MemberName


@ImplementedBy(GetMembersUseCaseImpl::class)
interface GetMembersUseCase {

    data class Output(
        val members: List<MemberOutput>
    )

    data class MemberOutput(
        val id: MemberId,
        val name: MemberName,
        val email: MemberEmail,
        val familyRole: FamilyRole,
        val todayEarnedPoint: Int,
        val todayFamilyTaskCompleted: Int,
        val todayPersonalTaskCompleted: Int,
    )

    fun execute(): Output
}

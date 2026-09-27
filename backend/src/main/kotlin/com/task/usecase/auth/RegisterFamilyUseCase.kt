package com.task.usecase.auth

import com.task.domain.member.FamilyRole
import com.task.domain.member.MemberEmail
import com.task.domain.member.MemberId
import com.task.domain.member.MemberName
import com.task.domain.member.PlainPassword
import com.task.domain.tenant.FamilyName
import com.task.domain.tenant.TenantId

/**
 * サインアップ(#44)用のUseCase。
 *
 * 「家族(tenant)+ 最初のメンバー」を1トランザクションで作成する。
 * 実装(`RegisterFamilyUseCaseImpl`)は `Config.kt` で bind する(`@ImplementedBy` は付けない)。
 */
interface RegisterFamilyUseCase {
    data class Input(
        val familyName: FamilyName,
        val name: MemberName,
        val email: MemberEmail,
        val familyRole: FamilyRole,
        val password: PlainPassword,
    )

    data class Output(
        val tenantId: TenantId,
        val memberId: MemberId,
        val memberName: MemberName,
        val token: String,
    )

    fun execute(input: Input): Output
}

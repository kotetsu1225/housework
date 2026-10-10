package com.task.usecase.memberMeta

import com.google.inject.ImplementedBy
import com.task.domain.member.MemberId
import com.task.domain.tenant.TenantId

@ImplementedBy(SaveMemberMetaUseCaseImpl::class)
interface SaveMemberMetaUseCase {
    data class Input(
        val tenantId: TenantId,
        val memberId: MemberId,
        val key: String,
        val value: Boolean
    )

    fun execute(input: Input)
}

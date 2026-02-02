package com.task.usecase.memberMeta

import com.google.inject.ImplementedBy
import com.task.domain.member.MemberId

@ImplementedBy(SaveMemberMetaUseCaseImpl::class)
interface SaveMemberMetaUseCase {
    data class Input(
        val memberId: MemberId,
        val key: String,
        val value: Boolean
    )

    fun execute(input: Input)
}

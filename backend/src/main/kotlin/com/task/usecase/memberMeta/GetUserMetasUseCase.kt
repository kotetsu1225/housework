package com.task.usecase.memberMeta

import com.google.inject.ImplementedBy
import com.task.domain.member.MemberId
@ImplementedBy(GetUserMetasUseCaseImpl::class)
interface GetUserMetasUseCase {
    data class Input(
        val memberId: MemberId,
        val key: String
    )

    data class Output(
        val memberId: MemberId,
        val value: Boolean?
    )

    fun execute(input: Input): Output
}
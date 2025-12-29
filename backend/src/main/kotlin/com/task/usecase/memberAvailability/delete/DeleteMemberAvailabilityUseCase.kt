package com.task.usecase.memberAvailability.delete

import com.google.inject.ImplementedBy
import com.task.domain.memberAvailability.MemberAvailabilityId

@ImplementedBy(DeleteMemberAvailabilityUseCaseImpl::class)
interface DeleteMemberAvailabilityUseCase {
    data class Input(
        val id: MemberAvailabilityId,
    )

    fun execute(input: Input)
}
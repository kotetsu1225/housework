package com.task.usecase.memberAvailability.create

import com.google.inject.ImplementedBy
import com.task.domain.member.MemberId
import com.task.domain.memberAvailability.MemberAvailabilityId
import com.task.domain.memberAvailability.TimeSlot
import java.time.LocalDate

@ImplementedBy(CreateMemberAvailabilityUseCaseImpl::class)
interface CreateMemberAvailabilityUseCase {
    data class Input(
        val memberId: MemberId,
        val targetDate: LocalDate,
        val slots: List<TimeSlot>,
    )

    data class Output(
        val id: MemberAvailabilityId,
        val memberId: MemberId,
        val targetDate: LocalDate,
        val slots: List<TimeSlot>,
    )

    fun execute(input: Input): Output
}
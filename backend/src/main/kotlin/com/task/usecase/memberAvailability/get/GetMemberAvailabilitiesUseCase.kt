package com.task.usecase.memberAvailability.get

import com.google.inject.ImplementedBy
import com.task.domain.member.MemberId
import com.task.domain.memberAvailability.MemberAvailabilityId
import com.task.domain.memberAvailability.TimeSlot
import java.time.LocalDate


@ImplementedBy(GetMemberAvailabilitiesUseCaseImpl::class)
interface GetMemberAvailabilitiesUseCase {
    data class Input(
        val memberId: MemberId
    )

    data class Output(
        val availabilities: List<AvailabilityOutput>
    )

    data class AvailabilityOutput(
        val id: MemberAvailabilityId,
        val memberId: MemberId,
        val targetDate: LocalDate,
        val slots: List<TimeSlot>
    )

    fun execute(input: Input): Output
}

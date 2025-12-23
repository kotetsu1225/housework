package com.task.usecase.memberAvailability.update

import com.google.inject.ImplementedBy
import com.task.domain.member.MemberId
import com.task.domain.memberAvailability.MemberAvailabilityId
import com.task.domain.memberAvailability.TimeSlot
import java.time.LocalDate

@ImplementedBy(DeleteMemberAvailabilityTimeSlotsUseCaseImpl::class)
interface DeleteMemberAvailabilityTimeSlotsUseCase {
    
    data class Input(
        val id: MemberAvailabilityId,
        val deletedSlots: List<TimeSlot>,
    )
    
    data class Output(
        val id: MemberAvailabilityId,
        val memberId: MemberId,
        val targetDate: LocalDate,
        val slots: List<TimeSlot>,
    )

    fun execute(input: Input): Output
}
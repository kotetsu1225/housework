package com.task.usecase.memberAvailability.update

import com.google.inject.Inject
import com.task.domain.memberAvailability.MemberAvailabilityRepository
import com.task.infra.database.Database
import jakarta.inject.Singleton


@Singleton
class DeleteMemberAvailabilityTimeSlotsUseCaseImpl @Inject constructor(
    private val memberAvailabilityRepository: MemberAvailabilityRepository,
    private val database: Database,
) : DeleteMemberAvailabilityTimeSlotsUseCase {
    override fun execute(input: DeleteMemberAvailabilityTimeSlotsUseCase.Input): DeleteMemberAvailabilityTimeSlotsUseCase.Output{
        return database.withTransaction { session ->
            val existingAvailability = memberAvailabilityRepository.findById(
                input.id,
                session
            ) ?: throw IllegalArgumentException("MemberAvailability not found: ${input.id}")

            val newMemberAvailability = existingAvailability.deleteSlots(input.deletedSlots)

            val memberAvailability = memberAvailabilityRepository.save(newMemberAvailability, session)

            DeleteMemberAvailabilityTimeSlotsUseCase.Output(
                id = memberAvailability.id,
                targetDate = memberAvailability.targetDate,
                slots = memberAvailability.slots,
                memberId = memberAvailability.memberId
            )
        }
    }
}
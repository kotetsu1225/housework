package com.task.usecase.memberAvailability.update

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.memberAvailability.MemberAvailabilityRepository
import com.task.infra.database.Database

@Singleton
class UpdateMemberAvailabilityTimeSlotsUseCaseImpl @Inject constructor(
    private val memberAvailabilityRepository: MemberAvailabilityRepository,
    private val database: Database,
) : UpdateMemberAvailabilityTimeSlotsUseCase {
    override fun execute(input: UpdateMemberAvailabilityTimeSlotsUseCase.Input): UpdateMemberAvailabilityTimeSlotsUseCase.Output {
        return database.withTransaction { session ->
            val existingAvailability = memberAvailabilityRepository.findById(
                input.id,
                session
            ) ?: throw IllegalArgumentException("MemberAvailability not found: ${input.id}")

            val existingSlots = existingAvailability.slots

            val updatedAvailability = existingAvailability.updateSlots(
                input.newSlots,
                existingSlots
            )

            val newMemberAvailability = memberAvailabilityRepository.save(updatedAvailability, session)
            
            UpdateMemberAvailabilityTimeSlotsUseCase.Output(
                id = newMemberAvailability.id,
                memberId = newMemberAvailability.memberId,
                targetDate = newMemberAvailability.targetDate,
                slots = newMemberAvailability.slots
            )
        }
    }

}
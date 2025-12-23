package com.task.usecase.memberAvailability.create

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.memberAvailability.MemberAvailability
import com.task.domain.memberAvailability.MemberAvailabilityRepository
import com.task.infra.database.Database

@Singleton
class CreateMemberAvailabilityUseCaseImpl @Inject constructor(
    private val memberAvailabilityRepository: MemberAvailabilityRepository,
    private val database: Database,
) : CreateMemberAvailabilityUseCase {
    override fun execute(input: CreateMemberAvailabilityUseCase.Input): CreateMemberAvailabilityUseCase.Output {
        val memberAvailability = database.withTransaction { session ->

            val existingAvailabilities = memberAvailabilityRepository.findAll(session)

            val newMemberAvailability = MemberAvailability.create(
                input.memberId, 
                input.targetDate, 
                input.slots,
                existingAvailabilities
            )

            memberAvailabilityRepository.create(newMemberAvailability, session)
        }

        return CreateMemberAvailabilityUseCase.Output(
            id = memberAvailability.id,
            targetDate = memberAvailability.targetDate,
            slots = memberAvailability.slots
        )
    }
}
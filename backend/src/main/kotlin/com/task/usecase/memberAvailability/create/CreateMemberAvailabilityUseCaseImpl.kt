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
        return database.withTransaction { session ->
            val existingAvailability = memberAvailabilityRepository.findByMemberIdAndTargetDate(
                memberId = input.memberId,
                targetDate = input.targetDate,
                session = session
            )

            val newMemberAvailability = MemberAvailability.create(
                memberId = input.memberId,
                targetDate = input.targetDate,
                slots = input.slots,
                existingAvailability = existingAvailability
            )

            val memberAvailability = memberAvailabilityRepository.save(newMemberAvailability, session)

            CreateMemberAvailabilityUseCase.Output(
                id = memberAvailability.id,
                memberId = memberAvailability.memberId,
                targetDate = memberAvailability.targetDate,
                slots = memberAvailability.slots
            )
        }
    }
}
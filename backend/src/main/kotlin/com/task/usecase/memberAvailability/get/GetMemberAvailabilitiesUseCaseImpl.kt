package com.task.usecase.memberAvailability.get

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.memberAvailability.MemberAvailabilityRepository
import com.task.infra.database.Database

@Singleton
class GetMemberAvailabilitiesUseCaseImpl @Inject constructor(
    private val database: Database,
    private val memberAvailabilityRepository: MemberAvailabilityRepository
) : GetMemberAvailabilitiesUseCase {

    override fun execute(input: GetMemberAvailabilitiesUseCase.Input): GetMemberAvailabilitiesUseCase.Output {
        val availabilities = database.withTransaction { session ->
            memberAvailabilityRepository.findAllByMemberId(input.memberId, session)
        }

        return GetMemberAvailabilitiesUseCase.Output(
            availabilities = availabilities.map { availability ->
                GetMemberAvailabilitiesUseCase.AvailabilityOutput(
                    id = availability.id,
                    memberId = availability.memberId,
                    targetDate = availability.targetDate,
                    slots = availability.slots
                )
            }
        )
    }
}

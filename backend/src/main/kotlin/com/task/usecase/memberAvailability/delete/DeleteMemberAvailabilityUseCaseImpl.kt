package com.task.usecase.memberAvailability.delete

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.memberAvailability.MemberAvailabilityRepository
import com.task.infra.database.Database

@Singleton
class DeleteMemberAvailabilityUseCaseImpl @Inject constructor(
    private val database: Database,
    private val memberAvailabilityRepository: MemberAvailabilityRepository,
) : DeleteMemberAvailabilityUseCase {

    override fun execute(input: DeleteMemberAvailabilityUseCase.Input) {
        database.withTransaction { session ->
            // 存在確認
            memberAvailabilityRepository.findById(input.id, session)
                ?: throw IllegalArgumentException("空き時間が見つかりません: ${input.id}")

            // 物理削除（time_slotsはON DELETE CASCADEで自動削除）
            memberAvailabilityRepository.delete(input.id, session)
        }
    }
}
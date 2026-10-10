package com.task.usecase.memberMeta

import com.google.inject.Inject
import com.task.infra.database.Database
import com.task.infra.memberMeta.MemberMetaRepository

class SaveMemberMetaUseCaseImpl @Inject constructor(
    private val database: Database,
    private val memberMetaRepository: MemberMetaRepository
) : SaveMemberMetaUseCase {
    override fun execute(input: SaveMemberMetaUseCase.Input) {
        database.withTransaction(input.tenantId) { session ->
            memberMetaRepository.save(input.tenantId, input.memberId, input.key, input.value, session)
        }
    }
}

package com.task.usecase.memberMeta

import com.google.inject.Inject
import com.task.infra.database.Database
import com.task.infra.memberMeta.MemberMetaRepository

class GetUserMetasUseCaseImpl@Inject constructor(
    private val database: Database,
    private val memberMetaRepository: MemberMetaRepository
) : GetUserMetasUseCase {
    override fun execute(input: GetUserMetasUseCase.Input): GetUserMetasUseCase.Output {
        return database.withTransaction { session ->
            GetUserMetasUseCase.Output(
                memberId = input.memberId,
                value = memberMetaRepository.findByMemberIdAndKey(input.memberId, input.key, session)
            )
        }
    }
}
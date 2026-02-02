package com.task.usecase.pushSubscription

import com.google.inject.Inject
import com.task.infra.pushSubscription.PushSubscriptionRepository
import com.task.infra.database.Database

class GetPushSubscriptionUseCaseImpl @Inject constructor(
    private val database: Database,
    private val pushSubscriptionRepository: PushSubscriptionRepository
) : GetPushSubscriptionUseCase {

    override fun execute(input: GetPushSubscriptionUseCase.Input): GetPushSubscriptionUseCase.Output {
        return database.withTransaction { session ->
            val subscriptions = pushSubscriptionRepository.findByMemberId(input.memberId, session)
            GetPushSubscriptionUseCase.Output(subscriptions)
        }
    }
}

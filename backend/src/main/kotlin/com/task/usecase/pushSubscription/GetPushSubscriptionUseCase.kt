package com.task.usecase.pushSubscription

import com.google.inject.ImplementedBy
import com.task.domain.member.MemberId
import com.task.infra.pushSubscription.PushSubscription

@ImplementedBy(GetPushSubscriptionUseCaseImpl::class)
interface GetPushSubscriptionUseCase {
    data class Input(
        val memberId: MemberId
    )

    data class Output(
        val subscriptions: List<PushSubscription>
    )

    fun execute(input: Input): Output
}

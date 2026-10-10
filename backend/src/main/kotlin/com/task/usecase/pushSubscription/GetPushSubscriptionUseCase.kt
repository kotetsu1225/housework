package com.task.usecase.pushSubscription

import com.google.inject.ImplementedBy
import com.task.domain.member.MemberId
import com.task.domain.tenant.TenantId
import com.task.infra.pushSubscription.PushSubscription

@ImplementedBy(GetPushSubscriptionUseCaseImpl::class)
interface GetPushSubscriptionUseCase {
    data class Input(
        val tenantId: TenantId,
        val memberId: MemberId
    )

    data class Output(
        val subscriptions: List<PushSubscription>
    )

    fun execute(input: Input): Output
}

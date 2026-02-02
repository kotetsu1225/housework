package com.task.usecase.pushSubscription

import com.google.inject.ImplementedBy
import com.task.domain.member.MemberId
import java.time.Instant
import java.util.UUID

@ImplementedBy(RegisterPushSubscriptionUseCaseImpl::class)
interface RegisterPushSubscriptionUseCase {
    data class Input(
        val memberId: MemberId,
        val endpoint: String,
        val p256dhKey: String,
        val authKey: String,
        val expirationTime: Instant? = null,
        val userAgent: String? = null
    )

    data class Output(
        val subscriptionId: UUID
    )

    fun execute(input: Input): Output
}

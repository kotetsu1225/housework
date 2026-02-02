package com.task.usecase.pushSubscription

import com.google.inject.Inject
import com.task.infra.database.Database
import com.task.infra.memberMeta.MemberMetaRepository
import com.task.infra.pushSubscription.PushSubscription
import com.task.infra.pushSubscription.PushSubscriptionRepository
import java.time.Instant
import java.util.UUID

class RegisterPushSubscriptionUseCaseImpl @Inject constructor(
    private val database: Database,
    private val pushSubscriptionRepository: PushSubscriptionRepository,
    private val memberMetaRepository: MemberMetaRepository
) : RegisterPushSubscriptionUseCase {

    override fun execute(input: RegisterPushSubscriptionUseCase.Input): RegisterPushSubscriptionUseCase.Output {
        return database.withTransaction { session ->
            val subscription = PushSubscription(
                id = UUID.randomUUID(),
                memberId = input.memberId,
                endpoint = input.endpoint,
                p256dhKey = input.p256dhKey,
                authKey = input.authKey,
                expirationTime = input.expirationTime,
                userAgent = input.userAgent,
                isActive = true,
            )

            println("[RegisterPushSubscription] Saving subscription: id=${subscription.id}, memberId=${subscription.memberId.value}, endpoint=${subscription.endpoint}")
            val saved = pushSubscriptionRepository.save(subscription, session)
            println("[RegisterPushSubscription] Saved successfully: id=${saved.id}")
            memberMetaRepository.save(
                memberId = input.memberId,
                key = "pushNotificationsPermission",
                value = true,
                session = session
            )

            RegisterPushSubscriptionUseCase.Output(
                subscriptionId = saved.id
            )
        }
    }
}

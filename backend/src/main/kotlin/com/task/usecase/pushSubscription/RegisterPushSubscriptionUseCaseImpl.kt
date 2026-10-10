package com.task.usecase.pushSubscription

import com.google.inject.Inject
import com.task.infra.database.Database
import com.task.infra.database.isUniqueViolationOf
import com.task.infra.memberMeta.MemberMetaRepository
import com.task.infra.pushSubscription.PushSubscription
import com.task.infra.pushSubscription.PushSubscriptionRepository
import org.jooq.exception.DataAccessException
import java.util.UUID

class RegisterPushSubscriptionUseCaseImpl @Inject constructor(
    private val database: Database,
    private val pushSubscriptionRepository: PushSubscriptionRepository,
    private val memberMetaRepository: MemberMetaRepository
) : RegisterPushSubscriptionUseCase {

    companion object {
        /** push_subscriptions.endpoint のグローバル一意制約(V16) */
        private val ENDPOINT_UNIQUE_CONSTRAINTS = setOf("uq_push_subscriptions_endpoint")
    }

    /**
     * 呼び出し元メンバーのテナントのトランザクションで購読を登録(同じ endpoint があれば更新)し、
     * 通知許可のメタ情報を true にする(#48 #52)。
     *
     * @throws PushEndpointRegisteredByAnotherFamilyException 同じ endpoint(= 同じ端末のブラウザ)が
     *   別の家族のアカウントで登録済みのとき(#48 案 C: 付け替えずに断る。HTTP 409)
     */
    override fun execute(input: RegisterPushSubscriptionUseCase.Input): RegisterPushSubscriptionUseCase.Output {
        // 一意制約違反が起きるとトランザクション自体が中断されるため、トランザクションの外で捕まえる
        try {
            return database.withTransaction(input.tenantId) { session ->
                val subscription = PushSubscription(
                    id = UUID.randomUUID(),
                    tenantId = input.tenantId,
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
                    tenantId = input.tenantId,
                    memberId = input.memberId,
                    key = "pushNotificationsPermission",
                    value = true,
                    session = session
                )

                RegisterPushSubscriptionUseCase.Output(
                    subscriptionId = saved.id
                )
            }
        } catch (e: DataAccessException) {
            // RLS で自テナントの行しか見えないため、同じ endpoint が見つからずに INSERT して一意制約違反になった
            // = 別の家族が同じ endpoint を登録済み(PushSubscriptionRepositoryImpl.save 参照)
            if (e.isUniqueViolationOf(ENDPOINT_UNIQUE_CONSTRAINTS)) {
                throw PushEndpointRegisteredByAnotherFamilyException()
            }
            throw e
        }
    }
}

package com.task.presentation

import com.task.domain.member.MemberId
import com.task.usecase.memberMeta.GetUserMetasUseCase
import com.task.usecase.memberMeta.SaveMemberMetaUseCase
import com.task.usecase.pushSubscription.GetPushSubscriptionUseCase
import com.task.usecase.pushSubscription.RegisterPushSubscriptionUseCase
import io.ktor.http.*
import io.ktor.resources.Resource
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.auth.jwt.JWTPrincipal
import io.ktor.server.request.*
import io.ktor.server.resources.get
import io.ktor.server.resources.post
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable
import java.util.UUID

@Resource("/api/push-subscriptions")
class PushSubscriptions {

    @Resource("/my")
    class My(val parent: PushSubscriptions = PushSubscriptions())

    @Resource("")
    class Register(val parent: PushSubscriptions = PushSubscriptions()) {
        @Serializable
        data class Request(
            val endpoint: String,
            val keys: PushSubscriptionKeys
        )
    }

    @Resource("/is-push-notification-permission-answer")
    class IsPushNotificationsPermissionAnswer(
        val parent: PushSubscriptions = PushSubscriptions()
    )

    @Resource("/permission-answer")
    class PermissionAnswer(
        val parent: PushSubscriptions = PushSubscriptions()
    ) {
        @Serializable
        data class Request(
            val value: Boolean
        )
    }

}

@Serializable
data class PushSubscriptionKeys(
    val p256dh: String,
    val auth: String
)

@Serializable
data class PushSubscriptionDto(
    val id: String,
    val endpoint: String,
    val userAgent: String?,
    val isActive: Boolean
)

@Serializable
data class RegisterPushSubscriptionResponse(
    val subscriptionId: String
)

@Serializable
data class CheckPushSubscriptionResponse(
    val hasActiveSubscription: Boolean,
    val subscriptions: List<PushSubscriptionDto>
)

@Serializable
data class IsPushNotificationsPermissionAnswerResponse(
    val hasPushNotificationsPermissionAnswer: Boolean
)

fun Route.pushSubscriptions() {

    get<PushSubscriptions.My> {
        val principal = call.principal<JWTPrincipal>()
            ?: throw IllegalArgumentException("No principal")
        val memberId = MemberId(UUID.fromString(principal.payload.subject))

        val output = instance<GetPushSubscriptionUseCase>().execute(
            GetPushSubscriptionUseCase.Input(memberId)
        )

        val activeSubscriptions = output.subscriptions.filter { it.isActive }
        val response = CheckPushSubscriptionResponse(
            hasActiveSubscription = activeSubscriptions.isNotEmpty(),
            subscriptions = activeSubscriptions.map {
                PushSubscriptionDto(
                    id = it.id.toString(),
                    endpoint = it.endpoint,
                    userAgent = it.userAgent,
                    isActive = it.isActive
                )
            }
        )

        call.respond(
            HttpStatusCode.OK,
            response
        )
    }

    post<PushSubscriptions.Register> {
        val principal = call.principal<JWTPrincipal>()
            ?: throw IllegalArgumentException("No principal")
        val request = call.receive<PushSubscriptions.Register.Request>()

        val output = instance<RegisterPushSubscriptionUseCase>().execute(
            RegisterPushSubscriptionUseCase.Input(
                memberId = MemberId(UUID.fromString(principal.payload.subject)),
                endpoint = request.endpoint,
                p256dhKey = request.keys.p256dh,
                authKey = request.keys.auth,
                userAgent = call.request.userAgent()
            )
        )

        call.respond(
            HttpStatusCode.Created,
            RegisterPushSubscriptionResponse(
                subscriptionId = output.subscriptionId.toString()
            )
        )
    }

    get<PushSubscriptions.IsPushNotificationsPermissionAnswer> {
        val principal = call.principal<JWTPrincipal>()
        ?: throw IllegalArgumentException("No principal")

        // レコードがあればtrue, なければfalse→表示していい
        val output = instance<GetUserMetasUseCase>().execute(
            GetUserMetasUseCase.Input(
                memberId = MemberId(UUID.fromString(principal.payload.subject)),
                key = "pushNotificationsPermission"
            )
        )

        call.respond(
            HttpStatusCode.OK,
            IsPushNotificationsPermissionAnswerResponse(
                hasPushNotificationsPermissionAnswer = output.value != null
            )
        )

    }

    post<PushSubscriptions.PermissionAnswer> {
        val principal = call.principal<JWTPrincipal>()
            ?: throw IllegalArgumentException("No principal")
        val request = call.receive<PushSubscriptions.PermissionAnswer.Request>()

        instance<SaveMemberMetaUseCase>().execute(
            SaveMemberMetaUseCase.Input(
                memberId = MemberId(UUID.fromString(principal.payload.subject)),
                key = "pushNotificationsPermission",
                value = request.value
            )
        )

        call.respond(HttpStatusCode.NoContent)
    }
}

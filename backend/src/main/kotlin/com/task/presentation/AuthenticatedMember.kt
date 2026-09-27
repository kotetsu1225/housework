package com.task.presentation

import com.task.domain.member.MemberId
import com.task.domain.tenant.TenantId
import io.ktor.server.application.ApplicationCall
import io.ktor.server.auth.jwt.JWTPrincipal
import io.ktor.server.auth.principal
import java.util.UUID

/**
 * 認証済みリクエストにおける「現在のメンバーとテナント」を表す。
 *
 * - `authenticate("jwt") { ... }` の内側（認証済みルート）でのみ取得できる想定。
 * - tenantId は JWT の `tenantId` クレーム由来で確定する（issue #42、2026-09-19 決定）。
 * - UseCase を呼び出す際は、この値をそのまま渡すのではなく、
 *   `memberId` / `tenantId` を個別の明示引数として渡すこと（issue #21 の決定）。
 */
data class AuthenticatedMember(
    val memberId: MemberId,
    val tenantId: TenantId,
)

/**
 * 現在の認証済みメンバーとテナントを取得する。
 *
 * `JwtAuthPlugin` の `validate` で subject / tenantId クレームがどちらも
 * UUID として妥当なトークンのみが principal になるよう検証済みのため、
 * 認証済みルート（`authenticate("jwt") { ... }` の内側）で呼び出す限り
 * 通常はここで例外が発生することはない。
 *
 * ここで [IllegalStateException] を投げるのは、`authenticate("jwt")` の
 * 外側で呼び出してしまった場合など、プログラミングミスのケースのみを想定している。
 */
fun ApplicationCall.authenticatedMember(): AuthenticatedMember {
    val principal = principal<JWTPrincipal>()
        ?: throw IllegalStateException(
            "authenticatedMember()はauthenticate(\"jwt\")の内側でのみ呼び出せます（principalが存在しません）"
        )

    val memberId = principal.payload.subject
        ?.let(::toUuidOrNull)
        ?.let { MemberId(it) }
        ?: throw IllegalStateException("JWTのsubjectがUUIDとして不正です")

    val tenantId = principal.payload.getClaim("tenantId")?.asString()
        ?.let(::toUuidOrNull)
        ?.let { TenantId(it) }
        ?: throw IllegalStateException("JWTのtenantIdクレームが不正です")

    return AuthenticatedMember(memberId = memberId, tenantId = tenantId)
}

/**
 * 文字列がUUIDとして解釈できるかを例外を投げずに判定する。
 */
private fun toUuidOrNull(value: String): UUID? {
    return try {
        UUID.fromString(value)
    } catch (e: IllegalArgumentException) {
        null
    }
}

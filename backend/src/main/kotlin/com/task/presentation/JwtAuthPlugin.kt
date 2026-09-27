package com.task.presentation

import com.task.infra.security.JwtConfig
import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import io.ktor.server.application.Application
import io.ktor.server.auth.authentication
import io.ktor.server.auth.jwt.JWTPrincipal
import io.ktor.server.auth.jwt.jwt
import java.util.UUID

fun Application.configureJwtAuth(config: JwtConfig) {
    authentication {
        jwt("jwt") {
            realm = config.realm

            verifier(
                JWT.require(Algorithm.HMAC256(config.secret))
                    .withAudience(config.audience)
                    .withIssuer(config.issuer)
                    .build()
            )

            validate { credential ->
                val subject = credential.payload.subject
                val tenantId = credential.payload.getClaim("tenantId")?.asString()

                if (isUuid(subject) && isUuid(tenantId)) {
                    JWTPrincipal(credential.payload)
                } else {
                    // subjectが無い/UUIDとして不正、またはtenantIdクレームが無い/UUIDとして不正な
                    // トークンは401にする（issue #42。既存の旧トークンは再ログインが必要）
                    null
                }
            }
        }
    }
}

/**
 * 文字列がUUIDとして解釈できるかを例外を投げずに判定する。
 */
private fun isUuid(value: String?): Boolean {
    if (value == null) return false
    return try {
        UUID.fromString(value)
        true
    } catch (e: IllegalArgumentException) {
        false
    }
}
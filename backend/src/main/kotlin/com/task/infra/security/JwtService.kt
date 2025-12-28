package com.task.infra.security

import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import com.auth0.jwt.exceptions.JWTVerificationException
import com.auth0.jwt.interfaces.DecodedJWT
import com.task.domain.member.Member
import java.util.Date

/**
 * JWT生成・検証サービス
 *
 * DDDの観点:
 * - Infra層に配置（技術詳細であるJWT処理を隔離）
 * - Auth0 JWTライブラリに依存するのはInfra層のみ
 * - UseCaseからはトークン文字列として扱う
 */
class JwtService(
    private val config: JwtConfig
) {
    fun generateToken(member: Member): String {
        return JWT.create()
            .withSubject(member.id.value.toString())
            .withAudience(config.audience)
            .withIssuer(config.issuer)
            .withClaim("name", member.name.value)
            .withClaim("role", member.familyRole.name)
            .withExpiresAt(Date(System.currentTimeMillis() + config.expiresInMs))
            .sign(Algorithm.HMAC256(config.secret))
    }

    fun verifyToken(token: String): DecodedJWT? {
        return try {
            JWT.require(Algorithm.HMAC256(config.secret))
                .build()
                .verify(token)
        } catch (e: JWTVerificationException) {
            null
        }
    }
}

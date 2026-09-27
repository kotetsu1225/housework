package com.task.infra.security

import com.auth0.jwt.JWT
import com.task.domain.member.FamilyRole
import com.task.domain.member.Member
import com.task.domain.member.MemberEmail
import com.task.domain.member.MemberName
import com.task.domain.member.PasswordHash
import com.task.domain.tenant.TenantId
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class JwtServiceTest {

    private val config = JwtConfig(
        secret = "test-secret",
        issuer = "test-issuer",
        audience = "test-audience",
        realm = "test-realm",
        expiresInMs = 60_000L,
    )

    private val jwtService = JwtService(config)

    private fun createMember(tenantId: TenantId): Member {
        return Member.create(
            tenantId = tenantId,
            name = MemberName("山田太郎"),
            email = MemberEmail("taro@example.com"),
            familyRole = FamilyRole.FATHER,
            password = PasswordHash("hashed-password"),
            existingMembersName = emptyList(),
        )
    }

    @Test
    fun `生成したトークンにmemberIdとtenantIdクレームが含まれる`() {
        val tenantId = TenantId.generate()
        val member = createMember(tenantId)

        val token = jwtService.generateToken(member)
        val decoded = JWT.decode(token)

        assertEquals(member.id.value.toString(), decoded.subject)
        assertEquals(tenantId.value.toString(), decoded.getClaim("tenantId").asString())
    }
}

package com.task.usecase.auth

import com.auth0.jwt.JWT
import com.task.domain.member.MemberEmail
import com.task.domain.member.PlainPassword
import com.task.domain.tenant.TenantId
import com.task.infra.database.DatabaseWithoutRLS
import com.task.infra.database.jooq.tables.references.MEMBERS
import com.task.infra.database.jooq.tables.references.TENANTS
import com.task.infra.member.MemberRepositoryImpl
import com.task.infra.security.BCryptPasswordHasher
import com.task.infra.security.JwtConfig
import com.task.infra.security.JwtService
import com.task.infra.tenant.TenantRepositoryImpl
import com.task.support.PostgresTestDatabase
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import java.util.UUID

/**
 * issue #43 の受け入れ条件を実DB(Testcontainers)で確かめる。
 * - 別テナントに同名メンバーがいても、それぞれ自分の email でログインでき、
 *   発行されたトークンの tenantId クレームが自分の tenant になる
 * - email が存在しない場合とパスワード不一致の場合で同じメッセージになる
 * - tenant が ACTIVE でない場合も同じメッセージで失敗する
 */
class LoginUseCaseTest {

    private val passwordHasher = BCryptPasswordHasher()

    private val useCase = LoginUseCaseImpl(
        databaseWithoutRLS = DatabaseWithoutRLS(PostgresTestDatabase.ownerDataSource),
        memberRepository = MemberRepositoryImpl(),
        tenantRepository = TenantRepositoryImpl(),
        passwordHasher = passwordHasher,
        jwtService = JwtService(
            JwtConfig(
                secret = "test-secret",
                issuer = "test",
                audience = "test",
                realm = "test",
                expiresInMs = 60_000L,
            )
        ),
    )

    @AfterEach
    fun cleanup() {
        PostgresTestDatabase.truncateAll()
    }

    /** owner 接続(RLS バイパス)で tenant と、そこに属する member を1件ずつ投入する。 */
    private fun insertTenantWithMember(
        tenantId: TenantId,
        familyName: String,
        tenantEmail: String,
        memberName: String,
        memberEmail: String,
        plainPassword: String,
        tenantStatus: String = "ACTIVE",
    ) {
        val owner = PostgresTestDatabase.ownerDsl()

        owner.insertInto(TENANTS)
            .set(TENANTS.ID, tenantId.value)
            .set(TENANTS.FAMILY_NAME, familyName)
            .set(TENANTS.EMAIL, tenantEmail)
            .set(TENANTS.STATUS, tenantStatus)
            .execute()

        owner.insertInto(MEMBERS)
            .set(MEMBERS.ID, UUID.randomUUID())
            .set(MEMBERS.TENANT_ID, tenantId.value)
            .set(MEMBERS.NAME, memberName)
            .set(MEMBERS.EMAIL, memberEmail)
            .set(MEMBERS.ROLE, "FATHER")
            .set(MEMBERS.PASSWORD_HASH, passwordHasher.hash(PlainPassword(plainPassword)).value)
            .execute()
    }

    @Test
    fun `別テナントに同名メンバーがいてもそれぞれ自分のemailでログインでき tenantIdクレームは自分のtenantになる`() {
        val tenantA = TenantId.generate()
        val tenantB = TenantId.generate()
        insertTenantWithMember(
            tenantId = tenantA,
            familyName = "山田家",
            tenantEmail = "yamada-family@example.com",
            memberName = "太郎",
            memberEmail = "taro-a@example.com",
            plainPassword = "password1",
        )
        insertTenantWithMember(
            tenantId = tenantB,
            familyName = "鈴木家",
            tenantEmail = "suzuki-family@example.com",
            memberName = "太郎",
            memberEmail = "taro-b@example.com",
            plainPassword = "password2",
        )

        val outputA = useCase.execute(
            LoginUseCase.Input(email = MemberEmail("taro-a@example.com"), password = PlainPassword("password1"))
        )
        val outputB = useCase.execute(
            LoginUseCase.Input(email = MemberEmail("taro-b@example.com"), password = PlainPassword("password2"))
        )

        assertEquals(tenantA.value.toString(), JWT.decode(outputA.token).getClaim("tenantId").asString())
        assertEquals(tenantB.value.toString(), JWT.decode(outputB.token).getClaim("tenantId").asString())
        assertNotEquals(outputA.token, outputB.token)
    }

    @Test
    fun `存在しないemailでログインすると認証情報エラーになる`() {
        val exception = assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(
                LoginUseCase.Input(email = MemberEmail("nobody@example.com"), password = PlainPassword("password1"))
            )
        }

        assertEquals("メールアドレスまたはパスワードが正しくありません", exception.message)
    }

    @Test
    fun `パスワードが一致しない場合も同じメッセージで失敗する`() {
        insertTenantWithMember(
            tenantId = TenantId.generate(),
            familyName = "山田家",
            tenantEmail = "yamada-family@example.com",
            memberName = "太郎",
            memberEmail = "taro@example.com",
            plainPassword = "password1",
        )

        val exception = assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(
                LoginUseCase.Input(email = MemberEmail("taro@example.com"), password = PlainPassword("wrong-password"))
            )
        }

        assertEquals("メールアドレスまたはパスワードが正しくありません", exception.message)
    }

    @Test
    fun `tenantのstatusがDELETEDの場合は同じメッセージで失敗する`() {
        val tenantId = TenantId.generate()
        insertTenantWithMember(
            tenantId = tenantId,
            familyName = "山田家",
            tenantEmail = "yamada-family@example.com",
            memberName = "太郎",
            memberEmail = "taro@example.com",
            plainPassword = "password1",
        )
        PostgresTestDatabase.ownerDsl()
            .update(TENANTS)
            .set(TENANTS.STATUS, "DELETED")
            .where(TENANTS.ID.eq(tenantId.value))
            .execute()

        val exception = assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(
                LoginUseCase.Input(email = MemberEmail("taro@example.com"), password = PlainPassword("password1"))
            )
        }

        assertEquals("メールアドレスまたはパスワードが正しくありません", exception.message)
    }
}

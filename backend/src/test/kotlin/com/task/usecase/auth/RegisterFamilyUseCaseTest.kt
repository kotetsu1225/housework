package com.task.usecase.auth

import com.auth0.jwt.JWT
import com.task.domain.member.EmailAlreadyUsedException
import com.task.domain.member.FamilyRole
import com.task.domain.member.MemberEmail
import com.task.domain.member.MemberId
import com.task.domain.member.MemberName
import com.task.domain.member.PlainPassword
import com.task.domain.tenant.FamilyName
import com.task.infra.database.DatabaseWithoutRLS
import com.task.infra.database.jooq.tables.references.MEMBERS
import com.task.infra.database.jooq.tables.references.TENANTS
import com.task.infra.member.MemberRepositoryImpl
import com.task.infra.security.BCryptPasswordHasher
import com.task.infra.security.JwtConfig
import com.task.infra.security.JwtService
import com.task.infra.tenant.TenantRepositoryImpl
import com.task.support.PostgresTestDatabase
import com.task.support.TestFixtures
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test

/**
 * issue #44 の受け入れ条件を実DBで確かめる。
 *
 * - register 1回で tenants 1行・members 1行ができ、members.tenant_id がその tenant を指す
 * - 同じ email で2回 register すると2回目は EmailAlreadyUsedException になる(409相当)
 * - 途中で失敗したら tenants だけ残らない(1トランザクションでロールバックされる)
 */
class RegisterFamilyUseCaseTest {

    private val databaseWithoutRLS = DatabaseWithoutRLS(PostgresTestDatabase.ownerDataSource)
    private val tenantRepository = TenantRepositoryImpl()
    private val memberRepository = MemberRepositoryImpl()
    private val passwordHasher = BCryptPasswordHasher()
    private val jwtConfig = JwtConfig(
        secret = "test-secret",
        issuer = "test-issuer",
        audience = "test-audience",
        realm = "test-realm",
        expiresInMs = 60_000L,
    )
    private val jwtService = JwtService(jwtConfig)

    private val useCase = RegisterFamilyUseCaseImpl(
        databaseWithoutRLS = databaseWithoutRLS,
        tenantRepository = tenantRepository,
        memberRepository = memberRepository,
        passwordHasher = passwordHasher,
        jwtService = jwtService,
    )

    @AfterEach
    fun cleanup() {
        PostgresTestDatabase.truncateAll()
    }

    private fun input(
        familyName: String = "山田家",
        name: String = "山田太郎",
        email: String = "taro@example.com",
    ): RegisterFamilyUseCase.Input = RegisterFamilyUseCase.Input(
        familyName = FamilyName(familyName),
        name = MemberName(name),
        email = MemberEmail(email),
        familyRole = FamilyRole.FATHER,
        password = PlainPassword("password123"),
    )

    @Test
    fun `register 1回でtenantsとmembersが各1行作られmembers_tenant_idとtenants_emailとJWTのtenantIdクレームが一致する`() {
        val output = useCase.execute(input(email = "taro@example.com"))

        val owner = PostgresTestDatabase.ownerDsl()

        assertEquals(1, owner.fetchCount(TENANTS))
        assertEquals(1, owner.fetchCount(MEMBERS))

        val memberRow = owner.select(MEMBERS.TENANT_ID, MEMBERS.EMAIL)
            .from(MEMBERS)
            .where(MEMBERS.ID.eq(output.memberId.value))
            .fetchOne()!!
        assertEquals(output.tenantId.value, memberRow.get(MEMBERS.TENANT_ID))
        assertEquals("taro@example.com", memberRow.get(MEMBERS.EMAIL))

        val tenantEmail = owner.select(TENANTS.EMAIL)
            .from(TENANTS)
            .where(TENANTS.ID.eq(output.tenantId.value))
            .fetchOne(TENANTS.EMAIL)
        assertEquals("taro@example.com", tenantEmail)

        val decoded = JWT.decode(output.token)
        assertEquals(output.tenantId.value.toString(), decoded.getClaim("tenantId").asString())
    }

    @Test
    fun `同じemailで2回registerすると2回目はEmailAlreadyUsedExceptionになる`() {
        useCase.execute(input(email = "taro@example.com"))

        assertThrows(EmailAlreadyUsedException::class.java) {
            useCase.execute(input(familyName = "鈴木家", name = "鈴木花子", email = "taro@example.com"))
        }
    }

    @Test
    fun `member作成が一意制約違反で失敗したらtenantsの行もロールバックされて残らない`() {
        val owner = PostgresTestDatabase.ownerDsl()

        // 既存の家族(tenants.emailは別の値)に、「2人目のメンバー」としてemail Xを持つメンバーを
        // オーナー接続で直接投入しておく(アプリのUseCaseを経由せず、あくまで既存データとして用意する)。
        val existing = TestFixtures.createTenantWithMember(
            owner,
            familyName = "既存家",
            memberName = "既存太郎",
            email = "existing-owner@example.com",
        )
        val conflictingEmail = "conflict@example.com"
        owner.insertInto(MEMBERS)
            .set(MEMBERS.ID, MemberId.generate().value)
            .set(MEMBERS.NAME, "既存次郎")
            .set(MEMBERS.ROLE, "MOTHER")
            .set(MEMBERS.PASSWORD_HASH, "dummy-password-hash")
            .set(MEMBERS.EMAIL, conflictingEmail)
            .set(MEMBERS.TENANT_ID, existing.tenantId.value)
            .execute()

        val tenantCountBefore = owner.fetchCount(TENANTS)

        // email X で register すると、tenants の INSERT 自体は通るが(tenants.emailは別の値なので)、
        // members の INSERT が一意制約違反になり、EmailAlreadyUsedException に変換される。
        assertThrows(EmailAlreadyUsedException::class.java) {
            useCase.execute(input(familyName = "新しい家", name = "新次郎", email = conflictingEmail))
        }

        // 1トランザクションでロールバックされているため、tenantsの行数は増えていない
        assertEquals(tenantCountBefore, owner.fetchCount(TENANTS))
    }
}

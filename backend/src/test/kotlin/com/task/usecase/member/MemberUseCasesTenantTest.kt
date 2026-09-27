package com.task.usecase.member

import com.task.domain.member.EmailAlreadyUsedException
import com.task.domain.member.FamilyRole
import com.task.domain.member.MemberEmail
import com.task.domain.member.MemberName
import com.task.domain.member.PlainPassword
import com.task.domain.tenant.TenantId
import com.task.infra.database.Database
import com.task.infra.database.jooq.tables.references.MEMBERS
import com.task.infra.member.MemberRepositoryImpl
import com.task.infra.query.MemberStatsQueryServiceImpl
import com.task.infra.security.BCryptPasswordHasher
import com.task.support.PostgresTestDatabase
import com.task.support.TestFixtures
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/**
 * issue #51 の受け入れ条件を実 DB(Testcontainers)で確かめる。
 *
 * Member 系 4 UseCase(Create / Get / GetMembers / Update)が
 * `Database.withTransaction(tenantId)`(tenant スコープ・RLS 適用)を使うようになったことで、
 * - 自テナントのデータしか見えない/更新できない
 * - email のグローバル重複は一意制約違反から EmailAlreadyUsedException に変換される
 * - 名前の重複チェックはテナント内一意になる
 * ことを確認する。
 */
class MemberUseCasesTenantTest {

    private val database = Database(
        PostgresTestDatabase.ownerDataSource,
        PostgresTestDatabase.appDataSource,
    )
    private val memberRepository = MemberRepositoryImpl()
    private val memberStatsQueryService = MemberStatsQueryServiceImpl()
    private val passwordHasher = BCryptPasswordHasher()

    private val createMemberUseCase = CreateMemberUseCaseImpl(database, memberRepository, passwordHasher)
    private val getMemberUseCase = GetMemberUseCaseImpl(database, memberRepository)
    private val getMembersUseCase = GetMembersUseCaseImpl(database, memberRepository, memberStatsQueryService)
    private val updateMemberUseCase = UpdateMemberUseCaseImpl(database, memberRepository)

    @AfterEach
    fun cleanup() {
        PostgresTestDatabase.truncateAll()
    }

    /** CreateMemberUseCase.Input を組み立てるテスト用ヘルパー。 */
    private fun createMemberInput(
        tenantId: TenantId,
        name: String,
        email: String,
    ) = CreateMemberUseCase.Input(
        tenantId = tenantId,
        name = MemberName(name),
        familyRole = FamilyRole.MOTHER,
        email = MemberEmail(email),
        password = PlainPassword("password123"),
    )

    @Test
    fun `GetMembersUseCaseは自テナントのメンバーだけを返す`() {
        val owner = PostgresTestDatabase.ownerDsl()
        val a = TestFixtures.createTenantWithMember(owner, "山田家", "太郎", "taro@example.com")
        TestFixtures.createTenantWithMember(owner, "鈴木家", "次郎", "jiro@example.com")

        val output = getMembersUseCase.execute(GetMembersUseCase.Input(tenantId = a.tenantId))

        assertEquals(listOf(a.memberId), output.members.map { it.id })
    }

    @Test
    fun `GetMemberUseCaseは他テナントのmemberIdに対してnullを返す`() {
        val owner = PostgresTestDatabase.ownerDsl()
        val a = TestFixtures.createTenantWithMember(owner, "山田家", "太郎", "taro@example.com")
        val b = TestFixtures.createTenantWithMember(owner, "鈴木家", "次郎", "jiro@example.com")

        // GetMemberUseCaseImplはfindByIdの結果がnullなら例外を投げずnullを返す実装のため、
        // RLSでB側の行が見えなくなることは「見つからない(null)」として観測される。
        val output = getMemberUseCase.execute(GetMemberUseCase.Input(tenantId = a.tenantId, id = b.memberId))

        assertNull(output)
    }

    @Test
    fun `UpdateMemberUseCaseは他テナントのmemberIdに対して見つかりません例外を投げる`() {
        val owner = PostgresTestDatabase.ownerDsl()
        val a = TestFixtures.createTenantWithMember(owner, "山田家", "太郎", "taro@example.com")
        val b = TestFixtures.createTenantWithMember(owner, "鈴木家", "次郎", "jiro@example.com")

        val exception = assertThrows(IllegalArgumentException::class.java) {
            updateMemberUseCase.execute(
                UpdateMemberUseCase.Input(
                    tenantId = a.tenantId,
                    id = b.memberId,
                    name = MemberName("新しい名前"),
                )
            )
        }
        assertTrue(exception.message!!.contains("見つかりませんでした")) { exception.message.toString() }
    }

    @Test
    fun `CreateMemberUseCaseで作成したメンバーは呼び出し元と同じtenant_idを持つ`() {
        val owner = PostgresTestDatabase.ownerDsl()
        val a = TestFixtures.createTenantWithMember(owner, "山田家", "太郎", "taro@example.com")

        val output = createMemberUseCase.execute(
            createMemberInput(tenantId = a.tenantId, name = "花子", email = "hanako@example.com")
        )

        val tenantIdInDb = owner.select(MEMBERS.TENANT_ID)
            .from(MEMBERS)
            .where(MEMBERS.ID.eq(output.id.value))
            .fetchOne(MEMBERS.TENANT_ID)

        assertEquals(a.tenantId.value, tenantIdInDb)
    }

    @Test
    fun `CreateMemberUseCaseは他テナントと同じemailだとEmailAlreadyUsedExceptionを投げる`() {
        val owner = PostgresTestDatabase.ownerDsl()
        val a = TestFixtures.createTenantWithMember(owner, "山田家", "太郎", "taro@example.com")
        val bEmail = "jiro@example.com"
        TestFixtures.createTenantWithMember(owner, "鈴木家", "次郎", bEmail)

        assertThrows(EmailAlreadyUsedException::class.java) {
            createMemberUseCase.execute(
                createMemberInput(tenantId = a.tenantId, name = "花子", email = bEmail)
            )
        }
    }

    @Test
    fun `同一テナント内の名前重複は不変条件違反、別テナントであれば成功する`() {
        val owner = PostgresTestDatabase.ownerDsl()
        val a = TestFixtures.createTenantWithMember(owner, "山田家", "太郎", "taro@example.com")
        val b = TestFixtures.createTenantWithMember(owner, "鈴木家", "次郎", "jiro@example.com")

        // 以降bはtenantIdの取得にのみ使う(fixtureのmemberId自体は本テストの検証対象外)

        // Aには既に「太郎」がいるため、テナント内一意の不変条件に違反する
        val duplicateInA = assertThrows(IllegalArgumentException::class.java) {
            createMemberUseCase.execute(
                createMemberInput(tenantId = a.tenantId, name = "太郎", email = "taro2@example.com")
            )
        }
        assertTrue(duplicateInA.message!!.contains("既存のユーザ名と重複しています")) { duplicateInA.message.toString() }

        // Bには「太郎」がいないため、Aと同じ名前でも作成できる(テナントをまたいだ重複はチェック対象外)
        val output = createMemberUseCase.execute(
            createMemberInput(tenantId = b.tenantId, name = "太郎", email = "taro-b@example.com")
        )
        assertEquals("太郎", output.name.value)
    }
}

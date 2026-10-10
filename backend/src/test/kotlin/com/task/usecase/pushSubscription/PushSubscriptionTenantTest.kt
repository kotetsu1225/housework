package com.task.usecase.pushSubscription

import com.task.infra.database.Database
import com.task.infra.database.jooq.tables.references.MEMBER_METAS
import com.task.infra.database.jooq.tables.references.PUSH_SUBSCRIPTIONS
import com.task.infra.memberMeta.MemberMetaRepositoryImpl
import com.task.infra.pushSubscription.PushSubscriptionRepositoryImpl
import com.task.support.PostgresTestDatabase
import com.task.support.TestFixtures
import com.task.usecase.memberMeta.GetUserMetasUseCase
import com.task.usecase.memberMeta.GetUserMetasUseCaseImpl
import com.task.usecase.memberMeta.SaveMemberMetaUseCase
import com.task.usecase.memberMeta.SaveMemberMetaUseCaseImpl
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

/**
 * #48 #52 の受け入れ条件を実 DB(RLS あり、housework_app 接続)で確かめる。
 * - push_subscriptions / member_metas の INSERT に、呼び出し元メンバーのテナントが入る
 * - 4 つの UseCase が tenant スコープで動き、他の家族の行は見えない
 * - 同じ endpoint が別の家族で登録済みなら 409 用の例外になり、元の家族の行は変わらない(#48 案 C)
 */
class PushSubscriptionTenantTest {

    private val database = Database(PostgresTestDatabase.ownerDataSource, PostgresTestDatabase.appDataSource)
    private val pushRepository = PushSubscriptionRepositoryImpl()
    private val metaRepository = MemberMetaRepositoryImpl()
    private val register = RegisterPushSubscriptionUseCaseImpl(database, pushRepository, metaRepository)
    private val getSubscriptions = GetPushSubscriptionUseCaseImpl(database, pushRepository)
    private val getMeta = GetUserMetasUseCaseImpl(database, metaRepository)
    private val saveMeta = SaveMemberMetaUseCaseImpl(database, metaRepository)

    private val endpoint = "https://push.example.com/send/device-1"
    private val permissionKey = "pushNotificationsPermission"

    @AfterEach
    fun cleanup() {
        PostgresTestDatabase.truncateAll()
    }

    private fun registerInput(family: TestFixtures.TenantWithMember, p256dh: String = "p256dh-a") =
        RegisterPushSubscriptionUseCase.Input(
            tenantId = family.tenantId,
            memberId = family.memberId,
            endpoint = endpoint,
            p256dhKey = p256dh,
            authKey = "auth",
        )

    private fun pushRows() = PostgresTestDatabase.ownerDsl().selectFrom(PUSH_SUBSCRIPTIONS).fetch()
    private fun metaRows() = PostgresTestDatabase.ownerDsl().selectFrom(MEMBER_METAS).fetch()

    @Test
    fun `登録すると push_subscriptions と member_metas に呼び出し元のテナントが入り、同じ endpoint の再登録は更新になる`() {
        val familyA = TestFixtures.createTenantWithMember(PostgresTestDatabase.ownerDsl(), "山田家", "太郎", "taro@example.com")

        val first = register.execute(registerInput(familyA))
        val second = register.execute(registerInput(familyA, p256dh = "p256dh-renewed"))

        assertEquals(first.subscriptionId, second.subscriptionId)
        val push = pushRows().single()
        assertEquals(familyA.tenantId.value, push.tenantId)
        assertEquals("p256dh-renewed", push.p256dhKey)
        val meta = metaRows().single()
        assertEquals(familyA.tenantId.value, meta.tenantId)
        assertEquals(permissionKey, meta.key)
        assertEquals(true, meta.value)

        val subscriptions = getSubscriptions.execute(GetPushSubscriptionUseCase.Input(familyA.tenantId, familyA.memberId))
        assertEquals(familyA.tenantId, subscriptions.subscriptions.single().tenantId)
    }

    @Test
    fun `同じ endpoint が別の家族で登録済みなら断り、元の家族の行は変わらず、断られた側には何も残らない`() {
        val familyA = TestFixtures.createTenantWithMember(PostgresTestDatabase.ownerDsl(), "山田家", "太郎", "taro@example.com")
        val familyB = TestFixtures.createTenantWithMember(PostgresTestDatabase.ownerDsl(), "鈴木家", "次郎", "jiro@example.com")
        register.execute(registerInput(familyA))

        val error = assertThrows<PushEndpointRegisteredByAnotherFamilyException> {
            register.execute(registerInput(familyB, p256dh = "p256dh-b"))
        }
        assertEquals("この端末は別の家族のアカウントで通知登録されています", error.message)

        val push = pushRows().single()
        assertEquals(familyA.tenantId.value, push.tenantId)
        assertEquals(familyA.memberId.value, push.memberId)
        assertEquals("p256dh-a", push.p256dhKey)
        // B の通知許可メタは同じトランザクションでロールバックされている
        assertEquals(listOf(familyA.tenantId.value), metaRows().map { it.tenantId })
        // B からは A の購読が見えない
        assertTrue(getSubscriptions.execute(GetPushSubscriptionUseCase.Input(familyB.tenantId, familyB.memberId)).subscriptions.isEmpty())
    }

    @Test
    fun `通知許可の回答は呼び出し元のテナントで保存され、別の家族からは読めない`() {
        val familyA = TestFixtures.createTenantWithMember(PostgresTestDatabase.ownerDsl(), "山田家", "太郎", "taro@example.com")
        val familyB = TestFixtures.createTenantWithMember(PostgresTestDatabase.ownerDsl(), "鈴木家", "次郎", "jiro@example.com")

        saveMeta.execute(SaveMemberMetaUseCase.Input(familyA.tenantId, familyA.memberId, permissionKey, false))
        saveMeta.execute(SaveMemberMetaUseCase.Input(familyA.tenantId, familyA.memberId, permissionKey, true))

        assertEquals(listOf(familyA.tenantId.value), metaRows().map { it.tenantId })
        assertEquals(true, getMeta.execute(GetUserMetasUseCase.Input(familyA.tenantId, familyA.memberId, permissionKey)).value)
        // B のテナントのトランザクションでは、A のメンバー ID を指定しても RLS で見えない
        assertNull(getMeta.execute(GetUserMetasUseCase.Input(familyB.tenantId, familyA.memberId, permissionKey)).value)
    }
}

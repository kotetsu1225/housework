package com.task.infra.member

import com.task.domain.member.FamilyRole
import com.task.domain.member.Member
import com.task.domain.member.MemberEmail
import com.task.domain.member.MemberName
import com.task.domain.member.PasswordHash
import com.task.domain.tenant.TenantId
import com.task.infra.database.jooq.tables.references.MEMBERS
import com.task.infra.database.jooq.tables.references.TENANTS
import com.task.support.PostgresTestDatabase
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

/**
 * #45 の受け入れ条件「作成した member の tenant_id が DB に保存され、再構築で同じ値になる」を実 DB で確かめる。
 */
class MemberRepositoryTenantTest {

    private val repository = MemberRepositoryImpl()

    @AfterEach
    fun cleanup() {
        PostgresTestDatabase.truncateAll()
    }

    @Test
    fun `create で tenant_id が保存され、findById で同じ tenantId に再構築される`() {
        val owner = PostgresTestDatabase.ownerDsl()
        val tenantId = TenantId.generate()
        owner.insertInto(TENANTS)
            .set(TENANTS.ID, tenantId.value)
            .set(TENANTS.FAMILY_NAME, "山田家")
            .set(TENANTS.EMAIL, "family@example.com")
            .execute()
        val member = Member.create(
            tenantId = tenantId,
            name = MemberName("山田太郎"),
            email = MemberEmail("taro@example.com"),
            familyRole = FamilyRole.FATHER,
            password = PasswordHash("hashed-password"),
            existingMembersName = emptyList(),
        )

        // tenant スコープのトランザクションで保存する(RLS の WITH CHECK も通ることの確認を兼ねる)
        PostgresTestDatabase.inTenantTransaction(tenantId) { session -> repository.create(member, session) }

        val storedTenantId = owner.select(MEMBERS.TENANT_ID).from(MEMBERS)
            .where(MEMBERS.ID.eq(member.id.value)).fetchOne(MEMBERS.TENANT_ID)
        assertEquals(tenantId.value, storedTenantId)

        val reconstructed = PostgresTestDatabase.inTenantTransaction(tenantId) { session ->
            repository.findById(member.id, session)
        }
        assertEquals(tenantId, reconstructed!!.tenantId)
    }

    @Test
    fun `update しても tenant_id は変わらない`() {
        val owner = PostgresTestDatabase.ownerDsl()
        val tenantId = TenantId.generate()
        owner.insertInto(TENANTS)
            .set(TENANTS.ID, tenantId.value)
            .set(TENANTS.FAMILY_NAME, "山田家")
            .set(TENANTS.EMAIL, "family@example.com")
            .execute()
        val member = Member.create(
            tenantId = tenantId,
            name = MemberName("山田太郎"),
            email = MemberEmail("taro@example.com"),
            familyRole = FamilyRole.FATHER,
            password = PasswordHash("hashed-password"),
            existingMembersName = emptyList(),
        )
        PostgresTestDatabase.inTenantTransaction(tenantId) { session -> repository.create(member, session) }

        val renamed = member.updateName(MemberName("山田次郎"), existingMembersName = emptyList())
        PostgresTestDatabase.inTenantTransaction(tenantId) { session -> repository.update(renamed, session) }

        val row = owner.select(MEMBERS.NAME, MEMBERS.TENANT_ID).from(MEMBERS)
            .where(MEMBERS.ID.eq(member.id.value)).fetchOne()!!
        assertEquals("山田次郎", row.get(MEMBERS.NAME))
        assertEquals(tenantId.value, row.get(MEMBERS.TENANT_ID))
    }
}

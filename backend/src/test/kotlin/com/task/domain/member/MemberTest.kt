package com.task.domain.member

import com.task.domain.tenant.TenantId
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class MemberTest {

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
    fun `createで渡したtenantIdが保持される`() {
        val tenantId = TenantId.generate()

        val member = createMember(tenantId)

        assertEquals(tenantId, member.tenantId)
    }

    @Test
    fun `updateNameしてもtenantIdは変わらない`() {
        val tenantId = TenantId.generate()
        val member = createMember(tenantId)

        val updated = member.updateName(
            newName = MemberName("鈴木次郎"),
            existingMembersName = emptyList(),
        )

        assertEquals(tenantId, updated.tenantId)
    }

    @Test
    fun `updateEmailしてもtenantIdは変わらない`() {
        val tenantId = TenantId.generate()
        val member = createMember(tenantId)

        val updated = member.updateEmail(MemberEmail("new@example.com"))

        assertEquals(tenantId, updated.tenantId)
    }

    @Test
    fun `updateFamilyRoleしてもtenantIdは変わらない`() {
        val tenantId = TenantId.generate()
        val member = createMember(tenantId)

        val updated = member.updateFamilyRole(FamilyRole.MOTHER)

        assertEquals(tenantId, updated.tenantId)
    }

    @Test
    fun `reconstructで渡したtenantIdがそのまま復元される`() {
        val tenantId = TenantId.generate()

        val member = Member.reconstruct(
            id = MemberId.generate(),
            tenantId = tenantId,
            name = MemberName("山田花子"),
            email = MemberEmail("hanako@example.com"),
            familyRole = FamilyRole.MOTHER,
            password = PasswordHash("hashed-password"),
        )

        assertEquals(tenantId, member.tenantId)
    }
}

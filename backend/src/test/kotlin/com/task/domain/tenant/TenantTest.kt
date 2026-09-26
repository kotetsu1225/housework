package com.task.domain.tenant

import com.task.domain.member.MemberEmail
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test

class TenantTest {

    @Test
    fun `createするとACTIVEになりfamilyNameとemailがそのまま設定される`() {
        val familyName = FamilyName("山田家")
        val email = MemberEmail("tenant@example.com")

        val tenant1 = Tenant.create(familyName, email)
        val tenant2 = Tenant.create(familyName, email)

        assertEquals(TenantStatus.ACTIVE, tenant1.status)
        assertEquals(familyName, tenant1.familyName)
        assertEquals(email, tenant1.email)
        // create のたびに id が生成されていること
        assertNotEquals(tenant1.id, tenant2.id)
    }

    @Test
    fun `FamilyNameは空文字を許容しない`() {
        val exception = assertThrows(IllegalArgumentException::class.java) {
            FamilyName("")
        }
        assertEquals("家族名は必須です。", exception.message)
    }

    @Test
    fun `FamilyNameは空白のみの文字列を許容しない`() {
        assertThrows(IllegalArgumentException::class.java) {
            FamilyName("   ")
        }
    }

    @Test
    fun `FamilyNameは255文字であれば許容する`() {
        val name = "あ".repeat(255)

        val familyName = FamilyName(name)

        assertEquals(name, familyName.value)
    }

    @Test
    fun `FamilyNameは256文字以上を許容しない`() {
        val name = "あ".repeat(256)

        val exception = assertThrows(IllegalArgumentException::class.java) {
            FamilyName(name)
        }
        assertEquals("家族名は255文字以内で入力してください。", exception.message)
    }

    @Test
    fun `reconstructでDELETEDのTenantを復元できる`() {
        val id = TenantId.generate()
        val familyName = FamilyName("山田家")
        val email = MemberEmail("tenant@example.com")

        val tenant = Tenant.reconstruct(
            id = id,
            familyName = familyName,
            email = email,
            status = TenantStatus.DELETED,
        )

        assertEquals(id, tenant.id)
        assertEquals(TenantStatus.DELETED, tenant.status)
    }
}

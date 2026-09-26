package com.task.domain.tenant

import com.task.domain.member.MemberEmail

class Tenant private constructor(
    val id: TenantId,
    val familyName: FamilyName,
    val email: MemberEmail,
    val status: TenantStatus,
) {
    companion object {
        fun create(
            familyName: FamilyName,
            email: MemberEmail,
        ): Tenant {
            return Tenant(
                id = TenantId.generate(),
                familyName = familyName,
                email = email,
                status = TenantStatus.ACTIVE,
            )
        }

        fun reconstruct(
            id: TenantId,
            familyName: FamilyName,
            email: MemberEmail,
            status: TenantStatus,
        ): Tenant {
            return Tenant(
                id = id,
                familyName = familyName,
                email = email,
                status = status,
            )
        }
    }
}

enum class TenantStatus {
    ACTIVE,
    DELETED,
}

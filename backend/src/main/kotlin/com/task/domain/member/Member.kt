package com.task.domain.member

import com.task.domain.tenant.TenantId
import java.util.UUID

class Member private constructor(
    val id: MemberId,
    val tenantId: TenantId,
    val name: MemberName,
    val email: MemberEmail,
    val familyRole: FamilyRole,
    val password: PasswordHash,
) {
    fun updateName(newName: MemberName, existingMembersName: List<MemberName>): Member {
        validateNoDuplicationExistingMembersName(existingMembersName, newName)

        return Member(
            id = this.id,
            tenantId = this.tenantId,
            name = newName,
            email = this.email,
            familyRole = this.familyRole,
            password = this.password,
        )
    }

    fun updateEmail(newEmail: MemberEmail): Member {
        return Member(
            id = this.id,
            tenantId = this.tenantId,
            name = this.name,
            email = newEmail,
            familyRole = this.familyRole,
            password = this.password,
        )
    }

    fun updateFamilyRole(newRole: FamilyRole): Member {
        return Member(
            id = this.id,
            tenantId = this.tenantId,
            name = this.name,
            email = this.email,
            familyRole = newRole,
            password = this.password,
        )
    }

    companion object {
        fun create(
            tenantId: TenantId,
            name: MemberName,
            email: MemberEmail,
            familyRole: FamilyRole,
            password: PasswordHash,
            existingMembersName: List<MemberName>
        ): Member {
            validateNoDuplicationExistingMembersName(existingMembersName, name)

            return Member(
                id = MemberId.generate(),
                tenantId = tenantId,
                name = name,
                email = email,
                familyRole = familyRole,
                password = password,
            )
        }

        fun reconstruct(
            id: MemberId,
            tenantId: TenantId,
            name: MemberName,
            email: MemberEmail,
            familyRole: FamilyRole,
            password: PasswordHash,
        ): Member {
            return Member(
                id = id,
                tenantId = tenantId,
                name = name,
                email = email,
                familyRole = familyRole,
                password = password,
            )
        }

        private fun validateNoDuplicationExistingMembersName(
            membersName: List<MemberName>,
            newMemberName: MemberName
        ) {
            require(membersName.none { it.value == newMemberName.value }) {
                "既存のユーザ名と重複しています"
            }
        }
    }
}

data class MemberId(val value: UUID) {
    companion object {
        fun generate() = MemberId(value = UUID.randomUUID())
        fun from(value: String) = MemberId(value = UUID.fromString(value))
    }
}

data class MemberName(val value: String) {
    init {
        require(value.isNotBlank()) {
            "名前は必須です。"
        }
    }
}

enum class FamilyRole(val value: String) {
    FATHER("FATHER"),
    MOTHER("MOTHER"),
    SISTER("SISTER"),
    BROTHER("BROTHER");

    companion object {
        fun get(value: String): FamilyRole = entries.find {
            it.value == value
        } ?: throw IllegalArgumentException("Invalid family role: $value")
    }

    fun toName(): String = when (this) {
        FATHER -> "父"
        MOTHER -> "母"
        SISTER -> "妹"
        BROTHER -> "兄"
    }
}

@JvmInline
value class PlainPassword(val value: String) {
    init {
        require(value.length >= 5) { "パスワードは5文字以上である必要があります" }
        require(value.length <= 72) { "パスワードは72文字以下である必要があります" }
    }
}

@JvmInline
value class PasswordHash(val value: String) {
    init {
        require(value.isNotBlank()) {
            "パスワードハッシュは必須です。"
        }
    }
}
